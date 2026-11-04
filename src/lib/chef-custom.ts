/**
 * Recetas que inventa el Chef IA. La IA solo propone nombre, ingredientes (por nombre de alimento),
 * cantidades y pasos; aquí se validan con los mismos límites que una receta escrita a mano, cada
 * ingrediente se asocia a un alimento existente (catálogo o de la familia) y las kcal, macros y lo
 * que hay en casa los calcula la app (nunca se usan cifras de la IA).
 *
 * Sin imports de servidor: el cliente también usa los tipos y `customToRecipeInput`.
 */
import { MAX_CUSTOM, toCard, type CustomDish, type CustomIngredient, type CustomRecipe, type DraftData, type Plan, type RawNewRecipe } from "./chef";
import { MAX_KCAL_PER_SERVING, RECIPE_MEAL_TYPES, isEmoji, type RecipeInput, type RecipeMealType } from "./recipe-form";
import { kcalPerServing } from "./nutrition";
import { suggest } from "./suggestions";
import { UNITS } from "./units";
import type { Country, Food, InventoryItem, Recipe, Unit } from "./types";

/** Alimento tal como lo necesita el Chef (para elegir ingredientes y calcular kcal y macros). */
export type ChefFood = Pick<
  Food,
  "id" | "key" | "name_es" | "name_en" | "category" | "emoji" | "default_unit" | "kcal_100g" | "g_per_unit" | "g_per_ml" | "protein_100g" | "carbs_100g" | "fat_100g"
> & { aliases: string[] };

export const FOOD_COLUMNS = "id, key, name_es, name_en, category, emoji, default_unit, kcal_100g, g_per_unit, g_per_ml, protein_100g, carbs_100g, fat_100g, aliases";

/** Máximo de recetas nuevas que se aceptan en un turno. */
export const MAX_NEW_PER_TURN = 3;

const norm = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[_\s]+/g, " ")
    .trim()
    .toLowerCase();

