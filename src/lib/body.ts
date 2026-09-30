/**
 * Peso, IMC, gasto energético y metas. Funciones puras: sin React ni Supabase, para poder probarlas.
 * Las fechas son YYYY-MM-DD y "hoy" siempre se recibe como parámetro.
 *
 * Fundamento (ver plan): Mifflin–St Jeor para adultos, ecuaciones EER del IOM (DRI 2005) para
 * menores, IMC OMS/MINSA (y tabla INS para mayores de 60), balance energético semanal para el plazo.
 */
import { daysBetween, formatISO, parseDate } from "./dates";

export type Sex = "female" | "male";
export type Activity = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Pace = "gentle" | "recommended" | "fast";

export const SEXES: Sex[] = ["female", "male"];
export const ACTIVITIES: Activity[] = ["sedentary", "light", "moderate", "active", "very_active"];
export const PACES: Pace[] = ["gentle", "recommended", "fast"];

/** Kilocalorías por kg de peso corporal (aproximación clásica; el modelo la aplica semana a semana). */
const KCAL_PER_KG = 7700;
/** Semanas máximas que se simulan antes de decir "más de 3 años". */
export const MAX_WEEKS = 156;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const round10 = (n: number) => Math.round(n / 10) * 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const half = (n: number) => Math.round(n * 2) / 2;

// ───────────────────────────────────────────── Edad ─────────────────────────────────────────────

export type BodyAge = {
  /** Años cumplidos. */
  years: number;
  /** Meses cumplidos en total. */
  months: number;
};

/** Fecha real (rechaza 2026-02-31, que `Date.UTC` normalizaría a marzo). */
export function isRealDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && formatISO(parseDate(s)) === s;
}

/** Edad en la fecha `on`. `null` si la fecha es inválida, está en el futuro o supera los 120 años. */
export function ageOn(birth: string | null | undefined, on: string): BodyAge | null {
  if (!isRealDate(birth) || !isRealDate(on)) return null;
  const [by, bm, bd] = birth.split("-").map(Number);
  const [oy, om, od] = on.split("-").map(Number);
  let months = (oy - by) * 12 + (om - bm);
  if (od < bd) months -= 1;
  if (months < 0) return null;
  const years = Math.floor(months / 12);
  if (years > 120) return null;
  return { years, months };
}

export type AgeBand = "infant" | "toddler" | "child" | "teen" | "adult" | "senior";

export function ageBand(age: BodyAge): AgeBand {
  if (age.months < 12) return "infant";
  if (age.months < 36) return "toddler";
  if (age.years < 13) return "child";
  if (age.years < 18) return "teen";
  if (age.years < 60) return "adult";
  return "senior";
}

export const isMinor = (age: BodyAge) => age.years < 18;

// ─────────────────────────────────────────────── IMC ────────────────────────────────────────────

export const bmi = (kg: number, cm: number) => kg / (cm / 100) ** 2;
export const weightForBmi = (value: number, cm: number) => value * (cm / 100) ** 2;

/** Revisa que el par peso/estatura sea plausible; fuera de rango conviene pedir confirmación. */
export function plausibleBmi(kg: number, cm: number): "ok" | "low" | "high" {
  const b = bmi(kg, cm);
  return b < 12 ? "low" : b > 50 ? "high" : "ok";
}

export type BmiClass = "under" | "healthy" | "over" | "obese";

export type BmiBands = {
  /** IMC bajo el cual se considera bajo peso. */
  underTo: number;
  /** IMC mínimo permitido para una meta. */
  goalMin: number;
  /** IMC del peso recomendado (centro del rango saludable). */
  center: number;
  overFrom: number;
  obeseFrom: number;
  /** IMC máximo del rango saludable. */
  healthyTop: number;
};

/**
 * Cortes de IMC según la edad. 18–59: OMS/MINSA. ≥60: tabla INS/CENAN para adulto mayor
 * (≤23 delgadez, >23–<28 normal, ≥28–<32 sobrepeso, ≥32 obesidad).
 */
