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
import { MAX_CUSTOM, MAX_DAYS_AHEAD, calendarOps, parseSlotKey, slotKey, type CalendarMeal, type CustomRecipe, type SlotKey } from "@/lib/chef";
import type { MealSlot } from "@/lib/types";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

// El turno del Chef (con sus pensamientos en vivo) va por POST /api/chef (src/app/api/chef/route.ts).

const Uuid = z.string().uuid();
const Key = z.string().regex(/^\d{4}-\d{2}-\d{2}\|[a-z_]+$/);

const ApplyInput = z.array(z.object({ key: Key, recipeId: Uuid })).min(1).max(70);
const CustomInput = z.record(Uuid, CustomRecipeSchema).refine((c) => Object.keys(c).length <= MAX_CUSTOM);
const CalendarInput = z.array(z.object({ key: Key, recipeId: Uuid.nullable(), mealIds: z.array(Uuid).max(10) })).min(1).max(70);

type Session = Awaited<ReturnType<typeof requireMember>>;
type Row = { date: string; slot: MealSlot; recipeId: string };

/** Franjas válidas: fechas desde hoy hasta donde llega el calendario, y franjas que la familia usa. */
function inRange(session: Session, date: string, slot: string) {
  const today = todayIn(session.family.timezone);
  return isValidDate(date) && date >= today && date <= addDays(today, MAX_DAYS_AHEAD) && slotsFor(session.family.meals_per_day).includes(slot as MealSlot);
}

/**
 * Guarda en "Recetas" de la familia las recetas nuevas del Chef que se van a usar (con los mismos
 * controles que el formulario de recetas). Devuelve id temporal → id real de las que se guardaron.
 */
async function saveCustomRecipes(session: Session, ids: string[], custom: Record<string, CustomRecipe>) {
  const locale = (await getLocale()) === "en" ? "en" : "es";
  const saved: Record<string, string> = {};
  for (const tempId of [...new Set(ids)].filter((id) => custom[id])) {
    const r = custom[tempId];
    const parsed = parseRecipeInput(customToRecipeInput(r, locale));
    if (!parsed.ok) continue;
    const kcal = await recipeKcal(session.supabase, parsed.data);
    if (!kcal.ok) continue;
    const description = r.description.trim() || null;
    const res = await persistRecipe(
      session.supabase,
      parsed.data,
      { name_es: r.name_es, name_en: r.name_en, description_es: description, description_en: description, steps_es: parsed.data.steps, steps_en: parsed.data.steps },
      kcal.kcal,
    );
    if (res.ok) saved[tempId] = res.id;
    else console.warn("chef custom recipe not saved:", res.error);
  }
  return saved;
}

/**
 * Agrega comidas al calendario (una por franja, solo recetas que el usuario ve). Padres: planificadas.
 * Hijos: propuestas, con un solo aviso a los padres. Devuelve las que se agregaron.
 */
