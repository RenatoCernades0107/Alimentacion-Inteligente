export type Role = "parent" | "child";
export type Unit = "unit" | "g" | "kg" | "ml" | "l";
export type MealSlot = "breakfast" | "morning_snack" | "lunch" | "afternoon_snack" | "dinner";
export type MealStatus = "proposed" | "planned" | "completed" | "cancelled";
export type Recurrence = "daily" | "weekdays" | "weekly" | "biweekly" | "monthly";
export type Country = "PE" | "US";

export type Family = {
  id: string;
  name: string;
  meals_per_day: 3 | 4 | 5;
  timezone: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  locale: "es" | "en";
  family_id: string | null;
  role: Role | null;
};

export type Food = {
  id: string;
  key: string | null;
  family_id: string | null;
  name_es: string;
  name_en: string;
  category: string;
  emoji: string | null;
  image_url: string | null;
  shelf_life_days: number | null;
  default_unit: Unit;
};

export type InventoryItem = {
  id: string;
  family_id: string;
  food_id: string | null;
  barcode: string | null;
  product_name: string | null;
  brand: string | null;
  image_url: string | null;
  quantity: number;
  unit: Unit;
  expires_on: string | null;
  expiry_estimated: boolean;
  created_at: string;
  food?: Food | null;
};

export type RecipeIngredient = {
  food_id: string;
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
  food?: Food;
};

export type Recipe = {
  id: string;
  slug: string;
  country: Country;
  name_es: string;
  name_en: string;
  description_es: string | null;
  description_en: string | null;
  emoji: string | null;
  image_url: string | null;
  meal_types: string[];
  servings: number;
  time_minutes: number | null;
  source_url: string | null;
  steps_es: string[];
  steps_en: string[];
  recipe_ingredients?: RecipeIngredient[];
};

export type Meal = {
  id: string;
  family_id: string;
  date: string;
  slot: MealSlot;
  recipe_id: string | null;
  title: string | null;
  series_id: string | null;
  is_exception: boolean;
  status: MealStatus;
  proposed_by: string | null;
  completed_at: string | null;
  recipe?: Pick<Recipe, "id" | "slug" | "name_es" | "name_en" | "emoji" | "image_url"> | null;
  series?: { recurrence: Recurrence } | null;
  proposer?: { full_name: string | null } | null;
};

export type MealSeries = {
  id: string;
  family_id: string;
  recipe_id: string | null;
  title: string | null;
  slot: MealSlot;
  recurrence: Recurrence;
  start_date: string;
  end_date: string | null;
  materialized_until: string;
};

/** Nombre localizado de un registro con name_es / name_en. */
export function localName(row: { name_es: string; name_en: string }, locale: string) {
  return locale === "en" ? row.name_en : row.name_es;
}

/** Nombre que se muestra para un ítem del inventario. */
export function itemName(item: InventoryItem, locale: string) {
  if (item.product_name) return item.product_name;
  return item.food ? localName(item.food, locale) : "—";
}

/** Nombre que se muestra para una comida del calendario. */
export function mealName(meal: Pick<Meal, "title" | "recipe">, locale: string) {
  return meal.recipe ? localName(meal.recipe, locale) : (meal.title ?? "");
}
