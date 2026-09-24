import type { SupabaseClient } from "@supabase/supabase-js";
import { convert } from "./units";
import type { Food, Unit } from "./types";

/** Ingrediente de una comida concreta (de la receta o editado por la familia). */
export type MealItem = {
  food_id: string;
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
  food: Pick<Food, "id" | "name_es" | "name_en" | "emoji" | "image_url" | "default_unit" | "category">;
};

/** De dónde salen los ingredientes: la receta, la comida editada o la recurrencia editada. */
export type MealItemsSource = "recipe" | "meal" | "series" | "none";

const FOOD_COLS = "food:foods(id, name_es, name_en, emoji, image_url, default_unit, category)";
const ITEM_COLS = `food_id, quantity, unit, optional, ${FOOD_COLS}`;

type MealRow = {
  id: string;
  recipe_id: string | null;
  series_id: string | null;
  custom_items: boolean;
  series: { recipe_id: string | null; custom_items: boolean } | null;
};

/**
 * Ingredientes efectivos de una comida:
 *   1. los editados para esta comida,
 *   2. los editados para toda su recurrencia (si sigue siendo la misma receta),
 *   3. los de la receta.
 * Funciona con el cliente del navegador o del servidor (respeta RLS).
 */
export async function loadMealItems(supabase: SupabaseClient, mealId: string): Promise<{ source: MealItemsSource; items: MealItem[] }> {
  const { data, error } = await supabase
    .from("meals")
    .select("id, recipe_id, series_id, custom_items, series:meal_series(recipe_id, custom_items)")
    .eq("id", mealId)
    .single();
  let meal = data as MealRow | null;
  if (error && !data) {
    // Sin la migración de ingredientes editables: se usan los de la receta.
    const { data: basic } = await supabase.from("meals").select("id, recipe_id, series_id").eq("id", mealId).single();
    meal = basic ? { ...(basic as Omit<MealRow, "custom_items" | "series">), custom_items: false, series: null } : null;
  }
  if (!meal) return { source: "none", items: [] };

  if (meal.custom_items) {
    const { data: rows } = await supabase.from("meal_items").select(ITEM_COLS).eq("meal_id", meal.id).order("position");
    return { source: "meal", items: clean(rows) };
  }
  if (meal.series_id && meal.series?.custom_items && meal.series.recipe_id === meal.recipe_id) {
    const { data: rows } = await supabase.from("meal_items").select(ITEM_COLS).eq("series_id", meal.series_id).order("position");
    return { source: "series", items: clean(rows) };
  }
  if (meal.recipe_id) {
    const { data: rows } = await supabase.from("recipe_ingredients").select(ITEM_COLS).eq("recipe_id", meal.recipe_id);
    // Primero los obligatorios, igual que en la página de la receta.
    return { source: "recipe", items: clean(rows).sort((a, b) => Number(a.optional) - Number(b.optional)) };
  }
  return { source: "none", items: [] };
}

function clean(rows: unknown): MealItem[] {
  return ((rows ?? []) as MealItem[]).filter((r) => r.food);
}

type StockRow = { food_id: string | null; quantity: number; unit: Unit };

/**
 * Cuánto hay en el inventario de cada alimento, expresado en la unidad del ingrediente.
 * `null` si hay stock pero en una unidad no convertible (ej. "unid." vs "g").
 */
export function stockFor(item: Pick<MealItem, "food_id" | "unit">, inventory: StockRow[]): { has: boolean; amount: number | null } {
  const rows = inventory.filter((i) => i.food_id === item.food_id && i.quantity > 0);
  if (!rows.length) return { has: false, amount: 0 };
  if (!item.unit) return { has: true, amount: null };
  let amount = 0;
  let comparable = false;
  for (const r of rows) {
    const q = convert(r.quantity, r.unit, item.unit);
    if (q !== null) {
      amount += q;
      comparable = true;
    }
  }
  return { has: true, amount: comparable ? +amount.toFixed(3) : null };
}
