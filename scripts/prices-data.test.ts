import { describe, expect, it } from "vitest";
import { foods } from "../supabase/data/foods.mjs";
import { nutrition } from "../supabase/data/nutrition.mjs";
import { prices } from "../supabase/data/prices.mjs";
import { recipes } from "../supabase/data/recipes.mjs";
import { recipeCost, type CostItem } from "../src/lib/cost";
import { toGrams } from "../src/lib/nutrition";

// Las tablas .mjs no tienen tipos: se declaran aquí.
type Unit = "unit" | "g" | "kg" | "ml" | "l";
type FoodTuple = [key: string, es: string, en: string, category: string, emoji: string, img: string | null, days: number, unit: Unit, aliases: string[]];
type Recipe = { slug: string; servings: number; ing: [string, number, boolean?][] };
const foodList = foods as unknown as FoodTuple[];
const recipeList = recipes as unknown as Recipe[];
const table = prices as unknown as Record<string, number>;
const nut = nutrition as unknown as Record<string, [number, (number | null)?, (number | null)?]>;
const unitOf = new Map(foodList.map((f) => [f[0], f[7]]));
const food = (key: string) => ({ kcal_100g: null, g_per_unit: nut[key]?.[1] ?? null, g_per_ml: nut[key]?.[2] ?? null });

// Igual que scripts/build-seed.mjs: precio por kg, litro o unidad → S/ por kg.
const BASIS: Record<Unit, [number, Unit]> = { g: [1, "kg"], kg: [1, "kg"], ml: [1, "l"], l: [1, "l"], unit: [1, "unit"] };
const perKg = (key: string) => {
  const unit = unitOf.get(key)!;
  const grams = toGrams(food(key), ...BASIS[unit]);
  return grams ? (table[key] / grams) * 1000 : null;
};

describe("precios estimados del catálogo", () => {
  it("cada alimento tiene su precio y no sobra ninguno", () => {
    const keys = new Set(foodList.map((f) => f[0]));
    expect(foodList.filter((f) => table[f[0]] == null).map((f) => f[0])).toEqual([]);
    expect(Object.keys(table).filter((k) => !keys.has(k))).toEqual([]);
  });

  it("los precios por kg son razonables (S/ 0.5 a S/ 500)", () => {
    const off = foodList.map((f) => f[0]).filter((k) => {
      const v = perKg(k);
      return v == null || v < 0.5 || v > 500;
    });
    expect(off).toEqual([]);
  });

  it("cada receta del seed tiene un costo por porción razonable", () => {
    const prices = new Map(foodList.map((f) => [f[0], perKg(f[0])!]));
    for (const r of recipeList) {
      const items: CostItem[] = r.ing.map(([key, quantity, optional]) => ({ food_id: key, quantity, unit: unitOf.get(key) ?? null, optional: !!optional, food: food(key) }));
      const c = recipeCost(items, prices, r.servings);
      expect(c.complete, r.slug).toBe(true);
      expect(c.perServing, r.slug).toBeGreaterThan(0.3);
      expect(c.perServing, r.slug).toBeLessThan(40);
    }
  });
});
