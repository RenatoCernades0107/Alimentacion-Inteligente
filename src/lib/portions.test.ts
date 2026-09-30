import { describe, expect, it } from "vitest";
import { buildPortions, dayProgress, isCounted, mealPortion, type MemberTarget } from "./portions";
import type { MealSlot } from "./types";

const person = (id: string, kcal: number | null, state: MemberTarget["state"] = "ok"): MemberTarget => ({
  key: `p:${id}`, kind: "profile", id, name: id, avatarSrc: null, kcal, state, stale: false, href: null,
});

const base = { complete: true, optionalKcal: 0, slot: "lunch" as const, mealsPerDay: 3, recipeServings: 4, scale: 1 };

describe("tabla de porciones", () => {
  const targets = [person("papa", 2400), person("nino", 1500), person("mama-sin-datos", null, "incomplete"), person("bebe", null, "infant")];

  it("reparte según la meta diaria y la franja (almuerzo = 40%)", () => {
    const r = buildPortions({ ...base, targets, kcalPerServing: 600 });
    expect(r.share).toBe(0.4);
    const byId = Object.fromEntries(r.rows.map((x) => [x.id, x]));
    expect(byId.papa).toMatchObject({ portion: 1.5, kcal: 900, shortBy: 0 });
    expect(byId.nino).toMatchObject({ portion: 1, kcal: 600 });
    expect(byId["mama-sin-datos"]).toMatchObject({ portion: null, kcal: null, state: "incomplete" });
    expect(byId.bebe).toMatchObject({ portion: null, kcal: null, state: "infant" });
    expect(r.totalPortions).toBe(2.5);
  });

  it("sugiere el multiplicador cuando la receta rinde otra cantidad", () => {
    const r = buildPortions({ ...base, targets, kcalPerServing: 600 });
    // 2.5 porciones de las 4 que rinde la receta → ×0.75.
    expect(r.suggestedScale).toBe(0.75);
    // Si ya está en esa escala, no hay nada que sugerir.
    expect(buildPortions({ ...base, targets, kcalPerServing: 600, scale: 0.75 }).suggestedScale).toBeNull();
  });

  it("sin receta no hay escala sugerida", () => {
    const r = buildPortions({ ...base, targets, kcalPerServing: 600, recipeServings: null });
    expect(r.suggestedScale).toBeNull();
    expect(r.rows.find((x) => x.id === "papa")?.portion).toBe(1.5);
  });

  it("sin kcal de la comida nadie recibe porción", () => {
    for (const perServing of [null, 0]) {
      const r = buildPortions({ ...base, targets, kcalPerServing: perServing });
      expect(r.kcalPerServing).toBeNull();
      expect(r.rows.every((x) => x.portion === null)).toBe(true);
      expect(r.suggestedScale).toBeNull();
    }
  });

  it("informa lo que no alcanza a cubrirse con una comida liviana", () => {
    const r = buildPortions({ ...base, targets: [person("atleta", 3500)], kcalPerServing: 300 });
    expect(r.rows[0]).toMatchObject({ portion: 2, shortBy: 800 });
  });

  it("usa el reparto de la familia (con 5 comidas el almuerzo pesa 30%)", () => {
    const r = buildPortions({ ...base, targets: [person("papa", 2400)], kcalPerServing: 600, mealsPerDay: 5 });
    expect(r.share).toBe(0.3);
    expect(r.rows[0].portion).toBe(1.25);
  });

  it("no incluye datos corporales: solo lo derivado", () => {
    const r = buildPortions({ ...base, targets, kcalPerServing: 600 });
    for (const row of r.rows) expect(Object.keys(row).sort()).toEqual(
      ["avatarSrc", "href", "id", "key", "kcal", "kind", "name", "portion", "shortBy", "stale", "state"].sort(),
    );
  });
});

describe("franja compartida", () => {
  const targets = [person("papa", 2400)];

  it("la porción se calcula con la parte de la franja que le toca a cada comida", () => {
    // Almuerzo 40 % de 2400 = 960 kcal; con una segunda comida en la franja, 480 kcal cada una.
    const solo = buildPortions({ ...base, targets, kcalPerServing: 480 });
    const compartida = buildPortions({ ...base, targets, kcalPerServing: 480, siblings: 2 });
    expect(solo.rows[0].portion).toBe(2);
    expect(solo.siblings).toBe(1);
    expect(compartida.share).toBeCloseTo(0.2, 9);
    expect(compartida.siblings).toBe(2);
    expect(compartida.rows[0]).toMatchObject({ portion: 1, kcal: 480 });
  });

  it("mealPortion usa la misma cuenta que la tabla", () => {
    const table = buildPortions({ ...base, targets, kcalPerServing: 600, siblings: 2 }).rows[0];
    const mine = mealPortion({ targetKcal: 2400, mealsPerDay: 3, slot: "lunch", siblings: 2, kcalPerServing: 600 });
    expect(mine.portion).toBe(table.portion);
    expect(mine.kcal).toBe(table.kcal);
  });
});

