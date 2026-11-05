import type { SupabaseClient } from "@supabase/supabase-js";
import { mealCost, recipeCost, type Cost, type CostItem, type PriceMap } from "./cost";

/** Lo mínimo de una comida para saber su costo. */
export type CostMeal = {
  id: string;
  recipe_id: string | null;
  series_id: string | null;
  custom_items?: boolean;
  portion_scale?: number | null;
  recipe?: { servings: number } | null;
};

const ITEM_COLS = "food_id, quantity, unit, optional, food:foods(g_per_unit, g_per_ml)";
type ItemRow = CostItem & { meal_id?: string | null; series_id?: string | null; recipe_id?: string };

/**
 * Costo de varias comidas de una vez, con sus ingredientes efectivos (los mismos que src/lib/meal-items.ts:
 * los editados para la comida, los editados para su recurrencia o los de la receta) y su multiplicador de
 * porciones. Las comidas sin receta no tienen costo. Pocas consultas para toda la semana.
 */
export async function loadMealCosts(supabase: SupabaseClient, meals: CostMeal[], prices: PriceMap): Promise<Map<string, Cost>> {
  const out = new Map<string, Cost>();
  const withRecipe = meals.filter((m) => m.recipe_id && m.recipe);
  if (!prices.size || !withRecipe.length) return out;

  const custom = withRecipe.filter((m) => m.custom_items).map((m) => m.id);
  const seriesIds = [...new Set(withRecipe.filter((m) => !m.custom_items && m.series_id).map((m) => m.series_id!))];
  const [{ data: series }, { data: mealRows }] = await Promise.all([
    seriesIds.length
      ? supabase.from("meal_series").select("id, recipe_id, custom_items").in("id", seriesIds)
      : Promise.resolve({ data: [] as { id: string; recipe_id: string | null; custom_items: boolean }[] }),
    custom.length ? supabase.from("meal_items").select(`meal_id, ${ITEM_COLS}`).in("meal_id", custom) : Promise.resolve({ data: [] }),
  ]);
  const seriesById = new Map((series ?? []).map((s) => [s.id as string, s as { recipe_id: string | null; custom_items: boolean }]));
  const usesSeries = (m: CostMeal) => {
    const s = m.series_id ? seriesById.get(m.series_id) : undefined;
    return !m.custom_items && !!s?.custom_items && s.recipe_id === m.recipe_id;
  };
  const customSeries = [...new Set(withRecipe.filter(usesSeries).map((m) => m.series_id!))];
  const recipeIds = [...new Set(withRecipe.filter((m) => !m.custom_items && !usesSeries(m)).map((m) => m.recipe_id!))];
  const [{ data: seriesRows }, { data: recipeRows }] = await Promise.all([
    customSeries.length ? supabase.from("meal_items").select(`series_id, ${ITEM_COLS}`).in("series_id", customSeries) : Promise.resolve({ data: [] }),
    recipeIds.length ? supabase.from("recipe_ingredients").select(`recipe_id, ${ITEM_COLS}`).in("recipe_id", recipeIds) : Promise.resolve({ data: [] }),
  ]);

  const group = (rows: unknown, key: "meal_id" | "series_id" | "recipe_id") => {
    const map = new Map<string, CostItem[]>();
    for (const r of (rows ?? []) as ItemRow[]) {
      const k = r[key];
      if (!k || !r.food) continue;
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return map;
  };
  const byMeal = group(mealRows, "meal_id");
  const bySeries = group(seriesRows, "series_id");
  const byRecipe = group(recipeRows, "recipe_id");

  for (const m of withRecipe) {
    const items = m.custom_items ? byMeal.get(m.id) : usesSeries(m) ? bySeries.get(m.series_id!) : byRecipe.get(m.recipe_id!);
    out.set(m.id, mealCost(recipeCost(items ?? [], prices, m.recipe!.servings), Number(m.portion_scale) || 1));
  }
  return out;
}

/** Para pasar a un componente cliente: id de la comida → costo. */
export function costsRecord(costs: Map<string, Cost>): Record<string, Pick<Cost, "total" | "complete">> {
  return Object.fromEntries([...costs].map(([id, c]) => [id, { total: c.total, complete: c.complete }]));
}