export function bmiBands(years: number): BmiBands {
  return years >= 60
    ? { underTo: 23, goalMin: 23.5, center: 25.5, overFrom: 28, obeseFrom: 32, healthyTop: 27.9 }
    : { underTo: 18.5, goalMin: 18.5, center: 22, overFrom: 25, obeseFrom: 30, healthyTop: 24.9 };
}

export function classifyBmi(value: number, years: number): BmiClass {
  if (years >= 60) return value <= 23 ? "under" : value < 28 ? "healthy" : value < 32 ? "over" : "obese";
  return value < 18.5 ? "under" : value < 25 ? "healthy" : value < 30 ? "over" : "obese";
}

/** Rango saludable y peso recomendado (kg, al 0.5 más cercano) para una estatura. */
export function healthyRangeKg(cm: number, years: number) {
  const b = bmiBands(years);
  return {
    minKg: Math.ceil(weightForBmi(b.goalMin, cm) * 2) / 2,
    maxKg: Math.floor(weightForBmi(b.healthyTop, cm) * 2) / 2,
    recommendedKg: half(weightForBmi(b.center, cm)),
  };
}

// ───────────────────────────────────────── Gasto energético ─────────────────────────────────────

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Metabolismo basal, Mifflin–St Jeor (kcal/día). */
export function mifflin(sex: Sex, kg: number, cm: number, years: number) {
  return 10 * kg + 6.25 * cm - 5 * years + (sex === "male" ? 5 : -161);
}

export const tdee = (bmr: number, activity: Activity) => bmr * ACTIVITY_FACTOR[activity];

/** Coeficiente de actividad física (PA) del IOM; nuestros 5 niveles se mapean por equivalencia de PAL. */
const IOM_PA: Record<Sex, Record<Activity, number>> = {
  male: { sedentary: 1, light: 1.13, moderate: 1.13, active: 1.26, very_active: 1.42 },
  female: { sedentary: 1, light: 1.16, moderate: 1.16, active: 1.31, very_active: 1.56 },
};

/**
 * Requerimiento energético estimado de un menor (IOM, DRI 2005), incluye la energía de crecimiento.
 * 12–35 meses: 89·kg − 100 + 20. 3–17 años: ecuación por sexo (+20 kcal hasta los 8, +25 desde los 9).
 * `null` fuera de 12 meses–17 años.
 */
export function iomEer(sex: Sex, ageMonths: number, kg: number, cm: number, activity: Activity): number | null {
  if (ageMonths < 12 || ageMonths >= 18 * 12) return null;
  if (ageMonths < 36) return 89 * kg - 100 + 20;
  const age = ageMonths / 12;
  const m = cm / 100;
  const pa = IOM_PA[sex][activity];
  const growth = age < 9 ? 20 : 25;
  return sex === "male"
    ? 88.5 - 61.9 * age + pa * (26.7 * kg + 903 * m) + growth
    : 135.3 - 30.8 * age + pa * (10 * kg + 934 * m) + growth;
}

// ───────────────────────────────────────────── Peso ─────────────────────────────────────────────

export type WeightPoint = { on: string; kg: number };

/**
 * Peso "tendencia": promedio móvil exponencial con el tiempo real entre pesajes
 * (constante de 7 días). Suaviza las fluctuaciones de agua y sal. Ordena los pesajes internamente.
 */
export function trendKg(logs: WeightPoint[]): number | null {
  if (!logs.length) return null;
  const sorted = [...logs].sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
  let trend = sorted[0].kg;
  for (let i = 1; i < sorted.length; i++) {
    const days = daysBetween(sorted[i - 1].on, sorted[i].on);
    if (days <= 0) continue;
    trend += (1 - Math.exp(-days / 7)) * (sorted[i].kg - trend);
  }
  return trend;
}

/** Rango dentro del cual puede quedar la meta de un adulto (kg, pasos de 0.5). */
export function goalRange(cm: number, years: number, currentKg: number) {
  const { minKg, maxKg } = healthyRangeKg(cm, years);
  // Con sobrepeso la meta no puede ser mayor que el peso actual; con peso saludable o bajo, hasta el tope saludable.
  return { min: minKg, max: Math.max(maxKg, Math.floor(currentKg * 2) / 2) };
}

