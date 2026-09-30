import { portionFor, slotShare, suggestedScale, type Portion } from "./nutrition";
import type { MealSlot } from "./types";

export type TargetState = "ok" | "incomplete" | "infant";

/**
 * Objetivo diario de una persona de la familia. Solo datos derivados (kcal): nunca el peso,
 * la estatura ni la meta de nadie. Lo construye src/lib/family-targets.ts en el servidor.
 */
export type MemberTarget = {
  key: string;
  kind: "profile" | "dependent";
  id: string;
  name: string;
  /** Imagen a mostrar (avatar elegido o foto de la cuenta); null = inicial. */
  avatarSrc: string | null;
  kcal: number | null;
  state: TargetState;
  /** El último pesaje es viejo: la kcal es orientativa. */
  stale: boolean;
  /** Página de datos de esa persona, solo si el visor puede abrirla. */
  href: string | null;
};

export type PortionRow = Omit<MemberTarget, "kcal"> & {
  /** Porciones estándar (múltiplos de ¼); null si no se puede calcular. */
  portion: number | null;
  /** kcal que aporta esa porción. */
  kcal: number | null;
  /** kcal de su meta para esta comida que no alcanzan a cubrirse con el máximo de porciones. */
  shortBy: number;
};

export type PortionsData = {
  /** kcal de una porción estándar de la comida; null si no hay dato. */
  kcalPerServing: number | null;
  /** false si a algún ingrediente obligatorio le falta el dato de kcal (el valor es aproximado). */
  complete: boolean;
  /** kcal extra por porción si se incluyen los ingredientes opcionales. */
  optionalKcal: number;
  /** Fracción de las kcal del día que corresponde a esta comida (la franja, dividida entre las comidas que la comparten). */
  share: number;
  /** Comidas que se reparten la franja (esta incluida). */
  siblings: number;
  /** Porciones que rinde la receta tal cual; null si la comida no tiene receta. */
  recipeServings: number | null;
  /** Multiplicador actual de los ingredientes. */
  scale: number;
  /** Suma de las porciones de todos los integrantes con datos. */
  totalPortions: number;
  /** Multiplicador que alcanza para todos; null si no aplica o ya coincide con el actual. */
  suggestedScale: number | null;
  rows: PortionRow[];
};

/** Reparte una comida entre los integrantes según la meta diaria de cada uno. */
export function buildPortions(args: {
  targets: MemberTarget[];
  kcalPerServing: number | null;
  complete: boolean;
  optionalKcal: number;
  slot: MealSlot;
  mealsPerDay: number;
  recipeServings: number | null;
  scale: number;
  /** Comidas que se reparten la franja (esta incluida); 1 si está sola. */
  siblings?: number;
}): PortionsData {
  const share = slotShare(args.slot, args.mealsPerDay) / Math.max(1, args.siblings ?? 1);
  const perServing = args.kcalPerServing && args.kcalPerServing > 0 ? args.kcalPerServing : null;

  const rows: PortionRow[] = args.targets.map((t) => {
    if (perServing === null || t.kcal === null || t.state !== "ok") {
      return { ...t, kcal: null, portion: null, shortBy: 0 };
    }
    const p = portionFor(t.kcal, share, perServing);
    return { ...t, kcal: p.kcal, portion: p.portion, shortBy: p.shortBy };
  });

  const totalPortions = rows.reduce((sum, r) => sum + (r.portion ?? 0), 0);
  const wanted = args.recipeServings && totalPortions > 0 ? suggestedScale(totalPortions, args.recipeServings) : null;

  return {
    kcalPerServing: perServing,
    complete: args.complete,
    optionalKcal: args.optionalKcal,
    share,
    siblings: Math.max(1, args.siblings ?? 1),
    recipeServings: args.recipeServings,
    scale: args.scale,
    totalPortions,
    suggestedScale: wanted !== null && Math.abs(wanted - args.scale) > 1e-9 ? wanted : null,
    rows,
  };
}

// ─────────────────────────────────── Tu porción y tu meta del día ─────────────────────────────────

/** Estados de una comida que cuentan para la meta del día: las propuestas y canceladas no. */
export const isCounted = (status: string) => status === "planned" || status === "completed";

/**
 * Porción de una comida para una persona, repartiendo la franja entre las comidas que la comparten
 * (por ejemplo una sopa y un segundo al almuerzo). Es la misma cuenta de la tabla de porciones.
 */
export function mealPortion(args: {
  targetKcal: number;
  mealsPerDay: number;
  slot: MealSlot;
  siblings: number;
  kcalPerServing: number;
}): Portion {
  return portionFor(args.targetKcal, slotShare(args.slot, args.mealsPerDay) / Math.max(1, args.siblings), args.kcalPerServing);
}

export type DayMeal = { slot: MealSlot; status: string; kcalPerServing: number | null };

export type DayProgress = {
  target: number;
  /** kcal de las porciones propias de las comidas ya completadas. */
  completed: number;
  /** kcal de las porciones propias de las comidas planificadas que faltan por comer. */
  planned: number;
  total: number;
  /** total / meta */
  ratio: number;
  /** Comidas que cuentan pero no tienen kcal (no suman). */
  unknown: number;
  /** empty: nada con kcal · low: < 90 % · ok: 90–110 % · over: > 110 %. */
  status: "empty" | "low" | "ok" | "over";
  /** kcal que faltan (low) o sobran (over), redondeadas a 10. */
  gap: number;
};

/**
 * Cuánto de la meta diaria de una persona cubren las comidas del día: la suma de su porción en cada comida
 * planificada (o ya completada). Cada franja se reparte entre las comidas que la comparten, así que un día
 * completo y equilibrado queda cerca del 100 %.
 */
export function dayProgress(args: { targetKcal: number; mealsPerDay: number; meals: DayMeal[] }): DayProgress {
  const counted = args.meals.filter((m) => isCounted(m.status));
  const perSlot = new Map<MealSlot, number>();
  for (const m of counted) perSlot.set(m.slot, (perSlot.get(m.slot) ?? 0) + 1);

  let completed = 0;
  let planned = 0;
  let unknown = 0;
  for (const m of counted) {
    if (!m.kcalPerServing || m.kcalPerServing <= 0) {
      unknown++;
      continue;
    }
    const { kcal } = mealPortion({
      targetKcal: args.targetKcal, mealsPerDay: args.mealsPerDay, slot: m.slot, siblings: perSlot.get(m.slot) ?? 1, kcalPerServing: m.kcalPerServing,
    });
    if (m.status === "completed") completed += kcal;
    else planned += kcal;
  }

  const total = completed + planned;
  const ratio = args.targetKcal > 0 ? total / args.targetKcal : 0;
  return {
    target: args.targetKcal,
    completed,
    planned,
    total,
    ratio,
    unknown,
    status: total === 0 ? "empty" : ratio < 0.9 ? "low" : ratio <= 1.1 ? "ok" : "over",
    gap: Math.round(Math.abs(args.targetKcal - total) / 10) * 10,
  };
}
