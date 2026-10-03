/**
 * Lógica pura de las recetas propias: validación del formulario, slug, textos bilingües, kcal y
 * qué receta se actualiza al guardar. Sin imports de servidor para usarla en el formulario (cliente),
 * en las server actions y en las pruebas.
 */
import { z } from "zod";
import { kcalPerServing, type FoodNutrition } from "./nutrition";
import { UNITS } from "./units";
import type { Country, Unit } from "./types";

export const RECIPE_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type RecipeMealType = (typeof RECIPE_MEAL_TYPES)[number];

/** Emojis para elegir en el formulario (también vale cualquier otro emoji que traiga la receta). */
export const RECIPE_EMOJIS = [
  "🍽️", "🍲", "🥘", "🍛", "🍝", "🍜", "🥗", "🍕", "🍔", "🌮", "🌯", "🥪",
  "🍳", "🥞", "🧇", "🍞", "🥐", "🍚", "🍣", "🥩", "🍗", "🍖", "🥓", "🐟",
  "🦐", "🥔", "🍟", "🥕", "🌽", "🍅", "🥑", "🍆", "🍄", "🧀", "🥚", "🥛",
  "🍎", "🍌", "🍓", "🍰", "🧁", "🍪", "🍩", "🍫", "🥤", "☕", "🍿", "🌶️",
] as const;

