import { describe, expect, it } from "vitest";
import { customDish, customSlug, customToRecipeInput, foodLookup, parseNewRecipe, pruneCustom, replaceRecipeIds, type ChefFood } from "./chef-custom";
import type { CustomDish, Plan } from "./chef";
import type { InventoryItem } from "./types";

const food = (id: string, over: Partial<ChefFood>): ChefFood => ({
  id, key: null, name_es: id, name_en: id, category: "other", emoji: null, default_unit: "g",
  kcal_100g: null, g_per_unit: null, g_per_ml: 1, protein_100g: null, carbs_100g: null, fat_100g: null, aliases: [], ...over,
});

const foods: ChefFood[] = [
  food("f-pollo", { key: "chicken_breast", name_es: "Pechuga de pollo", name_en: "Chicken breast", category: "meat", kcal_100g: 120, protein_100g: 23, carbs_100g: 0, fat_100g: 2.6, aliases: ["pollo"] }),
  food("f-quinua", { key: "quinoa", name_es: "Quinua", name_en: "Quinoa", category: "grains", kcal_100g: 368, protein_100g: 14, carbs_100g: 64, fat_100g: 6 }),
  food("f-tomate", { key: "tomato", name_es: "Tomate", name_en: "Tomato", category: "vegetables", default_unit: "unit", kcal_100g: 18, g_per_unit: 120, protein_100g: 0.9, carbs_100g: 3.9, fat_100g: 0.2 }),
  food("f-sal", { key: "salt", name_es: "Sal", name_en: "Salt", category: "basics", kcal_100g: 0, protein_100g: 0, carbs_100g: 0, fat_100g: 0 }),
];
const byId = new Map(foods.map((f) => [f.id, f]));

const raw = {
  ref: "bowl",
  name_es: "Bowl de quinua con pollo",
  name_en: "Chicken quinoa bowl",
  description: "Rico y alto en proteína.",
  emoji: "🥗",
  meal_types: ["lunch", "Dinner", "brunch"],
  servings: 2,
  time_minutes: 25,
  country: "PE",
  ingredients: [
    { food: "pollo", quantity: 300, unit: "g" },
    { food: "Quinua", quantity: 150, unit: "g" },
    { food: "tomates", quantity: 2, unit: "unidades" },
    { food: "sal", quantity: null, unit: null },
    { food: "unicornio", quantity: 1, unit: "g" },
  ],
  steps: ["Cocinar la quinua.", "  ", "Dorar el pollo y mezclar."],
};

describe("foodLookup", () => {
  const find = foodLookup(foods);
  it("encuentra por key, nombre, alias y plural simple, sin tildes ni mayúsculas", () => {
    expect(find("chicken_breast")?.id).toBe("f-pollo");
    expect(find("PECHUGA DE POLLO")?.id).toBe("f-pollo");
    expect(find("pollo")?.id).toBe("f-pollo");
    expect(find("tomates")?.id).toBe("f-tomate");
    expect(find("quínua")?.id).toBe("f-quinua");
    expect(find("unicornio")).toBeUndefined();
    expect(find(null)).toBeUndefined();
  });
});

