import "server-only";
import { createTranslator } from "next-intl";
import { z } from "zod";
import type { requireMember } from "@/lib/session";
import { addDays, isValidDate, todayIn } from "@/lib/dates";
import { slotsFor } from "@/lib/meals";
import { loadMyTarget } from "@/lib/my-target";
import { loadChefData } from "@/lib/chef-data";
import { askChef, type ChefStep } from "@/lib/chef-ai";
import { CustomRecipeSchema } from "@/lib/chef-drafts";
import { MAX_NEW_PER_TURN, customDish, foodLookup, parseNewRecipe } from "@/lib/chef-custom";
import {
  GOALS, MAX_CUSTOM, MAX_DAYS_AHEAD, PREFS, SCOPES, dayTargets, fallbackPlan, goalsFor, parseSlotKey, sanitizeReply, scopeDates,
  type ChefReply, type CustomDish, type CustomRecipe, type Plan, type SlotKey,
} from "@/lib/chef";
import es from "../../messages/es.json";
import en from "../../messages/en.json";

const MAX_HISTORY = 16;
const MAX_TEXT = 2000;

/** Mensajes que piden armar un plan (para usar el plan de respaldo si la IA falla). */
const PLAN_REQUEST = /\b(arma|armar|armame|ármame|planifica|plan|men[uú]|semana|build|make|create|week|meal plan)\b/i;

const Uuid = z.string().uuid();
const Key = z.string().regex(/^\d{4}-\d{2}-\d{2}\|[a-z_]+$/);

export const TurnInput = z.object({
  intent: z.enum(["build", "message"]),
  prefs: z.object({
    goal: z.enum(GOALS),
    scope: z.enum(SCOPES),
    prefs: z.array(z.enum(PREFS)).max(PREFS.length),
    start: z.string().refine(isValidDate),
  }),
  history: z.array(z.object({ role: z.enum(["user", "model"]), text: z.string().max(4000) })).max(80),
  plan: z.record(Key, z.object({ recipeId: Uuid, reason: z.string().max(200).optional() })),
  liked: z.array(Uuid).max(60),
  disliked: z.array(Uuid).max(60),
  /** Recetas nuevas del borrador (solo la receta: la tarjeta la recalcula el servidor). */
  custom: z.record(Uuid, CustomRecipeSchema).refine((c) => Object.keys(c).length <= MAX_CUSTOM).optional(),
});
export type ChefTurnInput = z.input<typeof TurnInput>;

/** Lo que el servidor va contando mientras el Chef trabaja (una línea JSON por evento). */
export type ChefEvent =
  | { type: "step"; text: string }
  | { type: "thinking"; text: string }
  | { type: "reply"; reply: ChefReply }
  | { type: "error" };

type Member = Pick<Awaited<ReturnType<typeof requireMember>>, "supabase" | "family" | "user" | "profile">;

/**
 * Un turno del Chef IA: arma el plan ("build") o responde a un mensaje, contando por `emit` lo que va
 * haciendo (pasos y razonamiento del modelo). Si la IA no está disponible o falla, "build" usa el plan
 * de respaldo (src/lib/chef.ts) para que la pantalla siga sirviendo.
 */
