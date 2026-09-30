import { daysBetween, formatISO, isValidDate, parseDate } from "@/lib/dates";

/** Máximo de días que caben en un PDF (un mes). */
export const MAX_PLAN_DAYS = 31;

/** Hasta cuántos días antes o después de hoy se aceptan fechas. */
const RANGE_DAYS = 366;

/**
 * Fechas pedidas en el link del PDF ("2026-09-29,2026-09-30,…"): sin repetir y ordenadas.
 * `null` si no hay ninguna, si alguna no existe o está muy lejos, o si son demasiadas.
 */
export function parsePlanDates(raw: string | null, today: string): string[] | null {
  if (!raw) return null;
  const dates = [...new Set(raw.split(",").map((d) => d.trim()))];
  if (dates.length > MAX_PLAN_DAYS) return null;
  const valid = dates.every((d) => isValidDate(d) && formatISO(parseDate(d)) === d && Math.abs(daysBetween(today, d)) <= RANGE_DAYS);
  return valid ? dates.sort() : null;
}

/** Nombre del archivo: plan-de-comidas_2026-09-29_2026-10-05.pdf */
export function planFileName(locale: string, dates: string[], what: { plan: boolean; shopping: boolean }) {
  const en = locale === "en";
  const base = what.plan ? (en ? "meal-plan" : "plan-de-comidas") : en ? "shopping-list" : "lista-de-compras";
  const first = dates[0];
  const last = dates[dates.length - 1];
  return `${base}_${first}${last !== first ? `_${last}` : ""}.pdf`;
}
