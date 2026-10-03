"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { requireMember } from "@/lib/session";
import {
  computeRecipeKcal,
  localizeTexts,
  newRecipeSlug,
  parseRecipeInput,
  resolveEditTarget,
  type Locale,
  type RecipeInput,
  type RecipeTexts,
} from "@/lib/recipe-form";
import type { FoodNutrition } from "@/lib/nutrition";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Los errores previstos se devuelven (en producción Next oculta el mensaje de los lanzados); los
 * inesperados (permisos, red) lanzan y el cliente muestra un aviso genérico.
 */
export type SaveRecipeResult =
  | { ok: true; id: string; slug: string; /** Se guardó como tu versión de otra receta. */ copied: boolean }
  | { ok: false; error: "invalid" | "kcal" | "gone" | "limit" };

const fail = (error: "invalid" | "kcal" | "gone" | "limit"): { ok: false; error: typeof error } => ({ ok: false, error });

const TEXT_COLS = "id, family_id, created_by, parent_recipe_id, name_es, name_en, description_es, description_en, steps_es, steps_en";
type TextRow = RecipeTexts & { id: string; family_id: string | null; created_by: string | null; parent_recipe_id: string | null };

/**
 * Crea o edita una receta propia. Quién puede qué lo decide la base de datos (`save_recipe`): una receta
 * mía se actualiza en su lugar; editar una del catálogo o de otro integrante crea mi versión (y las
 * siguientes ediciones actualizan esa misma versión). Aquí se validan los datos, se calculan las kcal
 * con src/lib/nutrition.ts y se deciden los textos en ambos idiomas.
 */
export async function saveRecipe(raw: RecipeInput): Promise<SaveRecipeResult> {
  const { supabase, user } = await requireMember();
  const locale: Locale = (await getLocale()) === "en" ? "en" : "es";

  const parsed = parseRecipeInput(raw);
  if (!parsed.ok) return fail("invalid");
  const input = parsed.data;

  // Alimentos: tienen que ser visibles para el usuario (catálogo o de su familia); de ahí salen las kcal.
  const foodIds = input.ingredients.map((i) => i.foodId);
  const { data: foodRows } = await supabase.from("foods").select("id, kcal_100g, g_per_unit, g_per_ml").in("id", foodIds);
  const foods = new Map<string, FoodNutrition>((foodRows ?? []).map((f) => [f.id as string, f as FoodNutrition]));
  if (foods.size !== foodIds.length) return fail("invalid");

  const kcal = computeRecipeKcal(input.ingredients, foods, input.servings);
  if (kcal.tooHigh) return fail("kcal");

  // Textos de la receta que se va a sobrescribir (para no pisar el otro idioma de lo que no se tocó).
  let current: RecipeTexts | null = null;
  if (input.sourceId) {
    const [{ data: source }, { data: mine }] = await Promise.all([
      supabase.from("recipes").select(TEXT_COLS).eq("id", input.sourceId).maybeSingle(),
      supabase.from("recipes").select(TEXT_COLS).eq("created_by", user.id).eq("parent_recipe_id", input.sourceId),
    ]);
    if (!source) return fail("gone");
    const target = resolveEditTarget(source as TextRow, user.id, (mine ?? []) as TextRow[]);
    current = target.kind === "my-copy" ? ((mine ?? []) as TextRow[]).find((r) => r.id === target.id) ?? (source as TextRow) : (source as TextRow);
  }
  const texts = localizeTexts(locale, { name: input.name, description: input.description, steps: input.steps }, current);

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

  // El slug es solo un candidato: si justo choca con otro (8 hex aleatorios) se reintenta con otro sufijo.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.rpc("save_recipe", { ...args, p_slug: newRecipeSlug(texts.name_es) });
    if (!error) {
      const row = (data as { recipe_id: string; recipe_slug: string; is_copy: boolean }[] | null)?.[0];
      if (!row) throw new Error("error");
      revalidatePath("/", "layout");
      return { ok: true, id: row.recipe_id, slug: row.recipe_slug, copied: row.is_copy };
    }
    if (error.code === "23505" && error.message.includes("recipes_slug_key")) continue;
    if (error.message.includes("not found")) return fail("gone");
    if (error.message.includes("too many recipes")) return fail("limit");
    throw new Error(error.message);
  }
  throw new Error("slug");
}

/** Elimina una receta propia (el autor o un padre). Las comidas del calendario que la usan se quedan con su nombre. */
export async function deleteRecipe(id: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireMember();
  if (!UUID.test(id)) throw new Error("invalid");
  const { error } = await supabase.rpc("delete_recipe", { p_id: id });
  if (error) {
    // Ya no existe (la borró otra persona): el resultado es el que se quería.
    if (error.message.includes("not found")) {
      revalidatePath("/", "layout");
      return { ok: true };
    }
    throw new Error(error.message);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Marca o desmarca una receta como favorita del usuario (no de la familia). */
export async function toggleFavorite(recipeId: string, favorite: boolean) {
  const { supabase, user } = await requireMember();
  if (!UUID.test(recipeId)) throw new Error("invalid");
  // RLS: solo filas propias y solo de recetas que el usuario puede ver.
  const { error } = favorite
    ? await supabase.from("recipe_favorites").upsert({ user_id: user.id, recipe_id: recipeId }, { onConflict: "user_id,recipe_id", ignoreDuplicates: true })
    : await supabase.from("recipe_favorites").delete().eq("user_id", user.id).eq("recipe_id", recipeId);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
