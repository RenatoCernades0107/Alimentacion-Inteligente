import { describe, expect, it } from "vitest";
import {
  ageBand,
  ageOn,
  bmi,
  bmiBands,
  classifyBmi,
  clampGoal,
  dailyTarget,
  healthyRangeKg,
  iomEer,
  MAX_WEEKS,
  mifflin,
  planAdult,
  plausibleBmi,
  sliderScale,
  tdee,
  trendKg,
  weeksToGoal,
  weightForBmi,
  type BodyData,
  type PlanInput,
} from "./body";

describe("edad", () => {
  it("cuenta años y meses cumplidos", () => {
    expect(ageOn("1990-06-15", "2026-06-14")).toEqual({ years: 35, months: 35 * 12 + 11 });
    expect(ageOn("1990-06-15", "2026-06-15")?.years).toBe(36);
    expect(ageOn("2026-01-31", "2026-03-01")?.months).toBe(1);
  });

  it("rechaza fechas inválidas, futuras o de más de 120 años", () => {
    expect(ageOn("2026-02-31", "2026-09-30")).toBeNull();
    expect(ageOn("2027-01-01", "2026-09-30")).toBeNull();
    expect(ageOn("1800-01-01", "2026-09-30")).toBeNull();
    expect(ageOn(null, "2026-09-30")).toBeNull();
    expect(ageOn("no-es-fecha", "2026-09-30")).toBeNull();
  });

  it("clasifica por franja", () => {
    const at = (years: number, extraMonths = 0) => ageBand({ years, months: years * 12 + extraMonths });
    expect(ageBand({ years: 0, months: 8 })).toBe("infant");
    expect(ageBand({ years: 1, months: 12 })).toBe("toddler");
    expect(ageBand({ years: 2, months: 35 })).toBe("toddler");
    expect(at(3)).toBe("child");
    expect(at(12)).toBe("child");
    expect(at(13)).toBe("teen");
    expect(at(17)).toBe("teen");
    expect(at(18)).toBe("adult");
    expect(at(59)).toBe("adult");
    expect(at(60)).toBe("senior");
  });
});

describe("IMC y peso recomendado", () => {
  it("calcula IMC y su inverso", () => {
    expect(bmi(70, 175)).toBeCloseTo(22.86, 2);
    expect(weightForBmi(22, 170)).toBeCloseTo(63.58, 2);
  });

  it("usa los cortes OMS a los 18–59 y la tabla INS desde los 60", () => {
    expect(classifyBmi(18.4, 30)).toBe("under");
    expect(classifyBmi(18.5, 30)).toBe("healthy");
    expect(classifyBmi(24.9, 30)).toBe("healthy");
    expect(classifyBmi(25, 30)).toBe("over");
    expect(classifyBmi(30, 30)).toBe("obese");
    expect(classifyBmi(23, 60)).toBe("under");
    expect(classifyBmi(23.1, 60)).toBe("healthy");
    expect(classifyBmi(27.9, 60)).toBe("healthy");
    expect(classifyBmi(28, 60)).toBe("over");
    expect(classifyBmi(32, 60)).toBe("obese");
    expect(bmiBands(45).center).toBe(22);
    expect(bmiBands(65).center).toBe(25.5);
  });

  it("da el rango saludable de una estatura", () => {
    expect(healthyRangeKg(170, 30)).toEqual({ minKg: 53.5, maxKg: 71.5, recommendedKg: 63.5 });
  });

  it("marca pares peso/estatura implausibles", () => {
    expect(plausibleBmi(70, 175)).toBe("ok");
    expect(plausibleBmi(20, 180)).toBe("low");
    expect(plausibleBmi(180, 160)).toBe("high");
  });
});

