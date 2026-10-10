/**
 * Calorías de ingredientes y comidas, reparto por franja y porciones por integrante.
 * Sin imports en tiempo de ejecución (solo tipos) para poder usarlo también desde scripts de Node
 * (scripts/build-seed.mjs importa este archivo).
 */
import type { MealSlot, Unit } from "./types";

/** Datos nutricionales de un alimento: kcal por 100 g y equivalencias para pasar a gramos. */
export type FoodNutrition = {
  kcal_100g: number | null;
  /** Gramos de "1 unidad". */
  g_per_unit: number | null;
  /** Gramos por ml (densidad); 1 si se omite. */
  g_per_ml: number | null;
  /** Macronutrientes por 100 g; null u omitidos = sin dato (alimentos propios). */
  protein_100g?: number | null;
  carbs_100g?: number | null;
  fat_100g?: number | null;
};

export type NutritionItem = {
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
  food: FoodNutrition;
};

/** Gramos de una cantidad; `null` si no se puede saber (ej. "unidades" sin peso por unidad). */
export function toGrams(food: FoodNutrition, quantity: number, unit: Unit): number | null {
  switch (unit) {
    case "g":
      return quantity;
    case "kg":
      return quantity * 1000;
    case "ml":
      return quantity * (food.g_per_ml ?? 1);
    case "l":
      return quantity * 1000 * (food.g_per_ml ?? 1);
    case "unit":
      return food.g_per_unit != null ? quantity * food.g_per_unit : null;
  }
}

/**
 * kcal de un ingrediente. Sin cantidad ("al gusto") suma 0; `null` si falta el dato del alimento.
 */
export function ingredientKcal(item: NutritionItem): number | null {
  if (item.quantity == null || item.unit == null) return 0;
  if (item.food.kcal_100g == null) return null;
  const grams = toGrams(item.food, item.quantity, item.unit);
  return grams == null ? null : (grams * item.food.kcal_100g) / 100;
}

export type ItemsKcal = {
  /** kcal de los ingredientes obligatorios (para toda la receta). */
  kcal: number;
  /** kcal extra si se incluyen los opcionales. */
  optionalKcal: number;
  /** false si algún ingrediente obligatorio no tiene dato de kcal. */
  complete: boolean;
};

export function itemsKcal(items: NutritionItem[]): ItemsKcal {
  let kcal = 0;
  let optionalKcal = 0;
  let complete = true;
  for (const item of items) {
    const k = ingredientKcal(item);
    if (item.optional) {
      if (k != null) optionalKcal += k;
    } else if (k == null) {
      complete = false;
    } else {
      kcal += k;
    }
  }
  return { kcal, optionalKcal, complete };
}

/** kcal por porción de una receta a partir de sus ingredientes (cantidades para `servings` porciones). */
export function kcalPerServing(items: NutritionItem[], servings: number) {
  const { kcal, optionalKcal, complete } = itemsKcal(items);
  const n = Math.max(1, servings);
  return { kcal: Math.round(kcal / n), optionalKcal: Math.round(optionalKcal / n), complete };
}

// ───────────────────────────────────────── Macronutrientes ──────────────────────────────────────

export type Macros = { protein: number; carbs: number; fat: number };

/**
 * Gramos de proteína, carbohidratos y grasa de un ingrediente. Sin cantidad suma 0; `null` si falta
 * el dato del alimento o no se puede pasar a gramos.
 */
export function ingredientMacros(item: NutritionItem): Macros | null {
  if (item.quantity == null || item.unit == null) return { protein: 0, carbs: 0, fat: 0 };
  const { protein_100g: p, carbs_100g: c, fat_100g: f } = item.food;
  if (p == null || c == null || f == null) return null;
  const grams = toGrams(item.food, item.quantity, item.unit);
  if (grams == null) return null;
  return { protein: (grams * p) / 100, carbs: (grams * c) / 100, fat: (grams * f) / 100 };
}

/**
 * Macros por porción de una receta con los ingredientes obligatorios (como las kcal), redondeados al
 * gramo. `complete` es false si a algún obligatorio le falta el dato.
 */
