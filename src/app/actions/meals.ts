"use server";

import { revalidatePath } from "next/cache";
import { createTranslator } from "next-intl";
import { requireMember, requireParent } from "@/lib/session";
import { materializeSeries } from "@/lib/calendar";
import { addDays, isValidDate, todayIn } from "@/lib/dates";
import { ALL_SLOTS, MATERIALIZE_DAYS, RECURRENCES } from "@/lib/meals";
import { notifyFamily } from "@/lib/push";
import { convert, formatQuantity } from "@/lib/units";
import type { InventoryItem, MealSlot, Recurrence, Unit } from "@/lib/types";
import es from "../../../messages/es.json";
import en from "../../../messages/en.json";

export type MealInput = {
  date: string;
  slot: MealSlot;
  recipe_id?: string | null;
  title?: string | null;
  recurrence?: Recurrence | null;
};

export type Scope = "one" | "series";

function validate(input: MealInput) {
  if (!isValidDate(input.date) || !ALL_SLOTS.includes(input.slot)) throw new Error("invalid");
  const title = input.title?.trim().slice(0, 80) || null;
  if (!input.recipe_id && !title) throw new Error("invalid");
  if (input.recurrence && !RECURRENCES.includes(input.recurrence)) throw new Error("invalid");
  return { recipe_id: input.recipe_id || null, title: input.recipe_id ? null : title };
}

