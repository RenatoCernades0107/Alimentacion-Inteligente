import { describe, expect, it } from "vitest";
import { formatPen, ingredientCost, mealCost, recipeCost, recipeCosts, sumCosts, type CostItem } from "./cost";

const prices = new Map([
  ["rice", 4.5], // S/ por kg
  ["milk", 5.5], // 1 l ≈ 1.03 kg
  ["egg", 12], // 50 g por unidad → S/ 0.60
]);
const item = (food_id: string, quantity: number | null, unit: CostItem["unit"], extra: Partial<CostItem> = {}): CostItem => ({
  food_id, quantity, unit, optional: false, food: { g_per_unit: food_id === "egg" ? 50 : null, g_per_ml: food_id === "milk" ? 1.03 : 1 }, ...extra,
});

describe("costo", () => {
  it("convierte la cantidad a kg con el peso por unidad y la densidad", () => {
    expect(ingredientCost(item("rice", 500, "g"), prices)).toBeCloseTo(2.25);
    expect(ingredientCost(item("rice", 1, "kg"), prices)).toBeCloseTo(4.5);
    expect(ingredientCost(item("egg", 2, "unit"), prices)).toBeCloseTo(1.2);
    expect(ingredientCost(item("milk", 1, "l"), prices)).toBeCloseTo(5.665);
  });

  it("'al gusto' cuesta 0 y sin precio o sin peso por unidad es null", () => {
    expect(ingredientCost(item("rice", null, null), prices)).toBe(0);
    expect(ingredientCost(item("salsa_propia", 100, "g"), prices)).toBeNull();
    expect(ingredientCost(item("rice", 1, "unit"), prices)).toBeNull();
  });

  it("receta: solo obligatorios, por porción e incompleta si falta un precio", () => {
    const c = recipeCost([item("rice", 1, "kg"), item("egg", 4, "unit"), item("milk", 1, "l", { optional: true })], prices, 4);
    expect(c.total).toBeCloseTo(6.9);
    expect(c.perServing).toBeCloseTo(1.725);
    expect(c.complete).toBe(true);
    expect(recipeCost([item("rice", 1, "kg"), item("salsa_propia", 1, "kg")], prices, 2)).toMatchObject({ total: 4.5, complete: false });
  });

  it("comida = receta × escala; la semana suma las comidas", () => {
    const r = recipeCost([item("rice", 1, "kg")], prices, 4);
    expect(mealCost(r, 1.5).total).toBeCloseTo(6.75);
    expect(mealCost(r, 0).total).toBeCloseTo(4.5);
    const week = sumCosts([mealCost(r, 1), null, { total: 2, complete: false }]);
    expect(week).toEqual({ total: 6.5, complete: false, count: 2 });
  });

  it("costos por receta e ignora ingredientes sin alimento", () => {
    const m = recipeCosts([{ id: "r1", servings: 2, recipe_ingredients: [{ ...item("rice", 1, "kg") }, { food_id: "x", quantity: 1, unit: "g", optional: false, food: null }] }], prices);
    expect(m.get("r1")).toMatchObject({ total: 4.5, perServing: 2.25, complete: true });
    expect(recipeCosts([{ id: "r1", servings: 2 }], new Map()).size).toBe(0);
  });

  it("formato en soles", () => {
    expect(formatPen(12.5)).toBe("S/ 12.50");
    expect(formatPen(3, { approx: true, decimals: 0 })).toBe("≈ S/ 3");
    expect(formatPen(1234.5)).toBe("S/ 1,234.50");
  });
});
