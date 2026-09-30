import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { materializeSeries } from "@/lib/calendar";
import { todayIn } from "@/lib/dates";
import { ALL_SLOTS, slotsFor } from "@/lib/meals";
import { localName, type Country, type Family, type MealSlot, type MealStatus, type Unit } from "@/lib/types";
import { loadPhoto } from "./photos";
import { buildShoppingList, type Need, type StockRow } from "./shopping";
import type { PlanData, PlanItem, PlanMeal, PlanRecipe } from "./types";
import photoCredits from "../../../public/recipes/CREDITS.json";

type FoodRef = { id: string; name_es: string; name_en: string; category: string };
/** Ingrediente de una comida (de la receta o editado); `meal_id` / `series_id` / `recipe_id` dicen de dónde salió. */
type ItemRow = {
  food_id: string;
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
  position?: number;
  meal_id?: string;
  series_id?: string;
  recipe_id?: string;
  food: FoodRef | null;
};
type RecipeRow = {
  slug: string;
  country: Country;
  name_es: string;
  name_en: string;
  description_es: string | null;
  description_en: string | null;
  image_url: string | null;
  time_minutes: number | null;
  servings: number;
  source_url: string | null;
  steps_es: string[];
  steps_en: string[];
};
type MealRow = {
  id: string;
  date: string;
  slot: MealSlot;
  status: MealStatus;
  title: string | null;
  recipe_id: string | null;
  series_id: string | null;
  recipe: RecipeRow | null;
  /** Solo existen si la base tiene la migración de ingredientes editables. */
  custom_items?: boolean;
  series?: { recipe_id: string | null; custom_items: boolean } | null;
};
type Locale = "es" | "en";

const MEAL_COLS =
  "id, date, slot, status, title, recipe_id, series_id, " +
  "recipe:recipes(slug, country, name_es, name_en, description_es, description_en, image_url, time_minutes, servings, source_url, steps_es, steps_en)";
const EDIT_COLS = ", custom_items, series:meal_series(recipe_id, custom_items)";
const ITEM_COLS = "food_id, quantity, unit, optional, food:foods(id, name_es, name_en, category)";

/**
 * Reúne todo lo que lleva el PDF: las comidas de los días elegidos con su receta, foto e ingredientes
 * y, si se pidió, la lista de compras (lo que falta después de descontar el inventario).
 * Usa el cliente del usuario, así que respeta RLS.
 */
export async function loadPlanData(args: {
  supabase: SupabaseClient;
  family: Family;
  locale: Locale;
  dates: string[];
  plan: boolean;
  shopping: boolean;
  /** Origen de la app, para pedir por HTTP las fotos que no estén en el disco. */
  origin: string;
}): Promise<PlanData> {
  const { supabase, family, locale, dates } = args;
  const today = todayIn(family.timezone);
  const slots = slotsFor(family.meals_per_day);

  // Las comidas recurrentes solo existen hasta cierta fecha: se generan hasta el último día pedido.
  await materializeSeries(family.id, dates[dates.length - 1]);

  // Como en el calendario, solo las franjas que la familia usa hoy.
  const rows = (await loadMeals(supabase, family.id, dates))
    .filter((m) => slots.includes(m.slot))
    .sort((a, b) => a.date.localeCompare(b.date) || ALL_SLOTS.indexOf(a.slot) - ALL_SLOTS.indexOf(b.slot));
  const itemRows = await loadItems(supabase, rows);
  const photos = args.plan ? await loadPhotos(rows, args.origin) : new Map<string, Buffer | null>();

  const meals: PlanMeal[] = rows.map((m) => ({
    id: m.id,
    date: m.date,
    slot: m.slot,
    status: m.status,
    name: m.recipe ? localName(m.recipe, locale) : (m.title ?? ""),
    recipe: m.recipe ? toRecipe(m.recipe, locale, photos.get(m.recipe.image_url ?? "") ?? null) : null,
    items: (itemRows.get(m.id) ?? []).map((r) => toPlanItem(r, locale)),
  }));

  return {
    locale,
    familyName: family.name,
    today,
    dates,
    slots,
    meals,
    showPlan: args.plan,
    shopping: args.shopping ? await buildShopping(supabase, family.id, meals, itemRows, today, locale) : null,
  };
}

async function loadMeals(supabase: SupabaseClient, familyId: string, dates: string[]) {
  const query = (cols: string) =>
    supabase.from("meals").select(cols).eq("family_id", familyId).in("date", dates).neq("status", "cancelled").order("created_at");
  let { data, error } = await query(MEAL_COLS + EDIT_COLS);
  // Sin la migración de ingredientes editables: se usan los de la receta.
  if (error) ({ data, error } = await query(MEAL_COLS));
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MealRow[];
}

/**
 * Ingredientes efectivos de cada comida (id de la comida → ingredientes), con el mismo criterio que
 * `loadMealItems` pero en 3 consultas para todas: los editados para esa comida, los de su
 * recurrencia (si sigue siendo la misma receta) o los de la receta.
 */
