import type { Country, InventoryItem, Recipe } from "./types";
import { daysBetween } from "./dates";

export type SuggestionMode = "have" | "any";

export type Suggestion = {
  recipe: Recipe;
  have: number;
  total: number;
  missing: string[]; // food ids
  expiringUsed: number;
  score: number;
};

/**
 * Reglas simples:
 * - Los básicos (sal, aceite, azúcar, pimienta) se asumen disponibles.
 * - Puntaje = % de ingredientes que ya tienes + bonus por usar alimentos que vencen en ≤ 3 días.
 * - Modo "have": solo recetas con todos los ingredientes obligatorios.
 * - Modo "any": todas, primero las que comparten más ingredientes con tu inventario.
 */
export function suggest(
  recipes: Recipe[],
  inventory: InventoryItem[],
  opts: { mode: SuggestionMode; countries: Country[]; mealType?: string; today: string },
): Suggestion[] {
  const available = new Map<string, number | null>(); // food_id → días para vencer (el más próximo)
  for (const item of inventory) {
    if (!item.food_id || item.quantity <= 0) continue;
    const expiresIn = item.expires_on ? daysBetween(opts.today, item.expires_on) : null;
    const prev = available.get(item.food_id);
    if (prev === undefined || (expiresIn !== null && (prev === null || expiresIn < prev))) {
      available.set(item.food_id, expiresIn);
    }
  }

  const results: Suggestion[] = [];
  for (const recipe of recipes) {
    if (!opts.countries.includes(recipe.country)) continue;
    if (opts.mealType && !recipe.meal_types.includes(opts.mealType)) continue;

    const ingredients = recipe.recipe_ingredients ?? [];
    const required = ingredients.filter((i) => !i.optional && i.food?.category !== "basics");
    const missing = required.filter((i) => !available.has(i.food_id)).map((i) => i.food_id);
    const have = required.length - missing.length;
    const expiringUsed = ingredients.filter((i) => {
      const expiresIn = available.get(i.food_id);
      return expiresIn !== undefined && expiresIn !== null && expiresIn <= 3;
    }).length;

    if (opts.mode === "have" && missing.length > 0) continue;

    const score = (required.length ? have / required.length : 1) + expiringUsed * 0.2;
    results.push({ recipe, have, total: required.length, missing, expiringUsed, score });
  }

  return results.sort((a, b) => b.score - a.score || a.missing.length - b.missing.length);
}
