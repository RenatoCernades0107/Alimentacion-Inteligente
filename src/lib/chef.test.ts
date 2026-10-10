import { describe, expect, it } from "vitest";
import {
  dayTargets,
  dayTotals,
  defaultGoal,
  fallbackAlternatives,
  fallbackPlan,
  goalsFor,
  sanitizeReply,
  scopeDates,
  scoreCard,
  slotKey,
  tasteDeck,
  type DishCard,
} from "./chef";
import type { MealSlot } from "./types";

const card = (id: string, over: Partial<DishCard> = {}): DishCard => ({
  id, slug: id, name_es: id, name_en: id, emoji: null, image_url: null, country: "PE", meal_types: ["lunch", "dinner"],
  time: 30, kcal: 600, protein: 30, carbs: 70, fat: 20, have: 2, total: 4, expiring: false, meat: true, ...over,
});

const slots: MealSlot[] = ["breakfast", "lunch", "dinner"];
const cards = [
  card("avena", { meal_types: ["breakfast"], kcal: 350, protein: 12, carbs: 55, fat: 9, meat: false }),
  card("pan-huevo", { meal_types: ["breakfast"], kcal: 400, protein: 20, carbs: 40, fat: 18, meat: false }),
  card("pollo", { kcal: 550, protein: 50, carbs: 40, fat: 15 }),
  card("lomo", { kcal: 900, protein: 40, carbs: 90, fat: 40 }),
  card("menestron", { kcal: 450, protein: 18, carbs: 70, fat: 8, meat: false, time: 90 }),
  card("ceviche", { kcal: 300, protein: 35, carbs: 25, fat: 5, country: "PE" }),
  card("burger", { kcal: 850, protein: 35, carbs: 60, fat: 50, country: "US" }),
];
const byId = new Map(cards.map((c) => [c.id, c]));

describe("metas del día", () => {
  it("reparte las kcal según el objetivo", () => {
    expect(dayTargets(2000, "muscle")).toEqual({ kcal: 2000, protein: 150, carbs: 225, fat: 56, estimated: false });
    expect(dayTargets(null, "maintain").estimated).toBe(true);
  });

  it("sugiere el objetivo desde la meta de peso y nunca 'bajar' a un menor", () => {
    expect(defaultGoal("lose", false)).toBe("lose");
    expect(defaultGoal("gain", false)).toBe("muscle");
    expect(defaultGoal("lose", true)).toBe("healthy");
    expect(goalsFor(true)).not.toContain("lose");
  });

  it("cubre un día o la semana", () => {
    expect(scopeDates("today", "2026-10-10")).toEqual(["2026-10-10"]);
    expect(scopeDates("tomorrow", "2026-10-10")).toEqual(["2026-10-11"]);
    expect(scopeDates("week", "2026-10-10", "2026-10-12")).toHaveLength(7);
    expect(scopeDates("week", "2026-10-10", "2026-10-12")[0]).toBe("2026-10-12");
    // Una fecha pasada no se planifica.
    expect(scopeDates("today", "2026-10-10", "2026-10-01")).toEqual(["2026-10-10"]);
  });
});

describe("puntaje y mazo de gustos", () => {
  it("para ganar músculo prefiere lo alto en proteína", () => {
    expect(scoreCard(byId.get("pollo")!, "muscle", [])).toBeGreaterThan(scoreCard(byId.get("burger")!, "muscle", []));
  });

  it("para bajar prefiere lo liviano", () => {
    expect(scoreCard(byId.get("ceviche")!, "lose", [])).toBeGreaterThan(scoreCard(byId.get("lomo")!, "lose", []));
  });

  it("respeta sin carne y país, y no repite platos", () => {
    const deck = tasteDeck(cards, "healthy", ["veggie"], slots, 3);
    expect(deck.every((c) => !c.meat)).toBe(true);
    expect(new Set(deck.map((c) => c.id)).size).toBe(deck.length);
    expect(tasteDeck(cards, "healthy", ["american"], slots, 20).some((c) => c.country === "US")).toBe(true);
  });
});