describe("parseNewRecipe", () => {
  it("asocia ingredientes a alimentos reales y descarta lo que no existe", () => {
    const r = parseNewRecipe(raw, foods)!;
    expect(r.ingredients.map((i) => i.foodId)).toEqual(["f-pollo", "f-quinua", "f-tomate", "f-sal"]);
    // Unidad desconocida: la del alimento.
    expect(r.ingredients[2]).toMatchObject({ quantity: 2, unit: "unit", name_es: "Tomate" });
    // "Al gusto": sin cantidad ni unidad.
    expect(r.ingredients[3]).toMatchObject({ quantity: null, unit: null });
    expect(r.meal_types).toEqual(["lunch", "dinner"]);
    expect(r.steps).toEqual(["Cocinar la quinua.", "Dorar el pollo y mezclar."]);
    expect(r.country).toBe("PE");
  });
  it("rechaza recetas con menos de 2 ingredientes reales, sin pasos o sin tipo", () => {
    expect(parseNewRecipe({ ...raw, ingredients: [{ food: "pollo", quantity: 1, unit: "g" }, { food: "x", quantity: 1, unit: "g" }] }, foods)).toBeNull();
    expect(parseNewRecipe({ ...raw, steps: [] }, foods)).toBeNull();
    expect(parseNewRecipe({ ...raw, meal_types: ["brunch"] }, foods)).toBeNull();
    expect(parseNewRecipe({ ...raw, name_es: "", name_en: "" }, foods)).toBeNull();
  });
  it("limpia emoji, porciones y tiempo", () => {
    const r = parseNewRecipe({ ...raw, emoji: "no", servings: 500, time_minutes: -3 }, foods)!;
    expect(r.emoji).toBe("🍽️");
    expect(r.servings).toBe(100);
    expect(r.time_minutes).toBe(1);
  });
  it("sin el nombre en un idioma usa el otro", () => {
    expect(parseNewRecipe({ ...raw, name_en: null }, foods)!.name_en).toBe("Bowl de quinua con pollo");
  });
});

describe("customDish", () => {
  const recipe = parseNewRecipe(raw, foods)!;
  const inventory = [{ food_id: "f-quinua", quantity: 1, expires_on: "2026-10-11" }] as InventoryItem[];
  const id = "11111111-1111-4111-8111-111111111111";

  it("calcula kcal y macros por porción de los ingredientes (no de la IA)", () => {
    const d = customDish(id, recipe, { foods: byId, inventory, today: "2026-10-10" })!;
    // (300 g × 1.2 + 150 g × 3.68 + 240 g × 0.18) / 2 = (360 + 552 + 43.2) / 2 ≈ 478
    expect(d.card.kcal).toBe(478);
    expect(d.card.protein).toBeCloseTo((69 + 21 + 2.16) / 2, 0);
    expect(d.card).toMatchObject({ id, slug: customSlug(id), custom: true, meat: true, have: 1, total: 3, expiring: true, image_url: null });
  });
  it("null si un ingrediente ya no existe", () => {
    expect(customDish(id, recipe, { foods: new Map(), inventory: [], today: "2026-10-10" })).toBeNull();
  });
  it("se convierte al formato del formulario de recetas", () => {
    const input = customToRecipeInput(recipe, "en");
    expect(input).toMatchObject({ sourceId: null, name: "Chicken quinoa bowl", mealTypes: ["lunch", "dinner"], servings: 2, sourceUrl: "" });
    expect(input.ingredients[0]).toEqual({ foodId: "f-pollo", quantity: 300, unit: "g", optional: false });
  });
});

describe("pruneCustom y replaceRecipeIds", () => {
  const dish = (id: string) => ({ card: { id }, recipe: {} }) as unknown as CustomDish;
  it("conserva las que usa el plan y las más recientes", () => {
    const custom = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`id${i}`, dish(`id${i}`)]));
    const plan: Plan = { "2026-10-10|lunch": { recipeId: "id0" } };
    const kept = Object.keys(pruneCustom(custom, plan));
    expect(kept).toHaveLength(24);
    expect(kept).toContain("id0");
    expect(kept).toContain("id29");
    expect(kept).not.toContain("id1");
  });
  it("cambia los ids temporales por los guardados", () => {
    const plan: Plan = { "2026-10-10|lunch": { recipeId: "tmp", reason: "x" }, "2026-10-10|dinner": { recipeId: "otro" } };
    expect(replaceRecipeIds(plan, { tmp: "real" })).toEqual({ "2026-10-10|lunch": { recipeId: "real", reason: "x" }, "2026-10-10|dinner": { recipeId: "otro" } });
  });
});

describe("pruneCustom con recetas en cambios pendientes", () => {
  it("conserva también las de alsoKeep", () => {
    const dish = (id: string) => ({ card: { id }, recipe: {} }) as unknown as CustomDish;
    const custom = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`id${i}`, dish(`id${i}`)]));
    expect(Object.keys(pruneCustom(custom, {}, ["id1"]))).toContain("id1");
  });
});
