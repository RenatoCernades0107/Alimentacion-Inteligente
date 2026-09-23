import type { Unit } from "./types";

export const UNITS: Unit[] = ["unit", "g", "kg", "ml", "l"];

const BASE: Record<Unit, { base: "unit" | "g" | "ml"; factor: number }> = {
  unit: { base: "unit", factor: 1 },
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
};

/** Convierte entre unidades compatibles (g↔kg, ml↔l). Devuelve null si no son compatibles. */
export function convert(quantity: number, from: Unit, to: Unit): number | null {
  if (BASE[from].base !== BASE[to].base) return null;
  return (quantity * BASE[from].factor) / BASE[to].factor;
}

export function formatQuantity(q: number) {
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(/\.?0+$/, "");
}