/** Recorta una meta al rango permitido. `clamped` indica si tuvo que corregirse. */
export function clampGoal(goalKg: number, p: { cm: number; years: number; kg: number }) {
  const { min, max } = goalRange(p.cm, p.years, p.kg);
  const snapped = half(goalKg);
  const kg = clamp(snapped, min, max);
  return { kg, clamped: kg !== snapped };
}

// ───────────────────────────────────────── Plan del adulto ──────────────────────────────────────

export type PlanCap = "floor" | "deficit25" | "surplus500" | "senior";

export type PlanInput = {
  sex: Sex;
  years: number;
  cm: number;
  /** Peso tendencia actual. */
  kg: number;
  goalKg: number | null;
  activity: Activity;
  pace: Pace;
};

export type Plan = {
  direction: "lose" | "gain" | "maintain";
  bmr: number;
  tdee: number;
  /** kcal/día objetivo (múltiplo de 10). */
  kcal: number;
  /** kg/semana efectivos (siempre positivo; la dirección va aparte). */
  weeklyKg: number;
  /** Semanas hasta la meta con esa ingesta fija; `null` = más de 3 años o no se alcanza. */
  weeks: number | null;
  goalKg: number | null;
  goalClamped: boolean;
  capped: PlanCap | null;
  /** Meta intermedia (−10%) cuando el plazo supera un año. */
  milestoneKg: number | null;
};

const LOSS_RATE: Record<Pace, number> = { gentle: 0.0025, recommended: 0.005, fast: 0.01 };
const GAIN_RATE: Record<Pace, number> = { gentle: 0.0025, recommended: 0.005, fast: 0.0075 };
const INTAKE_FLOOR: Record<Sex, number> = { female: 1200, male: 1500 };

type IntakeInput = { sex: Sex; years: number; cm: number; kg: number; activity: Activity; pace: Pace; lose: boolean };

/**
 * kcal/día (sin redondear) que corresponden a un peso dado: el gasto de mantenimiento menos/más el
 * ajuste del ritmo, con los topes de seguridad (déficit ≤ 25% del gasto, ingesta ≥ 1200/1500 y ≥ metabolismo
 * basal, superávit ≤ 500). El objetivo se recalcula con cada pesaje, así que este es el valor de "hoy".
 */
function intakeFor(i: IntakeInput): { intake: number; bmr: number; maintenance: number; capped: PlanCap | null; floor: number } {
  const bmr = mifflin(i.sex, i.kg, i.cm, i.years);
  const maintenance = tdee(bmr, i.activity);
  const floor = Math.max(INTAKE_FLOOR[i.sex], bmr);
  const weeklyKg = Math.min((i.lose ? LOSS_RATE : GAIN_RATE)[i.pace] * i.kg, i.lose ? 1 : 0.5);
  const delta = (weeklyKg * KCAL_PER_KG) / 7;
  let capped: PlanCap | null = null;

  if (!i.lose) {
    if (delta > 500) capped = "surplus500";
    return { intake: maintenance + Math.min(delta, 500), bmr, maintenance, capped, floor };
  }
  let deficit = delta;
  if (deficit > 0.25 * maintenance) {
    deficit = 0.25 * maintenance;
    capped = "deficit25";
  }
  let intake = maintenance - deficit;
  if (intake < floor) {
    intake = floor;
    capped = "floor";
  }
  return { intake, bmr, maintenance, capped, floor };
}

/**
 * Semanas para llegar a la meta siguiendo el plan tal como la app lo aplica: cada semana el objetivo se
 * recalcula con el peso nuevo (el gasto baja/sube con él) y el peso cambia con el balance energético.
 * `null` si tarda más de 3 años o el plan se estanca (por ejemplo, el piso de calorías no deja margen).
 */
export function weeksToGoal(p: {
  sex: Sex;
  years: number;
  cm: number;
  kg: number;
  goalKg: number;
  activity: Activity;
  pace: Pace;
}): number | null {
  const lose = p.goalKg < p.kg;
  let w = p.kg;
  for (let week = 0; week <= MAX_WEEKS; week++) {
    if (lose ? w <= p.goalKg + 0.25 : w >= p.goalKg - 0.25) return week;
    const { intake, maintenance } = intakeFor({ ...p, kg: w, lose });
    const delta = ((intake - maintenance) * 7) / KCAL_PER_KG;
    // Sin progreso apreciable: no se llegará.
    if (lose ? delta > -0.005 : delta < 0.005) return null;
    w += delta;
  }
  return null;
}