async function loadItems(supabase: SupabaseClient, meals: MealRow[]) {
  const ownItems = (m: MealRow) => !!m.custom_items;
  const seriesItems = (m: MealRow) => !ownItems(m) && !!m.series_id && !!m.series?.custom_items && m.series.recipe_id === m.recipe_id;
  const recipeItems = (m: MealRow) => !ownItems(m) && !seriesItems(m) && !!m.recipe_id;
  const ids = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => !!v))];

  const select = async (table: "meal_items" | "recipe_ingredients", key: "meal_id" | "series_id" | "recipe_id", values: string[]) => {
    if (!values.length) return [];
    const cols = `${key}, ${ITEM_COLS}${table === "meal_items" ? ", position" : ""}`;
    const { data, error } = await supabase.from(table).select(cols).in(key, values);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as ItemRow[]).filter((r) => r.food);
  };
  const [own, fromSeries, fromRecipe] = await Promise.all([
    select("meal_items", "meal_id", ids(meals.filter(ownItems).map((m) => m.id))),
    select("meal_items", "series_id", ids(meals.filter(seriesItems).map((m) => m.series_id))),
    select("recipe_ingredients", "recipe_id", ids(meals.filter(recipeItems).map((m) => m.recipe_id))),
  ]);

  const pick = (rows: ItemRow[], key: "meal_id" | "series_id" | "recipe_id", id: string | null) =>
    rows.filter((r) => id && r[key] === id);
  const byPosition = (a: ItemRow, b: ItemRow) => (a.position ?? 0) - (b.position ?? 0);
  // Primero los obligatorios, igual que en la página de la receta.
  const requiredFirst = (a: ItemRow, b: ItemRow) => Number(a.optional) - Number(b.optional);

  const out = new Map<string, ItemRow[]>();
  for (const m of meals) {
    if (ownItems(m)) out.set(m.id, pick(own, "meal_id", m.id).sort(byPosition));
    else if (seriesItems(m)) out.set(m.id, pick(fromSeries, "series_id", m.series_id).sort(byPosition));
    else if (recipeItems(m)) out.set(m.id, pick(fromRecipe, "recipe_id", m.recipe_id).sort(requiredFirst));
  }
  return out;
}

/** Fotos ya listas de las recetas de estas comidas (url → JPEG, o null si no se pudo leer). */
async function loadPhotos(meals: MealRow[], origin: string) {
  const urls = [...new Set(meals.flatMap((m) => (m.recipe?.image_url ? [m.recipe.image_url] : [])))];
  return new Map(await Promise.all(urls.map(async (url) => [url, await loadPhoto(url, origin)] as const)));
}

function toPlanItem(r: ItemRow, locale: Locale): PlanItem {
  const measured = !!r.quantity && !!r.unit;
  return { name: localName(r.food!, locale), quantity: measured ? r.quantity : null, unit: measured ? r.unit : null, optional: r.optional };
}

function toRecipe(r: RecipeRow, locale: Locale, photo: Buffer | null): PlanRecipe {
  return {
    description: (locale === "en" ? r.description_en : r.description_es) || null,
    country: r.country,
    minutes: r.time_minutes,
    servings: r.servings,
    steps: (locale === "en" ? r.steps_en : r.steps_es) ?? [],
    sourceUrl: r.source_url,
    photo,
    photoCredit: (photoCredits as Record<string, { author: string; license: string }>)[r.slug] ?? null,
  };
}

async function buildShopping(
  supabase: SupabaseClient,
  familyId: string,
  meals: PlanMeal[],
  itemRows: Map<string, ItemRow[]>,
  today: string,
  locale: Locale,
): Promise<NonNullable<PlanData["shopping"]>> {
  // Solo lo que aún se va a cocinar: planificadas y de hoy en adelante (lo completado ya descontó el inventario).
  const upcoming = meals.filter((m) => m.status === "planned" && m.date >= today);
  const needs: Need[] = upcoming.flatMap((meal) =>
    (itemRows.get(meal.id) ?? []).map((r) => ({
      foodId: r.food_id,
      name: localName(r.food!, locale),
      category: r.food!.category,
      quantity: r.quantity,
      unit: r.unit,
      optional: r.optional,
      meal: meal.name,
    })),
  );

  const foodIds = [...new Set(needs.map((n) => n.foodId))];
  let stock: StockRow[] = [];
  if (foodIds.length) {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("food_id, quantity, unit")
      .eq("family_id", familyId)
      .in("food_id", foodIds)
      .gt("quantity", 0);
    if (error) throw new Error(error.message);
    stock = (data ?? []) as StockRow[];
  }

  return {
    entries: buildShoppingList(needs, stock, locale),
    mealCount: upcoming.length,
    mealsWithoutItems: upcoming.filter((m) => !itemRows.get(m.id)?.length).length,
    proposals: meals.filter((m) => m.status === "proposed").length,
    past: meals.filter((m) => m.status === "planned" && m.date < today).length,
  };
}
