import type { MealSlot, MealSeries, Recurrence } from "./types";
import { addDays, parseDate, formatISO } from "./dates";

export const RECURRENCES: Recurrence[] = ["daily", "weekdays", "weekly", "biweekly", "monthly"];
export const ALL_SLOTS: MealSlot[] = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"];

/** Franjas del día según cuántas comidas hace la familia. */
export function slotsFor(mealsPerDay: number): MealSlot[] {
  if (mealsPerDay >= 5) return ALL_SLOTS;
  if (mealsPerDay === 4) return ["breakfast", "lunch", "afternoon_snack", "dinner"];
  return ["breakfast", "lunch", "dinner"];
}

/** Tipo de receta que corresponde a cada franja. */
export function mealTypeForSlot(slot: MealSlot) {
  return slot === "morning_snack" || slot === "afternoon_snack" ? "snack" : slot;
}

/** Fechas (inclusive) en las que ocurre una serie dentro del rango [from, to]. */
export function occurrences(series: Pick<MealSeries, "recurrence" | "start_date" | "end_date">, from: string, to: string) {
  const out: string[] = [];
  const start = series.start_date;
  const end = series.end_date && series.end_date < to ? series.end_date : to;
  const startDate = parseDate(start);

  for (let d = from > start ? from : start; d <= end; d = addDays(d, 1)) {
    const date = parseDate(d);
    const dow = date.getUTCDay();
    const diff = Math.round((date.getTime() - startDate.getTime()) / 86_400_000);
    let ok = false;
    switch (series.recurrence) {
      case "daily": ok = true; break;
      case "weekdays": ok = dow >= 1 && dow <= 5; break;
      case "weekly": ok = diff % 7 === 0; break;
      case "biweekly": ok = diff % 14 === 0; break;
      case "monthly": ok = date.getUTCDate() === startDate.getUTCDate(); break;
    }
    if (ok) out.push(formatISO(date));
  }
  return out;
}

/** Cuántos días por delante se generan las comidas de una serie. */
export const MATERIALIZE_DAYS = 60;
