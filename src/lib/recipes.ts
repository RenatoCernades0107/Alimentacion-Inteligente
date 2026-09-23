import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Country, InventoryItem, Recipe } from "@/lib/types";

export const RECIPE_SELECT = "*, recipe_ingredients(food_id, quantity, unit, optional, food:foods(*))";

export async function loadRecipesAndInventory(supabase: SupabaseClient, familyId: string) {
  const [{ data: recipes }, { data: inventory }] = await Promise.all([
    supabase.from("recipes").select(RECIPE_SELECT).order("name_es"),
    supabase.from("inventory_items").select("*").eq("family_id", familyId),
  ]);
  return { recipes: (recipes ?? []) as Recipe[], inventory: (inventory ?? []) as InventoryItem[] };
}

export function parseCountries(v: string | string[] | undefined): Country[] {
  const list = (Array.isArray(v) ? v : (v ?? "").split(",")).filter((c): c is Country => c === "PE" || c === "US");
  return list.length ? list : ["PE", "US"];
}
