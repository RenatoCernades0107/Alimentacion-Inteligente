import { describe, expect, it } from "vitest";
import {
  formatPortion,
  ingredientKcal,
  itemsKcal,
  kcalPerServing,
  macroSplit,
  macrosPerServing,
  portionFor,
  slotShare,
  suggestedScale,
  toGrams,
  type FoodNutrition,
} from "./nutrition";

const egg: FoodNutrition = { kcal_100g: 143, g_per_unit: 50, g_per_ml: null };
const oil: FoodNutrition = { kcal_100g: 884, g_per_unit: null, g_per_ml: 0.92 };
const rice: FoodNutrition = { kcal_100g: 360, g_per_unit: null, g_per_ml: null };
const unknown: FoodNutrition = { kcal_100g: null, g_per_unit: null, g_per_ml: null };

describe("gramos y kcal de un ingrediente", () => {
  it("convierte cada unidad a gramos", () => {
    expect(toGrams(rice, 0.4, "kg")).toBe(400);
    expect(toGrams(rice, 250, "g")).toBe(250);
    expect(toGrams(oil, 0.05, "l")).toBeCloseTo(46, 6);
    expect(toGrams(oil, 100, "ml")).toBeCloseTo(92, 6);
    expect(toGrams(rice, 200, "ml")).toBe(200);
    expect(toGrams(egg, 4, "unit")).toBe(200);
    expect(toGrams(rice, 3, "unit")).toBeNull();
  });

  it("calcula kcal; sin cantidad suma 0 y sin dato es desconocido", () => {
    expect(ingredientKcal({ quantity: 4, unit: "unit", optional: false, food: egg })).toBeCloseTo(286, 6);
    expect(ingredientKcal({ quantity: 0.4, unit: "kg", optional: false, food: rice })).toBeCloseTo(1440, 6);
    expect(ingredientKcal({ quantity: null, unit: null, optional: false, food: unknown })).toBe(0);
    expect(ingredientKcal({ quantity: 100, unit: "g", optional: false, food: unknown })).toBeNull();
    expect(ingredientKcal({ quantity: 2, unit: "unit", optional: false, food: rice })).toBeNull();
  });
});

describe("kcal de una receta", () => {
  const items = [
    { quantity: 0.4, unit: "kg" as const, optional: false, food: rice },
    { quantity: 4, unit: "unit" as const, optional: false, food: egg },
    { quantity: 0.05, unit: "l" as const, optional: true, food: oil },
  ];

  it("separa obligatorios de opcionales", () => {
    const r = itemsKcal(items);
    expect(r.kcal).toBeCloseTo(1440 + 286, 6);
    expect(r.optionalKcal).toBeCloseTo(0.046 * 1000 * 8.84, 3);
    expect(r.complete).toBe(true);
  });

  it("es incompleta si falta el dato de un ingrediente obligatorio, no de uno opcional", () => {
    expect(itemsKcal([...items, { quantity: 50, unit: "g", optional: false, food: unknown }]).complete).toBe(false);
    expect(itemsKcal([...items, { quantity: 50, unit: "g", optional: true, food: unknown }]).complete).toBe(true);
    expect(itemsKcal([...items, { quantity: null, unit: null, optional: false, food: unknown }]).complete).toBe(true);
  });

  it("divide entre las porciones", () => {
    expect(kcalPerServing(items, 4).kcal).toBe(Math.round(1726 / 4));
    expect(kcalPerServing(items, 0).kcal).toBe(1726);
  });
});

