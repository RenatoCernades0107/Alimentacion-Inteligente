import { describe, expect, it } from "vitest";
import { dailyTarget, type BodyData } from "./body";
import { chefProfile, profileLines } from "./chef-profile";

const body: BodyData = { sex: "male", birthDate: "1996-05-10", heightCm: 175, activity: "moderate", goalKg: 72, pace: "recommended" };
const logs = [
  { on: "2026-10-01", kg: 80 },
  { on: "2026-10-15", kg: 79 },
  { on: "2026-10-29", kg: 78 },
];

describe("perfil para el Chef", () => {
  const target = dailyTarget(body, logs, "2026-11-04");
  const p = chefProfile(body, logs, target)!;

  it("junta los datos del cuerpo, la meta y la tendencia", () => {
    expect(p).toMatchObject({ sex: "male", age: 30, heightCm: 175, activity: "moderate", goalKg: 72, direction: "lose", bmiClass: "over" });
    expect(p.trendPerWeek).toBe(-0.5);
    expect(p.bmr).toBeGreaterThan(1500);
    expect(p.tdee).toBeGreaterThan(p.bmr!);
    expect(p.healthyKg!.min).toBeLessThan(p.healthyKg!.max);
  });

  it("lo describe en líneas para el prompt", () => {
    const text = profileLines(p).join("\n");
    expect(text).toContain("hombre, 30 años, 175 cm");
    expect(text).toContain("IMC");
    expect(text).toContain("-0.5 kg/semana");
    expect(text).toContain("Meta de peso: 72 kg (bajar)");
    expect(text).toContain("Metabolismo basal");
  });

  it("sin ficha avisa que faltan datos", () => {
    expect(chefProfile(null, [], null)).toBeNull();
    expect(profileLines(null)[0]).toContain("Aún no completó");
  });
});
