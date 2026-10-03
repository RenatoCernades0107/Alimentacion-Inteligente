import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Country, InventoryItem, Recipe, RecipeIngredient } from "@/lib/types";

export const RECIPE_SELECT = "*, recipe_ingredients(food_id, quantity, unit, optional, position, food:foods(*))";

/** Ingrediente tal como llega de RECIPE_SELECT (con el orden en que lo escribió el autor). */
export type RecipeIngredientRow = RecipeIngredient & { position?: number };

/** Obligatorios primero y, dentro de cada grupo, en el orden del autor (las del catálogo no tienen orden). */
export function sortIngredients(list: RecipeIngredientRow[] | undefined) {
  return [...(list ?? [])].sort((a, b) => Number(a.optional) - Number(b.optional) || (a.position ?? 0) - (b.position ?? 0));
}

/**
 * Recetas que ve el usuario (RLS): el catálogo y las propias de su familia, con ingredientes.
 * Las recetas propias de otras familias nunca llegan; no hace falta filtrar aquí.
 */
export async function loadRecipesAndInventory(supabase: SupabaseClient, familyId: string) {
  const [{ data: recipes }, { data: inventory }] = await Promise.all([
    supabase.from("recipes").select(RECIPE_SELECT).order("name_es"),
    supabase.from("inventory_items").select("*").eq("family_id", familyId),
  ]);
  return { recipes: (recipes ?? []) as Recipe[], inventory: (inventory ?? []) as InventoryItem[] };
}

/** Ids de las recetas favoritas del usuario (la tabla solo deja ver las propias). */
export async function loadFavoriteIds(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("recipe_favorites").select("recipe_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.recipe_id as string));
}

/** Nombre de pila de los integrantes de la familia, para indicar de quién es cada receta. */
export async function loadMemberNames(supabase: SupabaseClient, familyId: string) {
  const { data } = await supabase.from("profiles").select("id, full_name").eq("family_id", familyId);
  return new Map((data ?? []).map((p) => [p.id as string, ((p.full_name as string | null) ?? "").trim().split(/\s+/)[0] ?? ""]));
}

export function parseCountries(v: string | string[] | undefined): Country[] {
  const list = (Array.isArray(v) ? v : (v ?? "").split(",")).filter((c): c is Country => c === "PE" || c === "US");
  return list.length ? list : ["PE", "US"];
}