describe("gasto energético", () => {
  it("Mifflin–St Jeor", () => {
    expect(mifflin("male", 80, 180, 30)).toBe(1780);
    expect(mifflin("female", 60, 165, 30)).toBeCloseTo(1320.25, 2);
    expect(tdee(1780, "moderate")).toBeCloseTo(2759, 0);
  });

  it("IOM: niño de 10 años, niña de 8 y niño de 2", () => {
    expect(iomEer("male", 120, 30, 138, "light")).toBeCloseTo(1807.77, 1);
    expect(iomEer("female", 96, 26, 128, "active")).toBeCloseTo(1815.63, 1);
    expect(iomEer("male", 24, 12, 85, "light")).toBe(988);
  });

  it("IOM solo aplica entre 12 meses y 17 años", () => {
    expect(iomEer("male", 11, 9, 72, "light")).toBeNull();
    expect(iomEer("female", 18 * 12, 55, 165, "light")).toBeNull();
  });

  it("documenta el escalón al pasar de IOM (17) a Mifflin (18)", () => {
    const teen = iomEer("male", 17 * 12 + 11, 70, 178, "moderate")!;
    const adult = tdee(mifflin("male", 70, 178, 18), "moderate");
    expect(teen).toBeCloseTo(2932.7, 0);
    expect(adult).toBeCloseTo(2677.6, 0);
    expect(adult / teen).toBeGreaterThan(0.85);
    expect(adult / teen).toBeLessThan(0.95);
  });
});

describe("peso tendencia", () => {
  it("un solo pesaje es la tendencia", () => {
    expect(trendKg([{ on: "2026-09-01", kg: 80 }])).toBe(80);
    expect(trendKg([])).toBeNull();
  });

  it("suaviza con el tiempo real entre pesajes y no depende del orden", () => {
    const a = { on: "2026-09-01", kg: 80 };
    const b = { on: "2026-09-02", kg: 82 };
    expect(trendKg([a, b])).toBeCloseTo(80 + (1 - Math.exp(-1 / 7)) * 2, 6);
    expect(trendKg([b, a])).toBe(trendKg([a, b]));
  });

  it("tras una pausa larga casi coincide con el último pesaje", () => {
    const t = trendKg([
      { on: "2025-01-01", kg: 90 },
      { on: "2026-01-01", kg: 80 },
    ])!;
    expect(t).toBeCloseTo(80, 3);
  });
});

describe("meta de peso", () => {
  it("recorta la meta al rango permitido", () => {
    const base = { cm: 170, years: 30, kg: 65 };
    expect(clampGoal(50, base)).toEqual({ kg: 53.5, clamped: true });
    expect(clampGoal(63.5, base)).toEqual({ kg: 63.5, clamped: false });
    expect(clampGoal(80, base)).toEqual({ kg: 71.5, clamped: true });
    // Con sobrepeso, la meta no puede superar el peso actual.
    expect(clampGoal(95, { ...base, kg: 90 })).toEqual({ kg: 90, clamped: true });
    // Mayores de 60: el piso sube.
    expect(clampGoal(55, { ...base, years: 65 }).kg).toBe(healthyRangeKg(170, 65).minKg);
  });
});

const male: PlanInput = { sex: "male", years: 35, cm: 175, kg: 90, goalKg: 75, activity: "moderate", pace: "recommended" };

