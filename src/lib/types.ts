import type { Activity, Pace, Sex } from "./body";

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
  /** Id de avatar predefinido (public/avatars). */
  avatar: string | null;
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
  /** kcal por 100 g del alimento (crudo o seco); null = sin dato. */
  kcal_100g: number | null;
  /** Gramos de "1 unidad". */
  g_per_unit: number | null;
  /** Gramos por ml (densidad). */
  g_per_ml: number;
  /** Macronutrientes por 100 g (mismo estado que kcal_100g); null = sin dato. */
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
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
  /** Dónde se guarda (src/lib/shelf-life.ts); null en filas antiguas o sin dato: se usa el lugar recomendado. */
  storage: "pantry" | "fridge" | "freezer" | null;
  /** Madurez de la fruta que madura después de cosechada; null si no aplica. */
  ripeness: "unripe" | "ripe" | null;
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
  /** kcal por porción con los ingredientes obligatorios (precalculado en el seed). */
  kcal_per_serving: number | null;
  /** false si a algún ingrediente obligatorio le falta el dato de kcal. */
  kcal_complete: boolean;
  /** null = receta del catálogo; si no, la familia dueña de esta receta propia. */
  family_id?: string | null;
  /** Autor de una receta propia. */
  created_by?: string | null;
  /** Original de la que es una versión personal (null si es del catálogo o se creó desde cero). */
  parent_recipe_id?: string | null;
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
  /** Ingredientes editados para esta comida (ya no son los de la receta). */
  custom_items: boolean;
  /** Multiplicador de los ingredientes de una comida con receta (1 = como rinde la receta). */
  portion_scale: number;
  /** kcal por porción ingresadas a mano (comidas sin receta). */
  kcal_per_serving: number | null;
  recipe?: Pick<Recipe, "id" | "slug" | "name_es" | "name_en" | "emoji" | "image_url" | "servings" | "kcal_per_serving" | "kcal_complete"> | null;
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
  custom_items?: boolean;
  kcal_per_serving?: number | null;
};

/** Integrante sin cuenta (bebé, niño), administrado por los padres. */
export type Dependent = {
  id: string;
  family_id: string;
  name: string;
  avatar: string | null;
};

/** Datos corporales de una persona (cuenta o dependiente). Privados: ver supabase/migrations. */
export type BodyRow = {
  id: string;
  profile_id: string | null;
  dependent_id: string | null;
  sex: Sex | null;
  birth_date: string | null;
  height_cm: number | null;
  activity: Activity;
  goal_weight_kg: number | null;
  goal_pace: Pace;
  goal_set_on: string | null;
};

export type WeightLog = {
  id: string;
  body_id: string;
  logged_on: string;
  weight_kg: number;
  height_cm: number | null;
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
