import type { BodyData, LogPoint } from "./body";
import type { BodyRow } from "./types";

/** Fila de `weight_logs` tal como llega de PostgREST (los numeric pueden venir como número o texto). */
export type LogRow = {
  body_id?: string;
  logged_on: string;
  weight_kg: number | string;
  height_cm: number | string | null;
};

/** Fila de `body_profiles` → datos para los cálculos de `body.ts`. */
export const toBodyData = (b: BodyRow | null | undefined): BodyData => ({
  sex: b?.sex ?? null,
  birthDate: b?.birth_date ?? null,
  heightCm: b?.height_cm != null ? Number(b.height_cm) : null,
  activity: b?.activity ?? "light",
  goalKg: b?.goal_weight_kg != null ? Number(b.goal_weight_kg) : null,
  pace: b?.goal_pace ?? "recommended",
});

/** Filas de `weight_logs` → pesajes para los cálculos de `body.ts`. */
export const toLogPoints = (rows: LogRow[] | null | undefined): LogPoint[] =>
  (rows ?? []).map((r) => ({ on: r.logged_on, kg: Number(r.weight_kg), cm: r.height_cm != null ? Number(r.height_cm) : null }));