/** Calorías, ritmo efectivo y plazo de un adulto (≥ 18 años). */
export function planAdult(input: PlanInput): Plan {
  const bmr = mifflin(input.sex, input.kg, input.cm, input.years);
  const maintenance = tdee(bmr, input.activity);
  const base: Plan = {
    direction: "maintain",
    bmr: Math.round(bmr),
    tdee: Math.round(maintenance),
    kcal: round10(maintenance),
    weeklyKg: 0,
    weeks: 0,
    goalKg: null,
    goalClamped: false,
    capped: null,
    milestoneKg: null,
  };
  if (input.goalKg == null) return base;

  const { kg: goal, clamped } = clampGoal(input.goalKg, input);
  base.goalKg = goal;
  base.goalClamped = clamped;
  const diff = goal - input.kg;
  if (Math.abs(diff) < 0.25) return base;

  const lose = diff < 0;
  let pace = input.pace;
  let seniorCap = false;
  if (pace === "fast" && input.years >= 65) {
    pace = "recommended";
    seniorCap = true;
  }
  const today = intakeFor({ ...input, pace, lose });
  let kcal = round10(today.intake);
  if (lose) {
    // Se redondea hacia arriba en el piso para no quedar bajo él por el redondeo.
    kcal = Math.max(kcal, Math.ceil(Math.min(today.floor, today.maintenance) / 10) * 10);
    if (today.maintenance - kcal < 10) {
      // El piso deja sin margen para un déficit: el plan es mantener.
      return { ...base, goalKg: goal, goalClamped: clamped, capped: "floor" };
    }
  }

  const weeks = weeksToGoal({
    sex: input.sex, years: input.years, cm: input.cm, kg: input.kg, goalKg: goal, activity: input.activity, pace,
  });
  const milestone = half(input.kg * 0.9);
  return {
    direction: lose ? "lose" : "gain",
    bmr: Math.round(bmr),
    tdee: Math.round(maintenance),
    kcal,
    weeklyKg: round2((Math.abs(maintenance - kcal) * 7) / KCAL_PER_KG),
    weeks,
    goalKg: goal,
    goalClamped: clamped,
    capped: today.capped ?? (seniorCap ? "senior" : null),
    milestoneKg: lose && (weeks === null || weeks > 52) && goal < milestone ? milestone : null,
  };
}

// ─────────────────────────────────────────── Slider de meta ─────────────────────────────────────

export type SliderZone = { key: BmiClass; from: number; to: number };

export type SliderScale = {
  minKg: number;
  centerKg: number;
  maxKg: number;
  /** Rango en que se puede dejar la meta. */
  goalMinKg: number;
  goalMaxKg: number;
  /** Tramos coloreados, en posiciones 0–1. */
  zones: SliderZone[];
  /** Posición (0–1) de un peso. */
  toPos: (kg: number) => number;
  /** Peso (al 0.5 más cercano) de una posición 0–1. */
  toKg: (pos: number) => number;
};

/**
 * Escala por tramos: el peso recomendado queda siempre al centro (posición 0.5), a la izquierda
 * el bajo peso y a la derecha el sobrepeso (que se estira si el peso actual es alto).
 */
