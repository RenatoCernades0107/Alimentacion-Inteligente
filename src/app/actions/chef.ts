"use server";

import { revalidatePath } from "next/cache";
import { createTranslator } from "next-intl";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireMember } from "@/lib/session";
import { addDays, isValidDate, todayIn } from "@/lib/dates";
import { slotsFor } from "@/lib/meals";
import { loadMyTarget } from "@/lib/my-target";
import { loadChefData } from "@/lib/chef-data";
import { askChef } from "@/lib/chef-ai";
import { notifyFamily } from "@/lib/push";
import {
  GOALS, MAX_DAYS_AHEAD, PREFS, SCOPES, dayTargets, fallbackPlan, goalsFor, parseSlotKey, sanitizeReply, scopeDates, slotKey,
  type ChefReply, type Plan, type SlotKey,
} from "@/lib/chef";
import type { MealSlot } from "@/lib/types";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

const MAX_HISTORY = 16;
const MAX_TEXT = 600;

const Uuid = z.string().uuid();
const Key = z.string().regex(/^\d{4}-\d{2}-\d{2}\|[a-z_]+$/);

const TurnInput = z.object({
  intent: z.enum(["build", "message"]),
  prefs: z.object({
    goal: z.enum(GOALS),
    scope: z.enum(SCOPES),
    prefs: z.array(z.enum(PREFS)).max(PREFS.length),
    start: z.string().refine(isValidDate),
  }),
  history: z.array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(2000) })).max(60),
  plan: z.record(Key, z.object({ recipeId: Uuid, reason: z.string().max(200).optional() })),
  liked: z.array(Uuid).max(60),
  disliked: z.array(Uuid).max(60),
});
export type ChefTurnInput = z.input<typeof TurnInput>;

/**
 * Un turno del Chef IA: arma el plan ("build") o responde a un mensaje. Si la IA no está disponible
 * o falla, "build" usa el plan de respaldo (src/lib/chef.ts) para que la pantalla siga sirviendo.
 */
export async function chefTurn(raw: ChefTurnInput): Promise<ChefReply> {
  const { supabase, family, user, profile } = await requireMember();
  const input = TurnInput.parse(raw);
  const locale = (await getLocale()) === "en" ? "en" : "es";
  const t = createTranslator({ locale, messages: locale === "en" ? en : es, namespace: "chef" });

  const today = todayIn(family.timezone);
  const [{ cards, busy }, target] = await Promise.all([
    loadChefData(supabase, family.id, today, locale),
    loadMyTarget(supabase, user.id, family.timezone),
  ]);
  const minor = !!target.minor;
  const goal = goalsFor(minor).includes(input.prefs.goal) ? input.prefs.goal : "healthy";
  const prefs = { ...input.prefs, goal };
  const dates = scopeDates(prefs.scope, today, input.prefs.start <= addDays(today, MAX_DAYS_AHEAD - 7) ? input.prefs.start : today);
  const slots = slotsFor(family.meals_per_day);
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  // Solo se conservan del borrador las recetas que el usuario puede ver.
  const plan: Plan = Object.fromEntries(Object.entries(input.plan).filter(([, e]) => cardMap.has(e.recipeId))) as Plan;
  const inScopeBusy = [...busy.entries()].filter(([k]) => dates.includes(parseSlotKey(k).date));

  const history = input.history
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, text: m.text.slice(0, m.role === "user" ? MAX_TEXT : 2000) }));
  if (input.intent === "build") history.push({ role: "user", text: t("buildPrompt") });
  if (!history.length || history[history.length - 1].role !== "user") throw new Error("invalid");

  const ctx = { cards: cardMap, slots, dates: new Set(dates), busy: new Set<string>(busy.keys()) };
  try {
    const rawReply = await askChef(
      {
        locale, name: profile.full_name?.split(" ")[0] ?? "", today, prefs, targets: dayTargets(target.kcal, goal), minor,
        weightKg: target.weightKg ?? null, goalKg: target.goalKg ?? null, mealsPerDay: family.meals_per_day, slots, dates,
        cards, plan, busy: inScopeBusy.map(([key, name]) => ({ key, name })), liked: input.liked, disliked: input.disliked,
      },
      history,
    );
    const reply = sanitizeReply(rawReply, ctx);
    if (reply.message || reply.changes.length || reply.alternatives) return reply;
    throw new Error("empty chef reply");
  } catch (e) {
    console.error("chef", e);
    if (input.intent !== "build") return { message: t("offlineMessage"), quickReplies: [], changes: [], alternatives: null, offline: true };
    const next = fallbackPlan({
      cards, dates, slots, goal, prefs: prefs.prefs, liked: input.liked, disliked: input.disliked,
      busy: inScopeBusy.map(([k]) => k), plan,
    });
    const changes = (Object.keys(next) as SlotKey[]).filter((k) => next[k]?.recipeId !== plan[k]?.recipeId).map((key) => ({ key, recipeId: next[key]!.recipeId }));
    return { message: t("offlineBuilt"), quickReplies: [], changes, alternatives: null, offline: true };
  }
}

