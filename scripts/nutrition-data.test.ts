import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { foods } from "../supabase/data/foods.mjs";
import { macros, nutrition } from "../supabase/data/nutrition.mjs";
import { recipes } from "../supabase/data/recipes.mjs";
import { kcalPerServing, macrosPerServing, type NutritionItem } from "../src/lib/nutrition";

// Las tablas .mjs no tienen tipos: se declaran aquí.
type FoodTuple = [key: string, es: string, en: string, category: string, emoji: string, img: string | null, days: number, unit: "unit" | "g" | "kg" | "ml" | "l", aliases: string[]];
type Recipe = { slug: string; servings: number; ing: [string, number, boolean?][] };
const foodList = foods as unknown as FoodTuple[];
const recipeList = recipes as unknown as Recipe[];
const table = nutrition as unknown as Record<string, [number, (number | null)?, (number | null)?]>;
const macroTable = macros as unknown as Record<string, [number, number, number]>;
const unitOf = new Map(foodList.map((f) => [f[0], f[7]]));

const items = (r: Recipe): NutritionItem[] =>
  r.ing.map(([key, quantity, optional]) => ({
    quantity,
    unit: unitOf.get(key) ?? null,
    optional: !!optional,
    food: {
      kcal_100g: table[key]?.[0] ?? null,
      g_per_unit: table[key]?.[1] ?? null,
      g_per_ml: table[key]?.[2] ?? null,
      protein_100g: macroTable[key]?.[0] ?? null,
      carbs_100g: macroTable[key]?.[1] ?? null,
      fat_100g: macroTable[key]?.[2] ?? null,
    },
  }));

describe("nutrición del catálogo", () => {
  it("cada alimento tiene su entrada y no sobra ninguna", () => {
    const keys = new Set(foodList.map((f) => f[0]));
    expect(foodList.filter((f) => !table[f[0]]).map((f) => f[0])).toEqual([]);
    expect(Object.keys(table).filter((k) => !keys.has(k))).toEqual([]);
  });

  it("los valores son razonables", () => {
    for (const [key, [kcal, gUnit, gMl]] of Object.entries(table)) {
      expect(kcal, key).toBeGreaterThanOrEqual(0);
      expect(kcal, key).toBeLessThanOrEqual(920);
      if (gUnit != null) expect(gUnit, key).toBeGreaterThan(0);
      if (gMl != null) expect(gMl, key).toBeGreaterThan(0.3);
    }
  });

  it("los alimentos por unidad tienen su peso y los líquidos su densidad", () => {
    for (const [key, , , , , , , unit] of foodList) {
      if (unit === "unit") expect(table[key][1], `${key} (unidad)`).toBeGreaterThan(0);
      if (unit === "ml" || unit === "l") expect(table[key][2], `${key} (densidad)`).toBeGreaterThan(0);
    }
  });
});

describe("macros del catálogo", () => {
  it("cada alimento tiene sus macros y no sobra ninguno", () => {
    expect(Object.keys(table).filter((k) => !macroTable[k])).toEqual([]);
    expect(Object.keys(macroTable).filter((k) => !table[k])).toEqual([]);
  });

  it("cuadran con las kcal (4·P + 4·C + 9·G)", () => {
    // El extracto de vainilla debe sus kcal al alcohol.
    for (const [key, [p, c, f]] of Object.entries(macroTable)) {
      expect(p + c + f, key).toBeLessThanOrEqual(100);
      if (key === "vanilla") continue;
      const kcal = table[key][0];
      expect(Math.abs(4 * p + 4 * c + 9 * f - kcal), key).toBeLessThanOrEqual(Math.max(40, 0.35 * kcal));
    }
  });
});

describe("kcal de las recetas", () => {
  const rows = recipeList.map((r) => ({ slug: r.slug, ...kcalPerServing(items(r), r.servings) }));

  it("todas son completas y realistas por porción", () => {
    expect(rows.length).toBe(57);
    for (const r of rows) {
      expect(r.complete, `${r.slug} incompleta`).toBe(true);
      expect(r.kcal, r.slug).toBeGreaterThanOrEqual(100);
      expect(r.kcal, r.slug).toBeLessThanOrEqual(1300);
    }
  });

  it("los macros de cada receta están completos y cuadran con sus kcal", () => {
    for (const r of recipeList) {
      const m = macrosPerServing(items(r), r.servings);
      const kcal = kcalPerServing(items(r), r.servings).kcal;
      expect(m.complete, r.slug).toBe(true);
      expect(Math.abs(4 * m.protein + 4 * m.carbs + 9 * m.fat - kcal), r.slug).toBeLessThanOrEqual(Math.max(60, 0.2 * kcal));
    }
  });

  it("platos conocidos caen en un rango plausible", () => {
    const kcal = Object.fromEntries(rows.map((r) => [r.slug, r.kcal]));
    expect(kcal.ceviche).toBeLessThan(400);
    expect(kcal["avena-con-leche"]).toBeGreaterThan(250);
    expect(kcal["avena-con-leche"]).toBeLessThan(450);
    expect(kcal["lomo-saltado"]).toBeGreaterThan(700);
    expect(kcal["lomo-saltado"]).toBeLessThan(1100);
    expect(kcal["fried-chicken"]).toBeLessThan(1000);
    expect(kcal["peanut-butter-cookies"]).toBeLessThan(300);
  });

  it("el seed.sql está al día con estos datos (regenerar con node scripts/build-seed.mjs)", () => {
    const seed = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8");
    for (const r of rows) {
      const start = seed.indexOf(`  '${r.slug}', `);
      expect(start, `${r.slug} no está en el seed`).toBeGreaterThan(-1);
      const tail = seed.slice(start, seed.indexOf("on conflict (slug)", start));
      expect(tail.trimEnd().endsWith(`${r.kcal}, ${r.complete})`), `${r.slug}: kcal desactualizada en el seed`).toBe(true);
    }
  });
});