export async function runChefTurn(session: Member, raw: unknown, locale: "es" | "en", emit: (e: ChefEvent) => void = () => {}): Promise<ChefReply> {
  const { supabase, family, user, profile } = session;
  const input = TurnInput.parse(raw);
  const t = createTranslator({ locale, messages: locale === "en" ? en : es, namespace: "chef" });
  const step = (text: string) => emit({ type: "step", text });

  const today = todayIn(family.timezone);
  const [{ cards, busy, foods, inventory }, target] = await Promise.all([
    loadChefData(supabase, family.id, today, locale, true),
    loadMyTarget(supabase, user.id, family.timezone),
  ]);
  const minor = !!target.minor;
  const goal = goalsFor(minor).includes(input.prefs.goal) ? input.prefs.goal : "healthy";
  const prefs = { ...input.prefs, goal };
  const dates = scopeDates(prefs.scope, today, input.prefs.start <= addDays(today, MAX_DAYS_AHEAD - 7) ? input.prefs.start : today);
  const slots = slotsFor(family.meals_per_day);

  // Recetas nuevas del borrador: la tarjeta (kcal, macros, en casa) se recalcula aquí, nunca se confía en el cliente.
  const foodsById = new Map(foods.map((f) => [f.id, f]));
  const dishCtx = { foods: foodsById, inventory, today };
  const custom: CustomDish[] = Object.entries(input.custom ?? {})
    .map(([id, r]) => customDish(id, r as CustomRecipe, dishCtx))
    .filter((d): d is CustomDish => !!d);
  const cardMap = new Map([...cards, ...custom.map((d) => d.card)].map((c) => [c.id, c]));

  // Solo se conservan del borrador las recetas que el usuario puede ver (o las nuevas que siguen siendo válidas).
  const plan: Plan = Object.fromEntries(Object.entries(input.plan).filter(([, e]) => cardMap.has(e.recipeId))) as Plan;
  const inScopeBusy = [...busy.entries()].filter(([k]) => dates.includes(parseSlotKey(k).date));

  const history = input.history
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, text: m.text.slice(0, m.role === "user" ? MAX_TEXT : 2400) }));
  if (input.intent === "build") history.push({ role: "user", text: t("buildPrompt") });
  if (!history.length || history[history.length - 1].role !== "user") throw new Error("invalid");

  step(t("steps.context", { count: cards.length }));
  const seen = new Set<string>();
  const onStep = (s: ChefStep) => {
    const text =
      s.kind === "search" ? t("steps.search", { query: s.query }) : s.kind === "read" ? t("steps.read", { count: s.count }) : t("steps.answer");
    // El modelo puede empezar a responder más de una vez (reintentos): el paso se muestra una sola vez.
    if (s.kind === "answer" && seen.has(text)) return;
    seen.add(text);
    step(text);
  };

  const ctx = { cards: cardMap, slots, dates: new Set(dates), busy: new Set<string>(busy.keys()) };
  try {
    const { raw: rawReply, searched } = await askChef(
      {
        locale, name: profile.full_name?.split(" ")[0] ?? "", today, prefs, targets: dayTargets(target.kcal, goal), minor,
        weightKg: target.weightKg ?? null, goalKg: target.goalKg ?? null, mealsPerDay: family.meals_per_day, slots, dates,
        cards, plan, busy: inScopeBusy.map(([key, name]) => ({ key, name })), liked: input.liked, disliked: input.disliked,
        foods, custom,
      },
      history,
      { onStep, onReasoning: (text) => emit({ type: "thinking", text }) },
    );

    // Recetas que inventó: se validan, se asocian a alimentos reales y se les calculan kcal y macros.
    const find = foodLookup(foods);
    const newDishes = (rawReply.new_recipes ?? []).slice(0, MAX_NEW_PER_TURN).flatMap((r) => {
      const recipe = parseNewRecipe(r, foods, find);
      const dish = recipe && customDish(crypto.randomUUID(), recipe, dishCtx);
      if (!dish) {
        console.warn("chef new recipe rejected:", JSON.stringify(r).slice(0, 400));
        return [];
      }
      return [{ ref: typeof r.ref === "string" ? r.ref : "", dish }];
    });

    const reply = sanitizeReply(rawReply, { ...ctx, newDishes }, searched);
    for (const d of reply.custom) step(t("steps.recipe", { name: locale === "en" ? d.recipe.name_en : d.recipe.name_es }));
    if (reply.message || reply.changes.length || reply.alternatives) return reply;
    console.error("chef empty reply:", JSON.stringify(rawReply).slice(0, 800));
    throw new Error("empty chef reply");
  } catch (e) {
    console.error("chef", e);
    // Sin IA: si se pidió armar el plan (o se escribió algo como "arma mi semana" con el plan vacío),
    // igual se arma un plan base; si no, se avisa que el Chef no está disponible.
    const scopedEmpty = !Object.keys(plan).some((k) => dates.includes(parseSlotKey(k).date));
    const wantsPlan = input.intent === "build" || (scopedEmpty && PLAN_REQUEST.test(history[history.length - 1].text));
    if (!wantsPlan) return { message: t("offlineMessage"), sources: [], quickReplies: [], changes: [], alternatives: null, custom: [], offline: true };
    const next = fallbackPlan({
      cards, dates, slots, goal, prefs: prefs.prefs, liked: input.liked, disliked: input.disliked,
      busy: inScopeBusy.map(([k]) => k), plan,
    });
    const changes = (Object.keys(next) as SlotKey[]).filter((k) => next[k]?.recipeId !== plan[k]?.recipeId).map((key) => ({ key, recipeId: next[key]!.recipeId }));
    return { message: t("offlineBuilt"), sources: [], quickReplies: [], changes, alternatives: null, custom: [], offline: true };
  }
}