/** Busca alimentos por key, nombre o alias (sin tildes ni mayúsculas; tolera plurales simples). */
export function foodLookup(foods: ChefFood[]) {
  const map = new Map<string, ChefFood>();
  // Primero alias y luego nombres y keys, para que estos últimos ganen si chocan.
  for (const f of foods) for (const a of f.aliases ?? []) if (!map.has(norm(a))) map.set(norm(a), f);
  for (const f of foods) for (const k of [f.name_en, f.name_es]) map.set(norm(k), f);
  for (const f of foods) if (f.key) map.set(norm(f.key), f);
  return (name: string | null | undefined): ChefFood | undefined => {
    if (typeof name !== "string" || !name.trim()) return undefined;
    const n = norm(name);
    return map.get(n) ?? map.get(n.replace(/es$/, "")) ?? map.get(n.replace(/s$/, "")) ?? map.get(`${n}s`);
  };
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const int = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null;

/**
 * Convierte lo que propone la IA en una receta válida, o null si no sirve (sin nombre, sin pasos,
 * menos de 2 ingredientes que existan, kcal imposibles…).
 */
export function parseNewRecipe(raw: RawNewRecipe, foods: ChefFood[], find = foodLookup(foods)): CustomRecipe | null {
  const name_es = clip(raw.name_es || raw.name_en, 80);
  const name_en = clip(raw.name_en || raw.name_es, 80);
  if (!name_es || !name_en) return null;

  const meal_types = RECIPE_MEAL_TYPES.filter((m) => (raw.meal_types ?? []).some((t) => norm(String(t)) === m));
  if (!meal_types.length) return null;

  const ingredients: CustomIngredient[] = [];
  for (const i of raw.ingredients ?? []) {
    const food = find(i?.food);
    if (!food || ingredients.some((x) => x.foodId === food.id)) continue;
    const q = typeof i.quantity === "number" && Number.isFinite(i.quantity) && i.quantity > 0 && i.quantity <= 100000 ? i.quantity : null;
    const unit = q === null ? null : UNITS.includes(i.unit as Unit) ? (i.unit as Unit) : food.default_unit;
    ingredients.push({
      foodId: food.id,
      name_es: food.name_es,
      name_en: food.name_en,
      emoji: food.emoji,
      quantity: q === null ? null : Math.round(q * 100) / 100,
      unit,
      optional: !!i.optional,
    });
    if (ingredients.length >= 60) break;
  }
  if (ingredients.filter((i) => !i.optional).length < 2) return null;

  const steps = (raw.steps ?? [])
    .map((s) => clip(s, 600))
    .filter(Boolean)
    .slice(0, 40);
  if (!steps.length) return null;

  const emoji = clip(raw.emoji, 16);
  const recipe: CustomRecipe = {
    name_es,
    name_en,
    description: clip(raw.description, 400),
    emoji: emoji && isEmoji(emoji) ? emoji : "🍽️",
    meal_types,
    servings: int(raw.servings, 1, 100) ?? 2,
    time_minutes: int(raw.time_minutes, 1, 1440),
    country: raw.country === "US" ? "US" : "PE",
    ingredients,
    steps,
  };
  return recipe;
}

/**
 * Tarjeta de una receta nueva, calculada como la de cualquier receta (kcal y macros de los
 * ingredientes, lo que hay en casa con el inventario). null si sus kcal no tienen sentido o algún
 * ingrediente ya no existe.
 */
export function customDish(
  id: string,
  recipe: CustomRecipe,
  ctx: { foods: ReadonlyMap<string, ChefFood>; inventory: InventoryItem[]; today: string },
): CustomDish | null {
  const ingredients = recipe.ingredients.map((i) => ({ ...i, food: ctx.foods.get(i.foodId) }));
  if (ingredients.some((i) => !i.food)) return null;
  const { kcal } = kcalPerServing(
    ingredients.map((i) => ({ quantity: i.quantity, unit: i.unit, optional: i.optional, food: i.food! })),
    recipe.servings,
  );
  if (kcal > MAX_KCAL_PER_SERVING) return null;

  const fake: Recipe = {
    id,
    slug: customSlug(id),
    country: recipe.country,
    name_es: recipe.name_es,
    name_en: recipe.name_en,
    description_es: recipe.description || null,
    description_en: recipe.description || null,
    emoji: recipe.emoji,
    image_url: null,
    meal_types: recipe.meal_types,
    servings: recipe.servings,
    time_minutes: recipe.time_minutes,
    source_url: null,
    steps_es: recipe.steps,
    steps_en: recipe.steps,
    kcal_per_serving: kcal > 0 ? kcal : null,
    kcal_complete: true,
    recipe_ingredients: ingredients.map((i) => ({
      food_id: i.foodId,
      quantity: i.quantity,
      unit: i.unit,
      optional: i.optional,
      food: i.food as unknown as Food,
    })),
  };
  const [s] = suggest([fake], ctx.inventory, { mode: "any", countries: [recipe.country], today: ctx.today });
  // Las recetas nuevas no traen las kcal de la base: la tarjeta se arma igual que las del catálogo.
  return { card: { ...toCard(s), custom: true }, recipe };
}

/** Slug que ve la IA para una receta nueva ya creada en el borrador. */
export const customSlug = (id: string) => `nueva-${id.slice(0, 8)}`;

/** Datos para guardar la receta nueva con `save_recipe` (mismo formato que el formulario de recetas). */
export function customToRecipeInput(r: CustomRecipe, locale: "es" | "en"): RecipeInput {
  return {
    sourceId: null,
    name: locale === "en" ? r.name_en : r.name_es,
    description: r.description,
    emoji: r.emoji,
    mealTypes: r.meal_types as RecipeMealType[],
    servings: r.servings,
    timeMinutes: r.time_minutes,
    country: r.country as Country,
    sourceUrl: "",
    ingredients: r.ingredients.map((i) => ({ foodId: i.foodId, quantity: i.quantity, unit: i.unit, optional: i.optional })),
    steps: r.steps,
  };
}

/**
 * Deja en el borrador las recetas nuevas que usa el plan (o `alsoKeep`, ej. cambios al calendario sin
 * confirmar) y, de las demás, las más recientes hasta
 * `MAX_CUSTOM` (para no perder una que se quitó y se quiere volver a poner).
 */
export function pruneCustom(custom: DraftData["custom"], plan: Plan, alsoKeep: Iterable<string> = []): DraftData["custom"] {
  const inPlan = new Set([...Object.values(plan).flatMap((e) => (e ? [e.recipeId] : [])), ...alsoKeep]);
  const entries = Object.entries(custom);
  const keep = entries.filter(([id]) => inPlan.has(id));
  const rest = entries.filter(([id]) => !inPlan.has(id)).slice(-Math.max(0, MAX_CUSTOM - keep.length));
  return Object.fromEntries([...keep, ...rest].slice(-MAX_CUSTOM));
}

/** Cambia en el plan los ids temporales de las recetas nuevas por los de las recetas ya guardadas. */
export function replaceRecipeIds(plan: Plan, saved: Record<string, string>): Plan {
  return Object.fromEntries(
    Object.entries(plan).map(([k, e]) => [k, e && saved[e.recipeId] ? { ...e, recipeId: saved[e.recipeId] } : e]),
  ) as Plan;
}
