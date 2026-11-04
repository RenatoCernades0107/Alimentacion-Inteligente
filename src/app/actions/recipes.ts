"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { requireMember } from "@/lib/session";
import { fail, persistRecipe, recipeKcal, type SaveRecipeResult } from "@/lib/recipe-save";
import {
  localizeTexts,
  parseRecipeInput,
  resolveEditTarget,
  type Locale,
  type RecipeInput,
  type RecipeTexts,
} from "@/lib/recipe-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type { SaveRecipeResult };

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
  const kcal = await recipeKcal(supabase, input);
  if (!kcal.ok) return kcal;

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

  const res = await persistRecipe(supabase, input, texts, kcal.kcal);
  if (res.ok) revalidatePath("/", "layout");
  return res;
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