describe("plan del adulto", () => {
  it("sin meta mantiene", () => {
    const p = planAdult({ ...male, goalKg: null });
    expect(p.direction).toBe("maintain");
    expect(p.kcal).toBe(2830);
    expect(p.weeks).toBe(0);
  });

  it("baja al ritmo recomendado (0.5% por semana)", () => {
    const p = planAdult(male);
    expect(p.direction).toBe("lose");
    expect(p.kcal).toBe(2330);
    expect(p.weeklyKg).toBeCloseTo(0.45, 2);
    expect(p.capped).toBeNull();
    expect(p.weeks).not.toBeNull();
    expect(p.weeks!).toBeGreaterThan(30);
    expect(p.weeks!).toBeLessThan(50);
  });

  it("un ritmo más rápido acorta el plazo y aumenta el déficit", () => {
    const gentle = planAdult({ ...male, pace: "gentle" });
    const fast = planAdult({ ...male, pace: "fast" });
    expect(fast.kcal).toBeLessThan(gentle.kcal);
    expect(fast.weeks!).toBeLessThan(gentle.weeks!);
  });

  it("nunca baja del mínimo (1200 mujer / 1500 hombre / el metabolismo basal)", () => {
    const woman = planAdult({ sex: "female", years: 40, cm: 155, kg: 60, goalKg: 52, activity: "sedentary", pace: "fast" });
    expect(woman.direction).toBe("lose");
    expect(woman.capped).toBe("floor");
    expect(woman.kcal).toBeGreaterThanOrEqual(1210);
    expect(woman.kcal).toBeLessThan(woman.tdee);
  });

  it("si el piso deja sin margen, el plan es mantener", () => {
    const p = planAdult({ sex: "female", years: 45, cm: 145, kg: 47, goalKg: 45, activity: "sedentary", pace: "recommended" });
    expect(p.direction).toBe("maintain");
    expect(p.capped).toBe("floor");
    expect(p.kcal).toBeLessThanOrEqual(p.tdee + 5);
  });

  it("limita el déficit al 25% del gasto", () => {
    const p = planAdult({ sex: "male", years: 30, cm: 190, kg: 130, goalKg: 90, activity: "very_active", pace: "fast" });
    expect(p.direction).toBe("lose");
    expect(p.tdee - p.kcal).toBeLessThanOrEqual(0.25 * p.tdee + 10);
    expect(p.kcal).toBeGreaterThanOrEqual(1500);
  });

  it("subir de peso suma calorías con tope de +500", () => {
    const p = planAdult({ sex: "female", years: 25, cm: 165, kg: 45, goalKg: 55, activity: "moderate", pace: "recommended" });
    expect(p.direction).toBe("gain");
    expect(p.kcal).toBe(2100);
    const fast = planAdult({ sex: "male", years: 25, cm: 185, kg: 55, goalKg: 75, activity: "moderate", pace: "fast" });
    expect(fast.kcal - fast.tdee).toBeLessThanOrEqual(505);
  });

  it("no permite el ritmo rápido a partir de 65 años", () => {
    const p = planAdult({ sex: "male", years: 68, cm: 170, kg: 90, goalKg: 75, activity: "light", pace: "fast" });
    expect(p.capped).toBe("senior");
    expect(p.weeklyKg).toBeLessThanOrEqual(0.5);
  });

  it("corrige metas fuera del rango saludable", () => {
    const p = planAdult({ ...male, goalKg: 40 });
    expect(p.goalClamped).toBe(true);
    expect(p.goalKg).toBe(healthyRangeKg(175, 35).minKg);
  });

  it("sugiere una meta intermedia si el plazo supera un año", () => {
    const p = planAdult({ sex: "female", years: 40, cm: 160, kg: 120, goalKg: 60, activity: "sedentary", pace: "gentle" });
    expect(p.weeks === null || p.weeks > 52).toBe(true);
    expect(p.milestoneKg).toBe(108);
  });

  it("el plazo termina siempre y devuelve null si no se llega", () => {
    // El piso de calorías no deja margen para bajar: el plan se estanca.
    expect(weeksToGoal({ sex: "female", years: 45, cm: 145, kg: 47, goalKg: 45, activity: "sedentary", pace: "recommended" })).toBeNull();
    // Bajar la mitad de un peso muy alto con ritmo suave supera los 3 años.
    const long = weeksToGoal({ sex: "female", years: 40, cm: 160, kg: 120, goalKg: 60, activity: "sedentary", pace: "gentle" });
    expect(long === null || long <= MAX_WEEKS).toBe(true);
    // Ya está en la meta.
    expect(weeksToGoal({ sex: "male", years: 35, cm: 175, kg: 75.1, goalKg: 75, activity: "moderate", pace: "recommended" })).toBe(0);
  });

  it("el plazo sigue al plan: recalcula el objetivo con el peso nuevo", () => {
    // 90 → 75 kg al 0.5% semanal ≈ ln(90/75)/0.005 ≈ 36 semanas (sin topes).
    const weeks = weeksToGoal({ sex: "male", years: 35, cm: 175, kg: 90, goalKg: 75, activity: "moderate", pace: "recommended" })!;
    expect(weeks).toBeGreaterThan(33);
    expect(weeks).toBeLessThan(42);
  });
});