export function sliderScale(p: { cm: number; years: number; kg: number }): SliderScale {
  const b = bmiBands(p.years);
  const low = b.center - 7;
  const high = Math.max(b.center + 7, bmi(p.kg, p.cm) + 1.5);
  const toPosBmi = (v: number) =>
    clamp(v <= b.center ? (0.5 * (v - low)) / (b.center - low) : 0.5 + (0.5 * (v - b.center)) / (high - b.center), 0, 1);
  const toBmi = (pos: number) =>
    pos <= 0.5 ? low + (pos / 0.5) * (b.center - low) : b.center + ((pos - 0.5) / 0.5) * (high - b.center);

  const under = toPosBmi(b.underTo);
  const over = toPosBmi(b.overFrom);
  const zones: SliderZone[] = [
    { key: "under", from: 0, to: under },
    { key: "healthy", from: under, to: over },
  ];
  if (b.obeseFrom < high) {
    const obese = toPosBmi(b.obeseFrom);
    zones.push({ key: "over", from: over, to: obese }, { key: "obese", from: obese, to: 1 });
  } else {
    zones.push({ key: "over", from: over, to: 1 });
  }

  const range = goalRange(p.cm, p.years, p.kg);
  return {
    minKg: weightForBmi(low, p.cm),
    centerKg: weightForBmi(b.center, p.cm),
    maxKg: weightForBmi(high, p.cm),
    goalMinKg: range.min,
    goalMaxKg: range.max,
    zones,
    toPos: (kg) => toPosBmi(bmi(kg, p.cm)),
    toKg: (pos) => half(weightForBmi(toBmi(clamp(pos, 0, 1)), p.cm)),
  };
}

// ──────────────────────────────────────── Objetivo diario ───────────────────────────────────────

export type BodyData = {
  sex: Sex | null;
  birthDate: string | null;
  heightCm: number | null;
  activity: Activity;
  goalKg: number | null;
  pace: Pace;
};

export type LogPoint = { on: string; kg: number; cm?: number | null };

export type MissingField = "sex" | "birthDate" | "height" | "weight";

export type DailyTarget = {
  status: "ok" | "incomplete" | "infant";
  /** kcal/día; `null` si faltan datos o es lactante. */
  kcal: number | null;
  /** El último pesaje es demasiado viejo para fiarse. */
  stale: boolean;
  age: BodyAge | null;
  band: AgeBand | null;
  /** Peso usado en el cálculo (tendencia en adultos, último pesaje en menores). */
  weightKg: number | null;
  heightCm: number | null;
  plan: Plan | null;
  missing: MissingField[];
};

/** Días tras los cuales un pesaje se considera desactualizado. */
const STALE_DAYS: Record<AgeBand, number> = { infant: 30, toddler: 30, child: 90, teen: 90, adult: 180, senior: 180 };

/**
 * kcal diarias de una persona. Adultos: mantenimiento o plan hacia su meta. Menores: requerimiento
 * de crecimiento, nunca con déficit. Lactantes (< 12 meses): sin cálculo.
 */
export function dailyTarget(body: BodyData, logs: LogPoint[], today: string): DailyTarget {
  const age = ageOn(body.birthDate, today);
  const sorted = [...logs].sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
  const last = sorted.length ? sorted[sorted.length - 1] : null;
  const heightCm = [...sorted].reverse().find((l) => l.cm != null)?.cm ?? body.heightCm;
  const band = age ? ageBand(age) : null;
  const empty = { kcal: null, stale: false, age, band, weightKg: null, heightCm: heightCm ?? null, plan: null };

  if (age && band === "infant") return { ...empty, status: "infant", missing: [] };

  const missing: MissingField[] = [];
  if (!body.sex) missing.push("sex");
  if (!age) missing.push("birthDate");
  if (!heightCm) missing.push("height");
  if (!last) missing.push("weight");
  if (missing.length || !age || !band || !body.sex || !heightCm || !last) return { ...empty, status: "incomplete", missing };

  const stale = daysBetween(last.on, today) > STALE_DAYS[band];

  if (age.years < 18) {
    const eer = iomEer(body.sex, age.months, last.kg, heightCm, body.activity);
    if (eer == null) return { ...empty, status: "incomplete", missing: [] };
    return { status: "ok", kcal: round10(eer), stale, age, band, weightKg: last.kg, heightCm, plan: null, missing: [] };
  }

  const weightKg = round1(trendKg(sorted) ?? last.kg);
  const plan = planAdult({
    sex: body.sex, years: age.years, cm: heightCm, kg: weightKg, goalKg: body.goalKg, activity: body.activity, pace: body.pace,
  });
  return { status: "ok", kcal: plan.kcal, stale, age, band, weightKg, heightCm, plan, missing: [] };
}