describe("meta del día", () => {
  const meal = (slot: MealSlot, status: string, kcalPerServing: number | null) => ({ slot, status, kcalPerServing });
  const target = 2400; // 3 comidas: 600 / 960 / 840 kcal

  it("un día completo y equilibrado cubre la meta", () => {
    const p = dayProgress({ targetKcal: target, mealsPerDay: 3, meals: [meal("breakfast", "planned", 300), meal("lunch", "planned", 480), meal("dinner", "planned", 420)] });
    expect(p.completed).toBe(0);
    expect(p.planned).toBe(2400);
    expect(p.ratio).toBeCloseTo(1, 6);
    expect(p.status).toBe("ok");
    expect(p.gap).toBe(0);
  });

  it("separa lo completado de lo que falta por comer", () => {
    const p = dayProgress({ targetKcal: target, mealsPerDay: 3, meals: [meal("breakfast", "completed", 300), meal("lunch", "planned", 480), meal("dinner", "planned", 420)] });
    expect(p.completed).toBe(600);
    expect(p.planned).toBe(1800);
    expect(p.total).toBe(2400);
  });

  it("si faltan franjas, avisa cuánto falta", () => {
    const p = dayProgress({ targetKcal: target, mealsPerDay: 3, meals: [meal("breakfast", "planned", 300)] });
    expect(p.status).toBe("low");
    expect(p.total).toBe(600);
    expect(p.gap).toBe(1800);
  });

  it("dos comidas en la misma franja se la reparten en vez de duplicarla", () => {
    const juntas = dayProgress({ targetKcal: target, mealsPerDay: 3, meals: [meal("lunch", "planned", 480), meal("lunch", "planned", 480)] });
    expect(juntas.total).toBe(960);
    const sola = dayProgress({ targetKcal: target, mealsPerDay: 3, meals: [meal("lunch", "planned", 480)] });
    expect(sola.total).toBe(960);
  });

  it("las meriendas que se suman a un día de 3 comidas aportan su 10 % cada una y pueden pasar la meta", () => {
    const dia = [meal("breakfast", "planned", 300), meal("lunch", "planned", 480), meal("dinner", "planned", 420)];
    const conUna = dayProgress({ targetKcal: target, mealsPerDay: 3, meals: [...dia, meal("morning_snack", "planned", 240)] });
    expect(conUna.total).toBe(2640);
    expect(conUna.status).toBe("ok"); // 110 %: justo en el límite
    const conDos = dayProgress({ targetKcal: target, mealsPerDay: 3, meals: [...dia, meal("morning_snack", "planned", 240), meal("afternoon_snack", "planned", 240)] });
    expect(conDos.total).toBe(2880);
    expect(conDos.status).toBe("over");
    expect(conDos.gap).toBe(480);
  });

  it("no cuenta propuestas ni comidas sin kcal (las avisa)", () => {
    const p = dayProgress({ targetKcal: target, mealsPerDay: 3, meals: [meal("breakfast", "proposed", 300), meal("lunch", "planned", null), meal("dinner", "planned", 420)] });
    expect(p.unknown).toBe(1);
    expect(p.total).toBe(840);
    expect(isCounted("proposed")).toBe(false);
    expect(isCounted("cancelled")).toBe(false);
    expect(isCounted("planned")).toBe(true);
    expect(isCounted("completed")).toBe(true);
  });

  it("sin comidas con kcal el estado es vacío", () => {
    expect(dayProgress({ targetKcal: target, mealsPerDay: 3, meals: [] }).status).toBe("empty");
    expect(dayProgress({ targetKcal: target, mealsPerDay: 3, meals: [meal("lunch", "planned", null)] }).status).toBe("empty");
  });

  it("porciones grandes para una meta chica: el redondeo a ¼ de porción hace pasar la meta", () => {
    // Meta 1000 kcal, platos de 900 kcal por porción: ¼ (225) + ½ (450) + ½ (450) = 1125 kcal.
    const p = dayProgress({ targetKcal: 1000, mealsPerDay: 3, meals: [meal("breakfast", "planned", 900), meal("lunch", "planned", 900), meal("dinner", "planned", 900)] });
    expect(p.total).toBe(1125);
    expect(p.status).toBe("over");
    expect(p.gap).toBe(130);
  });
});
