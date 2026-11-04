"use server";

import { revalidatePath } from "next/cache";
import { createTranslator } from "next-intl";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireMember } from "@/lib/session";
import { addDays, isValidDate, todayIn } from "@/lib/dates";
import { slotsFor } from "@/lib/meals";
import { notifyFamily } from "@/lib/push";
import { CustomRecipeSchema } from "@/lib/chef-drafts";
import { customToRecipeInput } from "@/lib/chef-custom";
import { parseRecipeInput } from "@/lib/recipe-form";
import { persistRecipe, recipeKcal } from "@/lib/recipe-save";
import { MAX_CUSTOM, MAX_DAYS_AHEAD, parseSlotKey, slotKey, type CustomRecipe } from "@/lib/chef";
import type { MealSlot } from "@/lib/types";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

// El turno del Chef (con sus pensamientos en vivo) va por POST /api/chef (src/app/api/chef/route.ts).

const Uuid = z.string().uuid();
const Key = z.string().regex(/^\d{4}-\d{2}-\d{2}\|[a-z_]+$/);

const ApplyInput = z.array(z.object({ key: Key, recipeId: Uuid })).min(1).max(70);
const CustomInput = z.record(Uuid, CustomRecipeSchema).refine((c) => Object.keys(c).length <= MAX_CUSTOM);

/**
 * Pasa el plan al calendario. Padres: comidas planificadas. Hijos: propuestas (los padres reciben un
 * solo aviso por todo el plan). Las franjas que mientras tanto se ocuparon se saltan.
 *
 * Las recetas nuevas que inventó el Chef (`custom`, por su id temporal) se guardan primero en
 * "Recetas" de la familia (solo las que de verdad van al calendario); `saved` dice el id real de cada una.
 */
export async function applyChefPlan(
  raw: { key: string; recipeId: string }[],
  rawCustom: Record<string, CustomRecipe> = {},
): Promise<{ added: number; skipped: number; saved: Record<string, string> }> {
  const session = await requireMember();
  const { supabase, family, user, isParent } = session;
  const entries = ApplyInput.parse(raw);
  const custom = CustomInput.parse(rawCustom) as Record<string, CustomRecipe>;
  const locale = (await getLocale()) === "en" ? "en" : "es";
  const today = todayIn(family.timezone);
  const slots = slotsFor(family.meals_per_day);

  const rows = entries
    .map((e) => ({ ...parseSlotKey(e.key), recipeId: e.recipeId }))
    .filter((e) => isValidDate(e.date) && e.date >= today && e.date <= addDays(today, MAX_DAYS_AHEAD) && slots.includes(e.slot as MealSlot));

  // Franjas ocupadas desde que se armó el plan.
  const dates = [...new Set(rows.map((r) => r.date))];
  const { data: taken } = await supabase.from("meals").select("date, slot").eq("family_id", family.id).in("date", dates).neq("status", "cancelled");
  const busy = new Set((taken ?? []).map((m) => slotKey(m.date as string, m.slot as MealSlot)));

  // Recetas nuevas que van a alguna franja libre: se guardan como recetas propias (con los mismos
  // controles que el formulario de recetas) y las franjas pasan a usar el id real.
  const saved: Record<string, string> = {};
  const toSave = [...new Set(rows.filter((r) => custom[r.recipeId] && !busy.has(slotKey(r.date, r.slot))).map((r) => r.recipeId))];
  for (const tempId of toSave) {
    const r = custom[tempId];
    const parsed = parseRecipeInput(customToRecipeInput(r, locale));
    if (!parsed.ok) continue;
    const kcal = await recipeKcal(supabase, parsed.data);
    if (!kcal.ok) continue;
    const description = r.description.trim() || null;
    const res = await persistRecipe(
      supabase,
      parsed.data,
      { name_es: r.name_es, name_en: r.name_en, description_es: description, description_en: description, steps_es: parsed.data.steps, steps_en: parsed.data.steps },
      kcal.kcal,
    );
    if (res.ok) saved[tempId] = res.id;
    else console.warn("chef custom recipe not saved:", res.error);
  }
  for (const r of rows) if (saved[r.recipeId]) r.recipeId = saved[r.recipeId];

  // Recetas visibles para el usuario (RLS).
  const ids = [...new Set(rows.map((r) => r.recipeId))];
  const { data: visible } = await supabase.from("recipes").select("id").in("id", ids);
  const ok = new Set((visible ?? []).map((r) => r.id as string));
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
  return { added: insert.length, skipped: rows.length - insert.length + (entries.length - rows.length), saved };
}