async function insertMeals(session: Session, rows: Row[]): Promise<Row[]> {
  const { supabase, family, user, isParent } = session;
  if (!rows.length) return [];
  const { data: visible } = await supabase.from("recipes").select("id").in("id", [...new Set(rows.map((r) => r.recipeId))]);
  const ok = new Set((visible ?? []).map((r) => r.id as string));
  const seen = new Set<string>();
  const insert = rows.filter((r) => {
    const key = slotKey(r.date, r.slot);
    if (!ok.has(r.recipeId) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!insert.length) return [];
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
  return insert;
}


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
  const entries = ApplyInput.parse(raw);
  const custom = CustomInput.parse(rawCustom) as Record<string, CustomRecipe>;
  const rows: Row[] = entries.map((e) => ({ ...parseSlotKey(e.key), recipeId: e.recipeId })).filter((e) => inRange(session, e.date, e.slot));

  // Franjas ocupadas desde que se armó el plan.
  const dates = [...new Set(rows.map((r) => r.date))];
  const { data: taken } = await session.supabase
    .from("meals")
    .select("date, slot")
    .eq("family_id", session.family.id)
    .in("date", dates)
    .neq("status", "cancelled");
  const busy = new Set((taken ?? []).map((m) => slotKey(m.date as string, m.slot as MealSlot)));
  const free = rows.filter((r) => !busy.has(slotKey(r.date, r.slot)));

  // Recetas nuevas que van a alguna franja libre: se guardan y las franjas pasan a usar el id real.
  const saved = await saveCustomRecipes(session, free.map((r) => r.recipeId), custom);
  const inserted = await insertMeals(session, free.map((r) => ({ ...r, recipeId: saved[r.recipeId] ?? r.recipeId })));
  revalidatePath("/", "layout");
  return { added: inserted.length, skipped: entries.length - inserted.length, saved };
}

/**
 * Aplica los cambios que el Chef propuso a comidas que ya están en el calendario (la persona los
 * confirmó). Por franja: se quita lo que había (sueltas se borran; las de una comida que se repite se
 * cancelan solo ese día) y se pone el plato nuevo. Si la franja cambió desde la propuesta, se salta.
 * Hijos: no pueden quitar comidas; los platos nuevos se envían como propuestas a sus padres.
 */
export async function applyCalendarChanges(
  raw: { key: string; recipeId: string | null; mealIds: string[] }[],
  rawCustom: Record<string, CustomRecipe> = {},
): Promise<{ applied: number; skipped: number; saved: Record<string, string> }> {
  const session = await requireMember();
  const { supabase, family, isParent } = session;
  const changes = CalendarInput.parse(raw).filter((c) => {
    const { date, slot } = parseSlotKey(c.key);
    return inRange(session, date, slot);
  });
  const custom = CustomInput.parse(rawCustom) as Record<string, CustomRecipe>;

  // Cómo está el calendario ahora en esas franjas.
  const dates = [...new Set(changes.map((c) => parseSlotKey(c.key).date))];
  const { data: rows } = await supabase
    .from("meals")
    .select("id, date, slot, status, series_id, recipe_id")
    .eq("family_id", family.id)
    .in("date", dates)
    .neq("status", "cancelled");
  const now = new Map<string, CalendarMeal[]>();
  for (const m of (rows ?? []) as { id: string; date: string; slot: MealSlot; status: CalendarMeal["status"]; series_id: string | null; recipe_id: string | null }[]) {
    const key = slotKey(m.date, m.slot);
    now.set(key, [...(now.get(key) ?? []), { id: m.id, name: "", status: m.status, seriesId: m.series_id, recipeId: m.recipe_id }]);
  }

  const ops = calendarOps(changes.map((c) => ({ ...c, key: c.key as SlotKey, before: "" })), now);
  // Hijos: solo proponen platos (no pueden quitar ni cancelar comidas).
  const insert = ops.insert;
  const kidsSkipped = isParent ? 0 : changes.length - ops.skipped.length - insert.length;

  const saved = await saveCustomRecipes(session, insert.map((i) => i.recipeId), custom);
  if (isParent) {
    if (ops.remove.length) {
      const { error } = await supabase.from("meals").delete().eq("family_id", family.id).in("id", ops.remove);
      if (error) throw new Error(error.message);
    }
    if (ops.cancel.length) {
      // Como "eliminar solo esta" en el calendario: la serie no la vuelve a generar.
      const { error } = await supabase.from("meals").update({ status: "cancelled", is_exception: true }).eq("family_id", family.id).in("id", ops.cancel);
      if (error) throw new Error(error.message);
    }
  }
  const inserted = await insertMeals(
    session,
    insert.map((i) => ({ ...parseSlotKey(i.key), recipeId: saved[i.recipeId] ?? i.recipeId })),
  );
  revalidatePath("/", "layout");
  const removedOnly = isParent ? changes.length - ops.skipped.length - insert.length : 0;
  const applied = inserted.length + removedOnly;
  return { applied, skipped: ops.skipped.length + kidsSkipped + (insert.length - inserted.length), saved };
}
