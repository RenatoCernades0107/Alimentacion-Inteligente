import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeRecipeKcal, newRecipeSlug, type ParsedRecipeInput, type RecipeTexts } from "@/lib/recipe-form";
import type { FoodNutrition } from "@/lib/nutrition";

/**
 * Los errores previstos se devuelven (en producción Next oculta el mensaje de los lanzados); los
 * inesperados (permisos, red) lanzan y el cliente muestra un aviso genérico.
 */
export type SaveRecipeResult =
  | { ok: true; id: string; slug: string; /** Se guardó como tu versión de otra receta. */ copied: boolean }
  | { ok: false; error: "invalid" | "kcal" | "gone" | "limit" };

export const fail = (error: "invalid" | "kcal" | "gone" | "limit"): { ok: false; error: typeof error } => ({ ok: false, error });

/**
 * kcal de una receta a partir de sus ingredientes. Los alimentos tienen que ser visibles para el usuario
 * (catálogo o de su familia; RLS). Devuelve el error previsto si alguno no existe o las kcal no cuadran.
 */
export async function recipeKcal(supabase: SupabaseClient, input: ParsedRecipeInput) {
  const foodIds = input.ingredients.map((i) => i.foodId);
  const { data: foodRows } = await supabase.from("foods").select("id, kcal_100g, g_per_unit, g_per_ml").in("id", foodIds);
  const foods = new Map<string, FoodNutrition>((foodRows ?? []).map((f) => [f.id as string, f as FoodNutrition]));
  if (foods.size !== foodIds.length) return fail("invalid");
  const kcal = computeRecipeKcal(input.ingredients, foods, input.servings);
  if (kcal.tooHigh) return fail("kcal");
  return { ok: true as const, kcal };
}

/**
 * Llama a `save_recipe` (que decide permisos, familia y si se crea una versión personal). El slug es
 * solo un candidato: si justo choca con otro (8 hex aleatorios) se reintenta con otro sufijo.
 */
export async function persistRecipe(
  supabase: SupabaseClient,
  input: ParsedRecipeInput,
  texts: RecipeTexts,
  kcal: { kcal: number; complete: boolean },
): Promise<SaveRecipeResult> {
  const args = {
    p_id: input.sourceId,
    p_country: input.country,
    p_name_es: texts.name_es,
    p_name_en: texts.name_en,
    p_description_es: texts.description_es,
    p_description_en: texts.description_en,
    p_emoji: input.emoji || null,
    p_meal_types: input.mealTypes,
    p_servings: input.servings,
    p_time_minutes: input.timeMinutes,
    p_source_url: input.sourceUrl || null,
    p_steps_es: texts.steps_es,
    p_steps_en: texts.steps_en,
    p_kcal_per_serving: kcal.kcal,
    p_kcal_complete: kcal.complete,
    p_ingredients: input.ingredients.map((i) => ({ food_id: i.foodId, quantity: i.quantity, unit: i.unit, optional: i.optional })),
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.rpc("save_recipe", { ...args, p_slug: newRecipeSlug(texts.name_es) });
    if (!error) {
      const row = (data as { recipe_id: string; recipe_slug: string; is_copy: boolean }[] | null)?.[0];
      if (!row) throw new Error("error");
      return { ok: true, id: row.recipe_id, slug: row.recipe_slug, copied: row.is_copy };
    }
    if (error.code === "23505" && error.message.includes("recipes_slug_key")) continue;
    if (error.message.includes("not found")) return fail("gone");
    if (error.message.includes("too many recipes")) return fail("limit");
    throw new Error(error.message);
  }
  throw new Error("slug");
}
