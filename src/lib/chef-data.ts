import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/dates";
import { loadRecipesAndInventory } from "@/lib/recipes";
import { suggest } from "@/lib/suggestions";
import { MAX_DAYS_AHEAD, slotKey, toCard, type DishCard, type SlotKey } from "@/lib/chef";
import { mealName, type Meal } from "@/lib/types";

/**
 * Datos del Chef IA: todas las recetas que ve el usuario como tarjetas (kcal, macros, ingredientes en
 * casa) y las franjas que ya tienen comida en el calendario en las próximas semanas.
 */
export async function loadChefData(supabase: SupabaseClient, familyId: string, today: string, locale: string) {
  const until = addDays(today, MAX_DAYS_AHEAD);
  const [{ recipes, inventory }, { data: meals }] = await Promise.all([
    loadRecipesAndInventory(supabase, familyId),
    supabase
      .from("meals")
      .select("date, slot, title, recipe:recipes(name_es, name_en)")
      .eq("family_id", familyId)
      .gte("date", today)
      .lte("date", until)
      .neq("status", "cancelled"),
  ]);
  const cards: DishCard[] = suggest(recipes, inventory, { mode: "any", countries: ["PE", "US"], today }).map(toCard);
  const busy = new Map<SlotKey, string>();
  for (const m of (meals ?? []) as unknown as Pick<Meal, "date" | "slot" | "title" | "recipe">[]) {
    const key = slotKey(m.date, m.slot);
    busy.set(key, busy.has(key) ? `${busy.get(key)}, ${mealName(m, locale)}` : mealName(m, locale));
  }
  return { cards, busy };
}