/** Un solo emoji (con variante, tono o unión ZWJ, o una bandera); lo usa el formulario y la validación. */
const EMOJI = /^(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*)$/u;
export const isEmoji = (v: string) => EMOJI.test(v);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Solo http(s): el link se muestra con <a href>, no puede ser javascript: ni data:. */
export function isHttpUrl(v: string) {
  if (/\s/.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────── Formulario ──────────────────────────────────────────

export type IngredientInput = {
  foodId: string;
  /** null = "al gusto" (sin cantidad ni unidad). */
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
};

export type RecipeInput = {
  /** Receta que se está editando; null = receta nueva. */
  sourceId: string | null;
  name: string;
  description: string;
  emoji: string;
  mealTypes: RecipeMealType[];
  servings: number;
  timeMinutes: number | null;
  country: Country;
  sourceUrl: string;
  ingredients: IngredientInput[];
  steps: string[];
};

const ingredientSchema = z
  .object({
    foodId: z.string().regex(UUID),
    quantity: z.number().positive().max(100000).nullable(),
    unit: z.enum(UNITS as [Unit, ...Unit[]]).nullable(),
    optional: z.boolean(),
  })
  // Cantidad y unidad van juntas.
  .refine((i) => (i.quantity === null) === (i.unit === null));

/** Los mismos límites que valida la base de datos (save_recipe); aquí dan el error antes. */
export const recipeInputSchema = z.object({
  sourceId: z.string().regex(UUID).nullable(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400),
  emoji: z.string().trim().refine((v) => v === "" || isEmoji(v)),
  mealTypes: z
    .array(z.enum(RECIPE_MEAL_TYPES))
    .min(1)
    .max(RECIPE_MEAL_TYPES.length)
    .transform((list) => RECIPE_MEAL_TYPES.filter((m) => list.includes(m))),
  servings: z.number().int().min(1).max(100),
  timeMinutes: z.number().int().min(1).max(1440).nullable(),
  country: z.enum(["PE", "US"]),
  sourceUrl: z.string().trim().max(500).refine((v) => v === "" || isHttpUrl(v)),
  ingredients: z
    .array(ingredientSchema)
    .min(1)
    .max(60)
    .refine((list) => new Set(list.map((i) => i.foodId)).size === list.length),
  // Los pasos en blanco se descartan (el formulario deja una fila vacía al final).
  steps: z
    .array(z.string().trim())
    .transform((list) => list.filter((s) => s.length > 0))
    .pipe(z.array(z.string().max(600)).max(40)),
});

export type ParsedRecipeInput = z.output<typeof recipeInputSchema>;

/** Valida lo que llega del cliente (que no es de fiar). */
export function parseRecipeInput(raw: unknown): { ok: true; data: ParsedRecipeInput } | { ok: false } {
  const r = recipeInputSchema.safeParse(raw);
  return r.success ? { ok: true, data: r.data } : { ok: false };
}

// ────────────────────────────────────────────── Slug ─────────────────────────────────────────────

/** Formato exigido por la base de datos para el slug de una receta propia (los del catálogo no llevan "_"). */
export const CUSTOM_SLUG = /^[a-z0-9-]{0,60}_[0-9a-f]{8}$/;

/** "Ají de gallina" + "a1b2c3d4" → "aji-de-gallina_a1b2c3d4". */
export function recipeSlug(name: string, suffix: string) {
  const base = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `${base || "receta"}_${suffix}`;
}

/** Slug candidato con sufijo aleatorio (la base de datos garantiza que sea único). */
export function newRecipeSlug(name: string) {
  return recipeSlug(name, crypto.randomUUID().replace(/-/g, "").slice(0, 8));
}

// ─────────────────────────────────────────── Bilingüe ────────────────────────────────────────────

export type RecipeTexts = {
  name_es: string;
  name_en: string;
  description_es: string | null;
  description_en: string | null;
  steps_es: string[];
  steps_en: string[];
};

export type Locale = "es" | "en";

/** Textos de una receta en el idioma de quien la mira (lo que se carga en el formulario). */
export function textsInLocale(recipe: RecipeTexts, locale: Locale) {
  return locale === "en"
    ? { name: recipe.name_en, description: recipe.description_en ?? "", steps: recipe.steps_en }
    : { name: recipe.name_es, description: recipe.description_es ?? "", steps: recipe.steps_es };
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Textos a guardar en ambos idiomas. El usuario escribe en su idioma; se guarda en los campos de ese
 * idioma y se copia al otro para que la receta se vea en los dos (no se traduce automáticamente).
 * Al editar una receta que ya tenía los dos idiomas, lo que NO se tocó conserva su otra versión (por
 * ejemplo, editar solo la descripción de una receta del catálogo no pisa los pasos en el otro idioma).
 */
export function localizeTexts(
  locale: Locale,
  next: { name: string; description: string; steps: string[] },
  current?: RecipeTexts | null,
): RecipeTexts {
  const own = current ? textsInLocale(current, locale) : null;
  const description = next.description.trim() || null;

  const nameChanged = !own || own.name !== next.name;
  const descriptionChanged = !own || (own.description.trim() || null) !== description;
  const stepsChanged = !own || !sameValue(own.steps, next.steps);

  return {
    name_es: nameChanged || !current ? next.name : current.name_es,
    name_en: nameChanged || !current ? next.name : current.name_en,
    description_es: descriptionChanged || !current ? description : current.description_es,
    description_en: descriptionChanged || !current ? description : current.description_en,
    steps_es: stepsChanged || !current ? next.steps : current.steps_es,
    steps_en: stepsChanged || !current ? next.steps : current.steps_en,
  };
}

// ────────────────────────────────────────────── kcal ─────────────────────────────────────────────

/** Máximo que acepta la base de datos (recipes.kcal_per_serving). */
export const MAX_KCAL_PER_SERVING = 5000;

/**
 * kcal por porción con la misma lógica del seed (src/lib/nutrition.ts): suma de los ingredientes
 * obligatorios dividida entre las porciones. `complete` es false si a algún obligatorio le falta el
 * dato de kcal (el chip muestra "~"). `tooHigh` avisa de cantidades o unidades que no cuadran.
 */
export function computeRecipeKcal(
  ingredients: Pick<IngredientInput, "foodId" | "quantity" | "unit" | "optional">[],
  foods: ReadonlyMap<string, FoodNutrition>,
  servings: number,
) {
  const noData: FoodNutrition = { kcal_100g: null, g_per_unit: null, g_per_ml: null };
  const { kcal, complete } = kcalPerServing(
    ingredients.map((i) => ({ quantity: i.quantity, unit: i.unit, optional: i.optional, food: foods.get(i.foodId) ?? noData })),
    servings,
  );
  return { kcal, complete, tooHigh: kcal > MAX_KCAL_PER_SERVING };
}

// ───────────────────────────────────────── Copia al editar ───────────────────────────────────────

export type EditTarget =
  /** Es una receta mía: se actualiza en su lugar. */
  | { kind: "in-place"; id: string }
  /** Ya hice una versión de esta receta: se edita esa. */
  | { kind: "my-copy"; id: string }
  /** Primera edición de una receta que no es mía: al guardar se crea mi versión. */
  | { kind: "new-copy"; parentId: string };

/**
 * Qué receta se actualiza al guardar una edición. Editar una receta que no es tuya (del catálogo o de
 * otro integrante) nunca la cambia: la primera vez se crea tu versión y las siguientes la actualizan.
 * Es la misma regla que aplica `save_recipe` en la base de datos (que es la que manda); aquí sirve para
 * decirle al usuario qué va a pasar y abrir directamente su versión.
 */
export function resolveEditTarget(
  recipe: { id: string; family_id?: string | null; created_by?: string | null },
  me: string,
  myRecipes: { id: string; parent_recipe_id?: string | null }[],
): EditTarget {
  if (recipe.family_id && recipe.created_by === me) return { kind: "in-place", id: recipe.id };
  const copy = myRecipes.find((r) => r.parent_recipe_id === recipe.id);
  return copy ? { kind: "my-copy", id: copy.id } : { kind: "new-copy", parentId: recipe.id };
}
