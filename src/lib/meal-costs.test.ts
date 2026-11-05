import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadMealCosts, type CostMeal } from "./meal-costs";

const food = { g_per_unit: 50, g_per_ml: 1 };
const tables: Record<string, Record<string, unknown>[]> = {
  meal_series: [
    { id: "s-edit", recipe_id: "r1", custom_items: true },
    { id: "s-plain", recipe_id: "r1", custom_items: false },
  ],
  meal_items: [
    { meal_id: "m-own", food_id: "rice", quantity: 2, unit: "kg", optional: false, food },
    { series_id: "s-edit", food_id: "egg", quantity: 10, unit: "unit", optional: false, food },
  ],
  recipe_ingredients: [
    { recipe_id: "r1", food_id: "rice", quantity: 1, unit: "kg", optional: false, food },
    { recipe_id: "r1", food_id: "mine", quantity: 100, unit: "g", optional: true, food },
  ],
};

/** Cliente falso: solo from().select().in(col, values). */
const fake = {
  from: (table: string) => ({
    select: () => ({ in: async (col: string, values: string[]) => ({ data: tables[table].filter((r) => values.includes(r[col] as string)) }) }),
  }),
} as unknown as SupabaseClient;

const prices = new Map([["rice", 4], ["egg", 12]]);
const meal = (id: string, over: Partial<CostMeal> = {}): CostMeal => ({ id, recipe_id: "r1", series_id: null, recipe: { servings: 4 }, ...over });

describe("costo de las comidas", () => {
  it("usa los ingredientes efectivos y el multiplicador de porciones", async () => {
    const costs = await loadMealCosts(fake, [
      meal("m-recipe", { portion_scale: 1.5 }),
      meal("m-own", { custom_items: true }),
      meal("m-series", { series_id: "s-edit" }),
      meal("m-series-plain", { series_id: "s-plain" }),
      meal("m-free", { recipe_id: null, recipe: null }),
    ], prices);
    expect(costs.get("m-recipe")?.total).toBeCloseTo(6); // 1 kg × S/ 4 × 1.5
    expect(costs.get("m-own")?.total).toBeCloseTo(8); // 2 kg de arroz editados
    expect(costs.get("m-series")?.total).toBeCloseTo(6); // 10 huevos de 50 g × S/ 12/kg
    expect(costs.get("m-series-plain")?.total).toBeCloseTo(4);
    expect(costs.has("m-free")).toBe(false);
  });

  it("sin precios no calcula nada", async () => {
    expect((await loadMealCosts(fake, [meal("m-recipe")], new Map())).size).toBe(0);
  });
});
