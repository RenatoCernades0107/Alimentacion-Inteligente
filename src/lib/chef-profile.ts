/**
 * Lo que el Chef IA sabe de la persona: sus datos corporales, su objetivo calculado por la app y cómo
 * viene su peso. Puro (sin base de datos) para poder probarlo; `loadMyBody` (src/lib/my-target.ts) lo carga.
 */
import { bmi, classifyBmi, healthyRangeKg, type BodyData, type DailyTarget, type LogPoint } from "./body";
import { daysBetween } from "./dates";

export type ChefProfile = {
  sex: "female" | "male" | null;
  age: number | null;
  heightCm: number | null;
  activity: BodyData["activity"];
  pace: BodyData["pace"];
  weightKg: number | null;
  goalKg: number | null;
  bmi: number | null;
  bmiClass: ReturnType<typeof classifyBmi> | null;
  healthyKg: { min: number; max: number } | null;
  bmr: number | null;
  tdee: number | null;
  direction: "lose" | "gain" | "maintain" | null;
  weeklyKg: number | null;
  weeksToGoal: number | null;
  milestoneKg: number | null;
  capped: string | null;
  /** Cambio de peso por semana en los pesajes recientes (+ sube, − baja); null si no hay suficientes. */
  trendPerWeek: number | null;
  lastWeighIn: string | null;
  stale: boolean;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function chefProfile(body: BodyData | null, logs: LogPoint[], target: DailyTarget | null): ChefProfile | null {
  if (!body) return null;
  const sorted = [...logs].sort((a, b) => (a.on < b.on ? -1 : 1));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = first && last ? daysBetween(first.on, last.on) : 0;
  const age = target?.age?.years ?? null;
  const cm = target?.heightCm ?? body.heightCm;
  const kg = target?.weightKg ?? last?.kg ?? null;
  const value = kg && cm ? bmi(kg, cm) : null;
  const range = cm && age != null && age >= 18 ? healthyRangeKg(cm, age) : null;
  const plan = target?.plan ?? null;
  return {
    sex: body.sex,
    age,
    heightCm: cm ?? null,
    activity: body.activity,
    pace: body.pace,
    weightKg: kg,
    goalKg: plan?.goalKg ?? body.goalKg,
    bmi: value ? r1(value) : null,
    bmiClass: value && age != null && age >= 18 ? classifyBmi(value, age) : null,
    healthyKg: range ? { min: range.minKg, max: range.maxKg } : null,
    bmr: plan?.bmr ?? null,
    tdee: plan?.tdee ?? null,
    direction: plan?.direction ?? null,
    weeklyKg: plan ? r1(plan.weeklyKg) : null,
    weeksToGoal: plan?.weeks ?? null,
    milestoneKg: plan?.milestoneKg ?? null,
    capped: plan?.capped ?? null,
    trendPerWeek: days >= 7 ? r1(((last.kg - first.kg) / days) * 7) : null,
    lastWeighIn: last?.on ?? null,
    stale: !!target?.stale,
  };
}

const ACTIVITY_TEXT: Record<BodyData["activity"], string> = {
  sedentary: "sedentaria", light: "ligera", moderate: "moderada", active: "activa", very_active: "muy activa",
};
const PACE_TEXT: Record<BodyData["pace"], string> = { gentle: "suave", recommended: "recomendado", fast: "rápido" };
const BMI_TEXT = { under: "bajo peso", healthy: "saludable", over: "sobrepeso", obese: "obesidad" } as const;
const DIRECTION_TEXT = { lose: "bajar", gain: "subir", maintain: "mantener" } as const;

/** El perfil como líneas compactas para el prompt (solo lo que se sabe). */
export function profileLines(p: ChefProfile | null): string[] {
  if (!p) return ["- Aún no completó sus datos de cuerpo (peso, estatura, edad)."];
  const lines: string[] = [];
  const who = [p.sex && (p.sex === "female" ? "mujer" : "hombre"), p.age != null && `${p.age} años`, p.heightCm && `${p.heightCm} cm`].filter(Boolean);
  if (who.length) lines.push(`- ${who.join(", ")}. Actividad física: ${ACTIVITY_TEXT[p.activity]}.`);
  if (p.weightKg) {
    let w = `- Peso actual ~${p.weightKg} kg`;
    if (p.bmi) w += ` (IMC ${p.bmi}${p.bmiClass ? `, ${BMI_TEXT[p.bmiClass]}` : ""})`;
    if (p.healthyKg) w += `; rango saludable para su estatura ${p.healthyKg.min}–${p.healthyKg.max} kg`;
    if (p.trendPerWeek != null) w += `; últimas semanas: ${p.trendPerWeek > 0 ? "+" : ""}${p.trendPerWeek} kg/semana`;
    if (p.stale) w += ` (último pesaje ${p.lastWeighIn}, desactualizado)`;
    lines.push(`${w}.`);
  }
  if (p.bmr && p.tdee) lines.push(`- Metabolismo basal ~${p.bmr} kcal; gasto diario ~${p.tdee} kcal.`);
  if (p.direction) {
    let g = `- Meta de peso: ${p.goalKg ? `${p.goalKg} kg (${DIRECTION_TEXT[p.direction]})` : DIRECTION_TEXT[p.direction]}`;
    if (p.direction !== "maintain") {
      g += `, ritmo ${PACE_TEXT[p.pace]} (~${p.weeklyKg} kg/semana)`;
      if (p.weeksToGoal) g += `, ~${p.weeksToGoal} semanas para llegar`;
      if (p.milestoneKg) g += `; meta intermedia ${p.milestoneKg} kg`;
    }
    if (p.capped) g += ` (la app limitó las kcal por seguridad)`;
    lines.push(`${g}.`);
  }
  return lines;
}
