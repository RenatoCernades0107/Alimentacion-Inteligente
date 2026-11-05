/**
 * Costo de los platos y del plan: suma de sus ingredientes con los precios de la tienda de la familia.
 * Los precios vienen de la función food_prices de la base (S/ por kg de cada alimento: la tienda elegida,
 * si no la mediana de las otras tiendas, si no el estimado de supabase/data/prices.mjs).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { toGrams, type FoodNutrition } from "./nutrition";
import type { PriceStore, Unit } from "./types";

/** Precio en S/ por kg de cada alimento (por id). */
export type PriceMap = ReadonlyMap<string, number>;

export type CostItem = {
  food_id: string;
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
  food: Pick<FoodNutrition, "g_per_unit" | "g_per_ml">;
};

/** Precios de todos los alimentos visibles para la tienda de la familia. */
export async function loadPrices(supabase: SupabaseClient, store: PriceStore): Promise<PriceMap> {
  const { data, error } = await supabase.rpc("food_prices", { p_store: store });
  // Sin la migración de precios la app sigue funcionando, solo sin costos.
  if (error || !data) return new Map();
  return new Map((data as { food_id: string; pen_per_kg: number | string }[]).map((r) => [r.food_id, Number(r.pen_per_kg)]));
}

/** Costo en S/ de un ingrediente. Sin cantidad ("al gusto") cuesta 0; `null` si falta el precio o no se puede pasar a gramos. */
export function ingredientCost(item: CostItem, prices: PriceMap): number | null {
  if (item.quantity == null || item.unit == null) return 0;
  const perKg = prices.get(item.food_id);
  if (perKg == null) return null;
  const grams = toGrams({ kcal_100g: null, g_per_unit: item.food.g_per_unit, g_per_ml: item.food.g_per_ml }, item.quantity, item.unit);
  return grams == null ? null : (grams / 1000) * perKg;
}

export type Cost = {
  /** Costo de la receta completa (ingredientes obligatorios), en S/. */
  total: number;
  /** Costo por porción, en S/. */
  perServing: number;
  /** false si a algún ingrediente obligatorio le falta el precio (alimentos propios de la familia). */
  complete: boolean;
};

/** Costo de una receta (cantidades para `servings` porciones) con los ingredientes obligatorios, como las kcal. */
export function recipeCost(items: CostItem[], prices: PriceMap, servings: number): Cost {
  let total = 0;
  let complete = true;
  for (const item of items) {
    if (item.optional) continue;
    const c = ingredientCost(item, prices);
    if (c == null) complete = false;
    else total += c;
  }
  return { total, perServing: total / Math.max(1, servings), complete };
}

/** Lo que cuesta cocinar una comida: la receta completa por su multiplicador de porciones. */
export function mealCost(recipe: Cost, portionScale: number): Cost {
  const scale = portionScale > 0 ? portionScale : 1;
  return { total: recipe.total * scale, perServing: recipe.perServing, complete: recipe.complete };
}

/** Suma de varios costos (un día, una semana). `complete` es false si alguno lo es. */
export function sumCosts(costs: (Pick<Cost, "total" | "complete"> | null | undefined)[]): { total: number; complete: boolean; count: number } {
  let total = 0;
  let complete = true;
  let count = 0;
  for (const c of costs) {
    if (!c) continue;
    total += c.total;
    complete &&= c.complete;
    count++;
  }
  return { total, complete, count };
}

/** Costo por receta (id → costo) de recetas cargadas con sus ingredientes. */
export function recipeCosts(
  recipes: { id: string; servings: number; recipe_ingredients?: (Omit<CostItem, "food"> & { food?: CostItem["food"] | null })[] | null }[],
  prices: PriceMap,
): Map<string, Cost> {
  const out = new Map<string, Cost>();
  if (!prices.size) return out;
  for (const r of recipes) {
    const items = (r.recipe_ingredients ?? []).filter((i): i is CostItem => !!i.food);
    out.set(r.id, recipeCost(items, prices, r.servings));
  }
  return out;
}

/**
 * Formato de soles, "S/ 12.50" o "S/ 1,234.50", igual en los dos idiomas (así se ven los precios en Perú).
 * A mano y no con Intl: el servidor y el navegador pueden diferir en el espacio y romper la hidratación.
 */
export function formatPen(value: number, opts: { approx?: boolean; decimals?: number } = {}) {
  const [int, dec] = Math.abs(value).toFixed(opts.decimals ?? 2).split(".");
  const s = `${value < 0 ? "-" : ""}S/ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${dec ? `.${dec}` : ""}`;
  return opts.approx ? `≈ ${s}` : s;
}
