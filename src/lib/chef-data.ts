import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/dates";
import { loadRecipesAndInventory } from "@/lib/recipes";
import { suggest } from "@/lib/suggestions";
import { MAX_DAYS_AHEAD, slotKey, toCard, type CalendarMeal, type DishCard, type SlotKey } from "@/lib/chef";
import { FOOD_COLUMNS, type ChefFood } from "@/lib/chef-custom";
import { mealName, type Meal } from "@/lib/types";

/** Días hacia atrás de comidas que ve el Chef (para respetar lo que la persona suele comer). */
export const HISTORY_DAYS = 14;

type MealRow = Pick<Meal, "id" | "date" | "slot" | "title" | "status" | "series_id" | "recipe_id" | "recipe">;
const MEAL_COLUMNS = "id, date, slot, title, status, series_id, recipe_id, recipe:recipes(name_es, name_en)";

/**
 * Datos del Chef IA: todas las recetas que ve el usuario como tarjetas (kcal, macros, ingredientes en
 * casa) y las franjas que ya tienen comida en el calendario en las próximas semanas (`busy`: nombres;
 * `calendar`: las comidas de cada franja). Con `withFoods` también los alimentos que ve (catálogo y de su
 * familia), el inventario y las comidas de los últimos días, para las recetas nuevas y el contexto.
 */
export async function loadChefData(supabase: SupabaseClient, familyId: string, today: string, locale: string, withFoods = false) {
  const until = addDays(today, MAX_DAYS_AHEAD);
  const [{ recipes, inventory }, { data: meals }, { data: foods }, { data: past }] = await Promise.all([
    loadRecipesAndInventory(supabase, familyId),
    supabase.from("meals").select(MEAL_COLUMNS).eq("family_id", familyId).gte("date", today).lte("date", until).neq("status", "cancelled"),
    withFoods ? supabase.from("foods").select(FOOD_COLUMNS).order("name_es") : Promise.resolve({ data: null }),
    withFoods
      ? supabase
          .from("meals")
          .select(MEAL_COLUMNS)
          .eq("family_id", familyId)
          .gte("date", addDays(today, -HISTORY_DAYS))
          .lt("date", today)
          .neq("status", "cancelled")
          .order("date")
      : Promise.resolve({ data: null }),
  ]);
  const cards: DishCard[] = suggest(recipes, inventory, { mode: "any", countries: ["PE", "US"], today }).map(toCard);
  const busy = new Map<SlotKey, string>();
  const calendar = new Map<SlotKey, CalendarMeal[]>();
  for (const m of (meals ?? []) as unknown as MealRow[]) {
    const key = slotKey(m.date, m.slot);
    const name = mealName(m, locale);
    busy.set(key, busy.has(key) ? `${busy.get(key)}, ${name}` : name);
    calendar.set(key, [...(calendar.get(key) ?? []), { id: m.id, name, status: m.status, seriesId: m.series_id, recipeId: m.recipe_id }]);
  }
  const history = ((past ?? []) as unknown as MealRow[]).map((m) => ({ date: m.date, slot: m.slot, name: mealName(m, locale), done: m.status === "completed" }));
  return { cards, busy, calendar, history, foods: (foods ?? []) as unknown as ChefFood[], inventory };
}