/** Padres: agrega una comida (única o recurrente). Hijos: la proponen. */
export async function addMeal(input: MealInput) {
  const session = await requireMember();
  const { supabase, family, user, isParent } = session;
  const { recipe_id, title } = validate(input);

  if (!isParent) {
    const { error } = await supabase.from("meals").insert({
      family_id: family.id, date: input.date, slot: input.slot, recipe_id, title,
      status: "proposed", proposed_by: user.id,
    });
    if (error) throw new Error(error.message);

    const name = session.profile.full_name ?? "";
    await notifyFamily(family.id, (locale) => {
      const t = createTranslator({ locale, messages: locale === "en" ? en : es, namespace: "push" });
      return { title: t("proposalTitle"), body: t("proposalBody", { name }), url: `/calendar?date=${input.date}`, tag: "proposal" };
    }, { role: "parent" });
  } else if (input.recurrence) {
    const { data: series, error } = await supabase.from("meal_series").insert({
      family_id: family.id, recipe_id, title, slot: input.slot, recurrence: input.recurrence,
      start_date: input.date, materialized_until: addDays(input.date, -1), created_by: user.id,
    }).select().single();
    if (error || !series) throw new Error(error?.message ?? "error");
    await materializeSeries(family.id, addDays(todayIn(family.timezone), MATERIALIZE_DAYS));
  } else {
    const { error } = await supabase.from("meals").insert({
      family_id: family.id, date: input.date, slot: input.slot, recipe_id, title, status: "planned",
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/", "layout");
}

/** Edita una comida o toda su recurrencia (desde hoy en adelante). */
export async function updateMeal(id: string, input: MealInput, scope: Scope) {
  const { supabase, family } = await requireParent();
  const { recipe_id, title } = validate(input);
  const { data: meal } = await supabase.from("meals").select("*").eq("id", id).single();
  if (!meal) throw new Error("not found");

  if (scope === "series" && meal.series_id) {
    const today = todayIn(family.timezone);
    const { data: series } = await supabase.from("meal_series").select("*").eq("id", meal.series_id).single();
    if (!series) throw new Error("not found");
    const recurrence = input.recurrence && RECURRENCES.includes(input.recurrence) ? input.recurrence : series.recurrence;

    // Se regeneran las ocurrencias futuras con los nuevos datos.
    const from = series.start_date > today ? series.start_date : today;
    await supabase.from("meals").delete()
      .eq("series_id", series.id).gte("date", from).eq("status", "planned").eq("is_exception", false);
    await supabase.from("meal_series").update({
      recipe_id, title, slot: input.slot, recurrence, materialized_until: addDays(from, -1),
    }).eq("id", series.id);
    await materializeSeries(family.id, addDays(today, MATERIALIZE_DAYS));
  } else {
    const { error } = await supabase.from("meals").update({
      date: input.date, slot: input.slot, recipe_id, title, is_exception: !!meal.series_id,
    }).eq("id", id);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/", "layout");
}

/** Elimina una comida o termina su recurrencia. */
export async function deleteMeal(id: string, scope: Scope) {
  const { supabase, family } = await requireParent();
  const { data: meal } = await supabase.from("meals").select("*").eq("id", id).single();
  if (!meal) return;

  if (scope === "series" && meal.series_id) {
    const today = todayIn(family.timezone);
    const from = meal.date < today ? today : meal.date;
    await supabase.from("meals").delete().eq("series_id", meal.series_id).gte("date", from).neq("status", "completed");
    await supabase.from("meal_series").update({ end_date: addDays(from, -1) }).eq("id", meal.series_id);
  } else if (meal.series_id) {
    // Se marca como cancelada para que la serie no la vuelva a generar.
    await supabase.from("meals").update({ status: "cancelled", is_exception: true }).eq("id", id);
  } else {
    await supabase.from("meals").delete().eq("id", id);
  }
  revalidatePath("/", "layout");
}

export async function reviewProposal(id: string, accept: boolean) {
  const { supabase } = await requireParent();
  const { error } = accept
    ? await supabase.from("meals").update({ status: "planned" }).eq("id", id).eq("status", "proposed")
    : await supabase.from("meals").delete().eq("id", id).eq("status", "proposed");
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export type CompletionReport = { used: { name: string; amount: string }[]; missing: string[] };

/** Marca la comida como completada y descuenta los ingredientes del inventario. */
export async function completeMeal(id: string, locale: string): Promise<CompletionReport> {
  const { supabase, user } = await requireParent();
  const { data: meal } = await supabase
    .from("meals")
    .select("*, recipe:recipes(recipe_ingredients(food_id, quantity, unit, optional, food:foods(name_es, name_en)))")
    .eq("id", id)
    .single();
  if (!meal || meal.status === "completed") throw new Error("invalid");

  const report: CompletionReport = { used: [], missing: [] };
  const ingredients = (meal.recipe?.recipe_ingredients ?? []) as {
    food_id: string; quantity: number | null; unit: Unit | null; optional: boolean;
    food: { name_es: string; name_en: string };
  }[];

  if (ingredients.length) {
    const { data: items } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("family_id", meal.family_id)
      .in("food_id", ingredients.map((i) => i.food_id))
      .order("expires_on", { ascending: true, nullsFirst: false });

    for (const ing of ingredients) {
      const name = locale === "en" ? ing.food.name_en : ing.food.name_es;
      const stock = ((items ?? []) as InventoryItem[]).filter((i) => i.food_id === ing.food_id && i.quantity > 0);
      if (!stock.length) {
        if (!ing.optional) report.missing.push(name);
        continue;
      }
      if (!ing.quantity || !ing.unit) continue;

      // Descuenta primero de lo que vence antes.
      let remaining = ing.quantity;
      for (const item of stock) {
        if (remaining <= 0) break;
        const needed = convert(remaining, ing.unit, item.unit);
        if (needed === null) continue;
        const take = Math.min(item.quantity, needed);
        item.quantity = +(item.quantity - take).toFixed(3);
        remaining -= convert(take, item.unit, ing.unit) ?? 0;
        if (item.quantity <= 0) await supabase.from("inventory_items").delete().eq("id", item.id);
        else await supabase.from("inventory_items").update({ quantity: item.quantity, updated_at: new Date().toISOString() }).eq("id", item.id);
      }
      const used = ing.quantity - Math.max(0, remaining);
      if (used > 0) report.used.push({ name, amount: `${formatQuantity(+used.toFixed(2))} ${ing.unit}` });
    }
  }

  const { error } = await supabase.from("meals").update({
    status: "completed", completed_by: user.id, completed_at: new Date().toISOString(), is_exception: !!meal.series_id,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  return report;
}