describe("plan de respaldo", () => {
  const dates = ["2026-10-12", "2026-10-13"];

  it("llena las franjas libres sin tocar las ocupadas ni usar lo descartado", () => {
    const busy = [slotKey("2026-10-12", "lunch")];
    const plan = fallbackPlan({ cards, dates, slots, goal: "muscle", prefs: [], liked: [], disliked: ["pollo"], busy });
    expect(plan[slotKey("2026-10-12", "lunch")]).toBeUndefined();
    expect(plan[slotKey("2026-10-12", "breakfast")]).toBeDefined();
    expect(plan[slotKey("2026-10-13", "dinner")]).toBeDefined();
    expect(Object.values(plan).some((e) => e?.recipeId === "pollo")).toBe(false);
  });

  it("no repite el mismo plato en un día", () => {
    const plan = fallbackPlan({ cards, dates, slots, goal: "muscle", prefs: [], liked: ["ceviche"], disliked: [], busy: [] });
    const day = [plan[slotKey(dates[0], "lunch")]?.recipeId, plan[slotKey(dates[0], "dinner")]?.recipeId];
    expect(day[0]).not.toBe(day[1]);
  });

  it("da alternativas que no estén ya en ese día", () => {
    const plan = { [slotKey(dates[0], "lunch")]: { recipeId: "pollo" } };
    const alts = fallbackAlternatives(cards, plan, slotKey(dates[0], "dinner"), "muscle", [], ["lomo"]);
    expect(alts.map((a) => a.recipeId)).not.toContain("pollo");
    expect(alts.map((a) => a.recipeId)).not.toContain("lomo");
    expect(alts.length).toBeGreaterThan(0);
  });

  it("suma lo que aporta el día a quien mira", () => {
    const plan = { [slotKey(dates[0], "lunch")]: { recipeId: "pollo" }, [slotKey(dates[0], "dinner")]: { recipeId: "ceviche" } };
    const t = dayTotals(plan, dates[0], slots, byId, 2000, 3);
    expect(t.filled).toBe(2);
    // Almuerzo 40 % de 2000 = 800 kcal → 1½ porciones de 550; cena 35 % = 700 → 2 de 300 (tope).
    expect(t.kcal).toBe(825 + 600);
  });
});

describe("validación de la respuesta de la IA", () => {
  const ctx = { cards: byId, slots, dates: new Set(["2026-10-12"]), busy: new Set<string>([slotKey("2026-10-12", "breakfast")]) };

  it("descarta recetas, fechas y franjas inválidas u ocupadas", () => {
    const r = sanitizeReply(
      {
        message: "Listo",
        quick_replies: ["Más proteína", "", "a", "b", "c"],
        plan: [
          { date: "2026-10-12", slot: "lunch", slug: "pollo", reason: "Mucha proteína" },
          { date: "2026-10-12", slot: "lunch", slug: "lomo" },
          { date: "2026-10-12", slot: "breakfast", slug: "avena" },
          { date: "2026-10-30", slot: "dinner", slug: "pollo" },
          { date: "2026-10-12", slot: "dinner", slug: "no-existe" },
          { date: "2026-10-12", slot: "brunch", slug: "pollo" },
        ],
        remove: [{ date: "2026-10-12", slot: "dinner" }],
      },
      ctx,
    );
    expect(r.changes).toEqual([
      { key: "2026-10-12|lunch", recipeId: "pollo", reason: "Mucha proteína" },
      { key: "2026-10-12|dinner", recipeId: null },
    ]);
    expect(r.quickReplies).toEqual(["Más proteína", "a", "b", "c"]);
  });

  it("filtra las alternativas", () => {
    const r = sanitizeReply(
      { alternatives: { date: "2026-10-12", slot: "dinner", options: [{ slug: "ceviche" }, { slug: "ceviche" }, { slug: "x" }, { slug: "lomo", reason: "Rico" }] } },
      ctx,
    );
    expect(r.alternatives).toEqual({ key: "2026-10-12|dinner", options: [{ recipeId: "ceviche", reason: undefined }, { recipeId: "lomo", reason: "Rico" }] });
    expect(sanitizeReply({ alternatives: { date: "2026-10-12", slot: "breakfast", options: [{ slug: "avena" }] } }, ctx).alternatives).toBeNull();
  });
});