export function macrosPerServing(items: NutritionItem[], servings: number): Macros & { complete: boolean } {
  const total = { protein: 0, carbs: 0, fat: 0 };
  let complete = true;
  for (const item of items) {
    if (item.optional) continue;
    const m = ingredientMacros(item);
    if (!m) {
      complete = false;
      continue;
    }
    total.protein += m.protein;
    total.carbs += m.carbs;
    total.fat += m.fat;
  }
  const n = Math.max(1, servings);
  return { protein: Math.round(total.protein / n), carbs: Math.round(total.carbs / n), fat: Math.round(total.fat / n), complete };
}

/** Parte de las kcal que aporta cada macro (4 / 4 / 9 kcal por gramo), en fracciones que suman 1. */
export function macroSplit({ protein, carbs, fat }: Macros): Macros {
  const kcal = protein * 4 + carbs * 4 + fat * 9;
  if (kcal <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: (protein * 4) / kcal, carbs: (carbs * 4) / kcal, fat: (fat * 9) / kcal };
}

// ─────────────────────────────────────── Reparto por franja ─────────────────────────────────────

const SHARES_3: Partial<Record<MealSlot, number>> = { breakfast: 0.25, lunch: 0.4, dinner: 0.35 };
const SHARES_4: Partial<Record<MealSlot, number>> = { breakfast: 0.25, morning_snack: 0.1, lunch: 0.35, dinner: 0.3 };
const SHARES_5: Record<MealSlot, number> = { breakfast: 0.2, morning_snack: 0.1, lunch: 0.3, afternoon_snack: 0.1, dinner: 0.3 };

/**
 * Fracción de las kcal del día que corresponde a una franja, según cuántas comidas hace la familia
 * (el almuerzo es la principal). Una franja fuera de la configuración vigente usa el reparto de 5.
 */
export function slotShare(slot: MealSlot, mealsPerDay: number): number {
  const table = mealsPerDay >= 5 ? SHARES_5 : mealsPerDay === 4 ? SHARES_4 : SHARES_3;
  return table[slot] ?? SHARES_5[slot];
}

// ───────────────────────────────────────────── Porciones ────────────────────────────────────────

export const MIN_PORTION = 0.25;
export const MAX_PORTION = 2;

export type Portion = {
  /** Porciones (múltiplos de ¼). */
  portion: number;
  /** kcal que aporta esa porción. */
  kcal: number;
  /** kcal de la meta de esta comida que no alcanzan a cubrirse con el máximo de porciones. */
  shortBy: number;
};

/** Porción de una comida para una persona: al ¼ más cercano, entre ¼ y 2. */
export function portionFor(kcalDay: number, share: number, kcalPerServingValue: number): Portion {
  const target = kcalDay * share;
  const raw = target / Math.max(1, kcalPerServingValue);
  const portion = Math.min(MAX_PORTION, Math.max(MIN_PORTION, Math.round(raw * 4) / 4));
  const kcal = Math.round(portion * kcalPerServingValue);
  const shortBy = raw > MAX_PORTION + 0.125 ? Math.round(target - kcal) : 0;
  return { portion, kcal, shortBy: Math.max(0, shortBy) };
}

const FRACTIONS: Record<number, string> = { 0.25: "¼", 0.5: "½", 0.75: "¾" };

/** 1.25 → "1¼", 0.5 → "½", 2 → "2". */
export function formatPortion(p: number): string {
  const q = Math.round(p * 4) / 4;
  const whole = Math.floor(q);
  const frac = FRACTIONS[q - whole] ?? "";
  return whole === 0 ? frac || "0" : `${whole}${frac}`;
}

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 20;

/**
 * Multiplicador de ingredientes para cocinar `portions` porciones con una receta que rinde `servings`.
 * Se redondea hacia arriba a ¼ para que nadie se quede corto (con una pequeña tolerancia).
 */
export function suggestedScale(portions: number, servings: number): number {
  const x = portions / Math.max(1, servings);
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.ceil(x * 4 - 0.05) / 4));
}