describe("macros de una receta", () => {
  const eggM: FoodNutrition = { ...egg, protein_100g: 12.6, carbs_100g: 0.7, fat_100g: 9.5 };
  const riceM: FoodNutrition = { ...rice, protein_100g: 7, carbs_100g: 79, fat_100g: 0.7 };
  const oilM: FoodNutrition = { ...oil, protein_100g: 0, carbs_100g: 0, fat_100g: 100 };
  const items = [
    { quantity: 0.4, unit: "kg" as const, optional: false, food: riceM },
    { quantity: 4, unit: "unit" as const, optional: false, food: eggM },
    { quantity: 0.05, unit: "l" as const, optional: true, food: oilM },
  ];

  it("suma los obligatorios y divide entre las porciones", () => {
    // arroz 400 g: 28 / 316 / 2.8 · huevos 200 g: 25.2 / 1.4 / 19
    expect(macrosPerServing(items, 4)).toEqual({ protein: 13, carbs: 79, fat: 5, complete: true });
  });

  it("es incompleta si a un obligatorio le faltan los macros", () => {
    expect(macrosPerServing([...items, { quantity: 50, unit: "g", optional: false, food: rice }], 4).complete).toBe(false);
    expect(macrosPerServing([...items, { quantity: 50, unit: "g", optional: true, food: rice }], 4).complete).toBe(true);
  });

  it("reparte las kcal entre los macros", () => {
    const s = macroSplit({ protein: 25, carbs: 50, fat: 0 });
    expect(s.protein).toBeCloseTo(1 / 3, 6);
    expect(s.carbs).toBeCloseTo(2 / 3, 6);
    expect(macroSplit({ protein: 0, carbs: 0, fat: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});

describe("reparto por franja", () => {
  it("cada configuración suma 100%", () => {
    const sum = (meals: number, slots: Parameters<typeof slotShare>[0][]) => slots.reduce((acc, s) => acc + slotShare(s, meals), 0);
    expect(sum(3, ["breakfast", "lunch", "dinner"])).toBeCloseTo(1, 9);
    expect(sum(4, ["breakfast", "morning_snack", "lunch", "dinner"])).toBeCloseTo(1, 9);
    expect(sum(5, ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"])).toBeCloseTo(1, 9);
  });

  it("el almuerzo es la comida principal", () => {
    expect(slotShare("lunch", 3)).toBe(0.4);
    expect(slotShare("lunch", 5)).toBe(0.3);
  });

  it("una franja fuera de la configuración usa el reparto de 5 (nunca NaN)", () => {
    expect(slotShare("afternoon_snack", 3)).toBe(0.1);
    expect(slotShare("morning_snack", 3)).toBe(0.1);
    expect(Number.isFinite(slotShare("afternoon_snack", 4))).toBe(true);
  });
});

describe("porciones", () => {
  it("redondea al ¼ más cercano", () => {
    // 2000 kcal/día · almuerzo 40% = 800 kcal; una porción de la receta aporta 500.
    expect(portionFor(2000, 0.4, 500)).toEqual({ portion: 1.5, kcal: 750, shortBy: 0 });
    expect(portionFor(1000, 0.4, 500)).toEqual({ portion: 0.75, kcal: 375, shortBy: 0 });
  });

  it("mínimo ¼ y máximo 2, informando lo que no alcanza a cubrirse", () => {
    expect(portionFor(1000, 0.25, 900).portion).toBe(0.25);
    const big = portionFor(3500, 0.4, 300);
    expect(big.portion).toBe(2);
    expect(big.shortBy).toBe(800);
    expect(portionFor(2000, 0.4, 400)).toEqual({ portion: 2, kcal: 800, shortBy: 0 });
  });

  it("da formato con fracciones", () => {
    expect(formatPortion(0.25)).toBe("¼");
    expect(formatPortion(0.5)).toBe("½");
    expect(formatPortion(0.75)).toBe("¾");
    expect(formatPortion(1)).toBe("1");
    expect(formatPortion(1.25)).toBe("1¼");
    expect(formatPortion(2)).toBe("2");
  });

  it("sugiere el multiplicador de ingredientes sin dejar a nadie corto", () => {
    expect(suggestedScale(4, 4)).toBe(1);
    expect(suggestedScale(4.05, 4)).toBe(1);
    expect(suggestedScale(5.25, 4)).toBe(1.5);
    expect(suggestedScale(0.25, 4)).toBe(0.25);
    expect(suggestedScale(500, 4)).toBe(20);
  });
});