describe("slider de meta", () => {
  it("deja el recomendado al centro y es monótono", () => {
    for (const p of [
      { cm: 170, years: 30, kg: 65 },
      { cm: 160, years: 45, kg: 110 },
      { cm: 175, years: 70, kg: 72 },
    ]) {
      const s = sliderScale(p);
      expect(s.toPos(s.centerKg)).toBeCloseTo(0.5, 6);
      expect(s.toPos(s.minKg)).toBeCloseTo(0, 6);
      expect(s.toPos(s.maxKg)).toBeCloseTo(1, 6);
      let prev = -1;
      for (let kg = Math.ceil(s.minKg); kg <= s.maxKg; kg += 1) {
        const pos = s.toPos(kg);
        expect(pos).toBeGreaterThanOrEqual(prev);
        prev = pos;
      }
      expect(Math.abs(s.toKg(s.toPos(70)) - 70)).toBeLessThanOrEqual(0.5);
    }
  });

  it("las zonas son contiguas y cubren de 0 a 1", () => {
    const s = sliderScale({ cm: 160, years: 45, kg: 110 });
    expect(s.zones[0].from).toBe(0);
    expect(s.zones.at(-1)!.to).toBe(1);
    for (let i = 1; i < s.zones.length; i++) expect(s.zones[i].from).toBeCloseTo(s.zones[i - 1].to, 9);
    expect(s.zones.map((z) => z.key)).toEqual(["under", "healthy", "over", "obese"]);
    expect(sliderScale({ cm: 170, years: 30, kg: 65 }).zones.map((z) => z.key)).toEqual(["under", "healthy", "over"]);
  });

  it("el rango de la meta coincide con clampGoal", () => {
    const p = { cm: 170, years: 30, kg: 90 };
    const s = sliderScale(p);
    expect(s.goalMinKg).toBe(53.5);
    expect(s.goalMaxKg).toBe(90);
  });
});

describe("objetivo diario", () => {
  const adult: BodyData = { sex: "male", birthDate: "1990-05-10", heightCm: 175, activity: "moderate", goalKg: 75, pace: "recommended" };
  const today = "2026-09-30";

  it("pide los datos que faltan", () => {
    const t = dailyTarget({ ...adult, sex: null, heightCm: null }, [], today);
    expect(t.status).toBe("incomplete");
    expect(t.missing).toEqual(["sex", "height", "weight"]);
    expect(t.kcal).toBeNull();
    expect(dailyTarget({ ...adult, birthDate: null }, [{ on: today, kg: 90 }], today).missing).toEqual(["birthDate"]);
  });

  it("no calcula para lactantes", () => {
    const t = dailyTarget({ ...adult, birthDate: "2026-03-01", sex: null, heightCm: null }, [], today);
    expect(t.status).toBe("infant");
    expect(t.kcal).toBeNull();
    expect(t.band).toBe("infant");
  });

  it("adultos: usa la tendencia y el plan hacia la meta", () => {
    const t = dailyTarget(adult, [{ on: "2026-09-29", kg: 90 }], today);
    expect(t.status).toBe("ok");
    expect(t.plan?.direction).toBe("lose");
    expect(t.kcal).toBe(t.plan!.kcal);
    expect(t.weightKg).toBe(90);
    expect(t.stale).toBe(false);
  });

  it("menores: requerimiento de crecimiento, sin déficit ni meta", () => {
    const kid: BodyData = { sex: "male", birthDate: "2016-09-30", heightCm: 138, activity: "light", goalKg: 20, pace: "fast" };
    const t = dailyTarget(kid, [{ on: "2026-09-20", kg: 30 }], today);
    expect(t.status).toBe("ok");
    expect(t.plan).toBeNull();
    expect(t.kcal).toBe(1810);
  });

  it("marca datos viejos y toma la estatura del último pesaje", () => {
    const t = dailyTarget(adult, [{ on: "2026-01-01", kg: 90, cm: 176 }], today);
    expect(t.stale).toBe(true);
    expect(t.heightCm).toBe(176);
    const toddler: BodyData = { sex: "female", birthDate: "2024-06-01", heightCm: 88, activity: "light", goalKg: null, pace: "recommended" };
    expect(dailyTarget(toddler, [{ on: "2026-07-01", kg: 12.5 }], today).stale).toBe(true);
    expect(dailyTarget(toddler, [{ on: "2026-09-10", kg: 12.5 }], today).stale).toBe(false);
  });
});
