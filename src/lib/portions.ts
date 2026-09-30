import { portionFor, slotShare, suggestedScale } from "./nutrition";
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
  /** Fracción de las kcal del día que corresponde a esta franja. */
  share: number;
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
}): PortionsData {
  const share = slotShare(args.slot, args.mealsPerDay);
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
    recipeServings: args.recipeServings,
    scale: args.scale,
    totalPortions,
    suggestedScale: wanted !== null && Math.abs(wanted - args.scale) > 1e-9 ? wanted : null,
    rows,
  };
}
