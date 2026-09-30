import type { Country, MealSlot, MealStatus, Unit } from "@/lib/types";
import type { ShoppingEntry } from "./shopping";

export type PlanItem = { name: string; quantity: number | null; unit: Unit | null; optional: boolean };

export type PlanRecipe = {
  description: string | null;
  country: Country;
  minutes: number | null;
  servings: number;
  steps: string[];
  sourceUrl: string | null;
  /** JPEG ya recortado y reducido; null si la receta no tiene foto. */
  photo: Buffer | null;
  photoCredit: { author: string; license: string } | null;
};

export type PlanMeal = {
  id: string;
  date: string;
  slot: MealSlot;
  status: MealStatus;
  name: string;
  /** null si es una comida escrita a mano, sin receta. */
  recipe: PlanRecipe | null;
  items: PlanItem[];
};

export type PlanShopping = {
  entries: ShoppingEntry[];
  /** Comidas planificadas (desde hoy) con las que se calculó. */
  mealCount: number;
  /** De esas, cuántas no tienen ingredientes registrados. */
  mealsWithoutItems: number;
  /** Propuestas de los hijos que aún no se aceptan y por eso no cuentan. */
  proposals: number;
  /** Comidas planificadas de días que ya pasaron: no se cocinarán, así que no cuentan. */
  past: number;
};

export type PlanData = {
  locale: "es" | "en";
  familyName: string;
  today: string;
  /** Días elegidos (YYYY-MM-DD), ordenados. */
  dates: string[];
  /** Franjas del día de la familia, en orden. */
  slots: MealSlot[];
  /** Comidas de esos días, ordenadas por fecha y franja. */
  meals: PlanMeal[];
  /** Detalle de cada comida (foto, ingredientes, preparación). */
  showPlan: boolean;
  /** Lista de compras; null si no se pidió. */
  shopping: PlanShopping | null;
};
