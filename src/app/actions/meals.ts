"use server";

import { revalidatePath } from "next/cache";
import { createTranslator } from "next-intl";
import { requireMember, requireParent } from "@/lib/session";
import { materializeSeries } from "@/lib/calendar";
import { addDays, isValidDate, todayIn } from "@/lib/dates";
import { ALL_SLOTS, MATERIALIZE_DAYS, RECURRENCES } from "@/lib/meals";
import { notifyFamily } from "@/lib/push";
import { loadMealItems } from "@/lib/meal-items";
import { convert, formatQuantity, UNITS } from "@/lib/units";
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
    // Si cambia la receta, los ingredientes editados de la recurrencia ya no aplican.
    const recipeChanged = recipe_id !== series.recipe_id;
    if (recipeChanged) await supabase.from("meal_items").delete().eq("series_id", series.id);
    await supabase.from("meal_series").update({
      recipe_id, title, slot: input.slot, recurrence, materialized_until: addDays(from, -1),
      ...(recipeChanged ? { custom_items: false } : {}),
    }).eq("id", series.id);
    await materializeSeries(family.id, addDays(today, MATERIALIZE_DAYS));
  } else {
    // Si cambia la receta, los ingredientes editados de esta comida ya no aplican.
    const recipeChanged = recipe_id !== meal.recipe_id && meal.custom_items;
    if (recipeChanged) await supabase.from("meal_items").delete().eq("meal_id", id);
    const { error } = await supabase.from("meals").update({
      date: input.date, slot: input.slot, recipe_id, title, is_exception: !!meal.series_id,
      ...(recipeChanged ? { custom_items: false } : {}),
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

export type MealItemInput = { food_id: string; quantity: number | null; unit: Unit | null; optional?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cambia los ingredientes de una comida (quitar, cambiar porción, agregar alimentos)
 * o de toda su recurrencia. `items = null` vuelve a los ingredientes por defecto.
 */
export async function setMealItems(id: string, items: MealItemInput[] | null, scope: Scope) {
  const { supabase, family } = await requireParent();
  const { data: meal } = await supabase.from("meals").select("*").eq("id", id).single();
  if (!meal || meal.status === "completed" || meal.status === "cancelled") throw new Error("invalid");

  // Limpia la lista: sin duplicados, cantidades positivas y unidades válidas.
  let rows: { food_id: string; quantity: number | null; unit: Unit | null; optional: boolean; position: number }[] | null = null;
  if (items) {
    const byFood = new Map<string, MealItemInput>();
    for (const it of items.slice(0, 80)) if (typeof it?.food_id === "string" && UUID.test(it.food_id)) byFood.set(it.food_id, it);
    // Solo alimentos que la familia puede ver (catálogo global o propios).
    const { data: foods } = byFood.size
      ? await supabase.from("foods").select("id").in("id", [...byFood.keys()])
      : { data: [] as { id: string }[] };
    const visible = new Set(((foods ?? []) as { id: string }[]).map((f) => f.id));
    rows = [...byFood.values()].filter((it) => visible.has(it.food_id)).map((it, position) => {
      const q = Number(it.quantity);
      const quantity = it.quantity !== null && Number.isFinite(q) && q > 0 ? +q.toFixed(3) : null;
      const unit: Unit | null = quantity === null ? null : it.unit && UNITS.includes(it.unit) ? it.unit : "unit";
      return { food_id: it.food_id, quantity, unit, optional: !!it.optional, position };
    });
  }

  const { data: series } = scope === "series" && meal.series_id
    ? await supabase.from("meal_series").select("id, recipe_id").eq("id", meal.series_id).single()
    : { data: null };

  // Si esta comida ya tiene otra receta que la recurrencia, el cambio aplica solo a ella.
  if (series && series.recipe_id === meal.recipe_id) {
    await supabase.from("meal_items").delete().eq("series_id", series.id);
    if (rows?.length) {
      const { error } = await supabase.from("meal_items").insert(rows.map((r) => ({ ...r, family_id: family.id, series_id: series.id })));
      if (error) throw new Error(error.message);
    }
    const { error } = await supabase.from("meal_series").update({ custom_items: rows !== null }).eq("id", series.id);
    if (error) throw new Error(error.message);
    // Esta comida pasa a seguir a la recurrencia.
    if (meal.custom_items) {
      await supabase.from("meal_items").delete().eq("meal_id", id);
      await supabase.from("meals").update({ custom_items: false }).eq("id", id);
    }
  } else {
    await supabase.from("meal_items").delete().eq("meal_id", id);
    if (rows?.length) {
      const { error } = await supabase.from("meal_items").insert(rows.map((r) => ({ ...r, family_id: family.id, meal_id: id })));
      if (error) throw new Error(error.message);
    }
    // En una serie se marca como excepción para que no se regenere y pierda los cambios.
    const { error } = await supabase.from("meals").update({
      custom_items: rows !== null,
      is_exception: meal.is_exception || (!!meal.series_id && rows !== null),
    }).eq("id", id);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/", "layout");
}

export type CompletionReport = { used: { name: string; amount: string }[]; missing: string[]; short: string[] };

/**
 * Marca la comida como completada y descuenta del inventario sus ingredientes
 * (los editados, si los hay). Nunca falla ni deja stock negativo por falta de
 * inventario: se descuenta solo lo que hay y lo que falta se informa.
 */
export async function completeMeal(id: string, locale: string): Promise<CompletionReport> {
  const { supabase, user } = await requireParent();
  const { data: meal } = await supabase.from("meals").select("*").eq("id", id).single();
  if (!meal || meal.status === "completed" || meal.status === "cancelled") throw new Error("invalid");

  const report: CompletionReport = { used: [], missing: [], short: [] };
  const { source, items: ingredients } = await loadMealItems(supabase, id);

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
      // Sin cantidad ("al gusto"): no se descuenta nada.
      if (!ing.quantity || !ing.unit) continue;

      // Descuenta primero de lo que vence antes, sin pasar de lo que hay.
      let remaining = ing.quantity;
      for (const item of stock) {
        if (remaining <= 1e-9) break;
        const needed = convert(remaining, ing.unit, item.unit);
        if (needed === null) continue;
        const take = Math.min(item.quantity, needed);
        if (take <= 0) continue;
        item.quantity = Math.max(0, +(item.quantity - take).toFixed(3));
        remaining -= convert(take, item.unit, ing.unit) ?? 0;
        if (item.quantity <= 0) await supabase.from("inventory_items").delete().eq("id", item.id);
        else await supabase.from("inventory_items").update({ quantity: item.quantity, updated_at: new Date().toISOString() }).eq("id", item.id);
      }
      remaining = Math.max(0, remaining);
      const used = ing.quantity - remaining;
      if (used > 1e-9) report.used.push({ name, amount: `${formatQuantity(+used.toFixed(2))} ${ing.unit}` });
      // No alcanzó (o estaba en una unidad no convertible).
      if (remaining > 1e-6 && !ing.optional) (used > 1e-9 ? report.short : report.missing).push(name);
    }
  }

  // Se guarda qué ingredientes llevaba la comida al completarse, para que el historial
  // no cambie si luego se edita la receta o la recurrencia.
  if (source === "recipe" || source === "series") {
    await supabase.from("meal_items").delete().eq("meal_id", id);
    if (ingredients.length) {
      await supabase.from("meal_items").insert(ingredients.map((ing, position) => ({
        family_id: meal.family_id, meal_id: id, food_id: ing.food_id,
        quantity: ing.quantity, unit: ing.unit, optional: ing.optional, position,
      })));
    }
  }

  const { error } = await supabase.from("meals").update({
    status: "completed", completed_by: user.id, completed_at: new Date().toISOString(), is_exception: !!meal.series_id,
    custom_items: meal.custom_items || source === "recipe" || source === "series",
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  return report;
}
