import { describe, expect, it } from "vitest";
import { buildPortions, type MemberTarget } from "./portions";

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