const ApplyInput = z.array(z.object({ key: Key, recipeId: Uuid })).min(1).max(70);

/**
 * Pasa el plan al calendario. Padres: comidas planificadas. Hijos: propuestas (los padres reciben un
 * solo aviso por todo el plan). Las franjas que mientras tanto se ocuparon se saltan.
 */
export async function applyChefPlan(raw: { key: string; recipeId: string }[]): Promise<{ added: number; skipped: number }> {
  const session = await requireMember();
  const { supabase, family, user, isParent } = session;
  const entries = ApplyInput.parse(raw);
  const today = todayIn(family.timezone);
  const slots = slotsFor(family.meals_per_day);

  const rows = entries
    .map((e) => ({ ...parseSlotKey(e.key), recipeId: e.recipeId }))
    .filter((e) => isValidDate(e.date) && e.date >= today && e.date <= addDays(today, MAX_DAYS_AHEAD) && slots.includes(e.slot as MealSlot));

  // Recetas visibles para el usuario (RLS) y franjas ocupadas desde que se armó el plan.
  const ids = [...new Set(rows.map((r) => r.recipeId))];
  const dates = [...new Set(rows.map((r) => r.date))];
  const [{ data: visible }, { data: taken }] = await Promise.all([
    supabase.from("recipes").select("id").in("id", ids),
    supabase.from("meals").select("date, slot").eq("family_id", family.id).in("date", dates).neq("status", "cancelled"),
  ]);
  const ok = new Set((visible ?? []).map((r) => r.id as string));
  const busy = new Set((taken ?? []).map((m) => slotKey(m.date as string, m.slot as MealSlot)));
  const seen = new Set<string>();
  const insert = rows.filter((r) => {
    const key = slotKey(r.date, r.slot);
    if (!ok.has(r.recipeId) || busy.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (insert.length) {
    const { error } = await supabase.from("meals").insert(
      insert.map((r) => ({
        family_id: family.id, date: r.date, slot: r.slot, recipe_id: r.recipeId,
        ...(isParent ? { status: "planned" } : { status: "proposed", proposed_by: user.id }),
      })),
    );
    if (error) throw new Error(error.message);

    if (!isParent) {
      const name = session.profile.full_name ?? "";
      await notifyFamily(family.id, (locale) => {
        const t = createTranslator({ locale, messages: locale === "en" ? en : es, namespace: "push" });
        return { title: t("proposalTitle"), body: t("planProposalBody", { name, count: insert.length }), url: `/?date=${insert[0].date}`, tag: "proposal" };
      }, { role: "parent" });
    }
  }
  revalidatePath("/", "layout");
  return { added: insert.length, skipped: rows.length - insert.length + (entries.length - rows.length) };
}
