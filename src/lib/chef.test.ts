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
  copyDay,
  pasteClip,
  planToText,
  rebaseDraft,
  migrateDraft,
  type CustomDish,
  type DishCard,
  type DraftData,
  type Plan,
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

describe("fuentes de la búsqueda web", () => {
  const ctx = { cards: byId, slots, dates: new Set(["2026-10-12"]), busy: new Set<string>() };
  const searched = [
    { title: "OMS", url: "https://www.who.int/a" },
    { title: "NIH", url: "https://ods.od.nih.gov/b" },
  ];
  it("solo acepta URLs que devolvió la búsqueda", () => {
    const r = sanitizeReply({ message: "x", sources: ["https://www.who.int/a", "https://inventada.com"] }, ctx, searched);
    expect(r.sources).toEqual([searched[0]]);
  });
  it("si no citó ninguna, muestra lo encontrado; sin búsqueda, nada", () => {
    expect(sanitizeReply({ message: "x" }, ctx, searched).sources).toEqual(searched);
    expect(sanitizeReply({ message: "x", sources: ["https://www.who.int/a"] }, ctx).sources).toEqual([]);
  });
});

describe("copiar y pegar comidas", () => {
  const plan: Plan = {
    [slotKey("2026-10-12", "breakfast")]: { recipeId: "avena" },
    [slotKey("2026-10-12", "lunch")]: { recipeId: "pollo", reason: "proteína" },
  };
  const opts = { slots, busy: new Set([slotKey("2026-10-14", "lunch")]), known: (id: string) => byId.has(id) };

  it("copia un día (null si está vacío)", () => {
    expect(copyDay(plan, "2026-10-12", slots)).toEqual({ kind: "day", meals: { breakfast: "avena", lunch: "pollo" } });
    expect(copyDay(plan, "2026-10-13", slots)).toBeNull();
  });

  it("pega un plato en franjas, sin tocar las ocupadas ni recetas desconocidas", () => {
    const r = pasteClip(plan, { kind: "meal", recipeId: "ceviche" }, [slotKey("2026-10-12", "dinner"), slotKey("2026-10-14", "lunch")], opts);
    expect(r.changed).toEqual([slotKey("2026-10-12", "dinner")]);
    expect(r.plan[slotKey("2026-10-12", "dinner")]).toEqual({ recipeId: "ceviche" });
    expect(plan[slotKey("2026-10-12", "dinner")]).toBeUndefined();
    expect(pasteClip(plan, { kind: "meal", recipeId: "no-existe" }, [slotKey("2026-10-12", "dinner")], opts).changed).toEqual([]);
  });

  it("pega un día en varios días y salta las franjas ocupadas", () => {
    const clip = copyDay(plan, "2026-10-12", slots)!;
    const r = pasteClip(plan, clip, ["2026-10-13", "2026-10-14"], opts);
    expect(r.changed).toEqual([
      slotKey("2026-10-13", "breakfast"),
      slotKey("2026-10-13", "lunch"),
      slotKey("2026-10-14", "breakfast"),
    ]);
    // Pegar sobre sí mismo no cambia nada.
    expect(pasteClip(plan, clip, ["2026-10-12"], opts).changed).toEqual([]);
  });

  it("arma el plan como texto", () => {
    const text = planToText(plan, ["2026-10-12", "2026-10-13"], slots, { day: (d) => d, slot: (s) => s, dish: (id) => id });
    expect(text).toBe("2026-10-12\n• breakfast: avena\n• lunch: pollo");
  });
});

describe("borradores", () => {
  const draft: DraftData = {
    v: 3,
    prefs: { goal: "healthy", scope: "week", prefs: [], start: "2026-10-10" },
    liked: [],
    disliked: [],
    plan: { [slotKey("2026-10-10", "lunch")]: { recipeId: "pollo" }, [slotKey("2026-10-12", "dinner")]: { recipeId: "lomo" } },
    messages: [],
    quickReplies: [],
    custom: {},
  };
  it("un borrador de días pasados se mueve para empezar hoy", () => {
    const { data, shifted } = rebaseDraft(draft, "2026-10-13");
    expect(shifted).toBe(3);
    expect(data.prefs.start).toBe("2026-10-13");
    expect(Object.keys(data.plan)).toEqual([slotKey("2026-10-13", "lunch"), slotKey("2026-10-15", "dinner")]);
  });
  it("uno vigente queda igual", () => {
    expect(rebaseDraft(draft, "2026-10-10").data).toBe(draft);
  });
});

describe("respuestas de la IA con errores de forma", () => {
  const ctx = { cards: byId, slots, dates: new Set(["2026-10-12"]), busy: new Set<string>() };
  it("acepta slugs con mayúsculas o el nombre del plato, y franjas en español", () => {
    const r = sanitizeReply(
      {
        message: "",
        plan: [
          { date: "2026-10-12", slot: "Almuerzo", slug: " Pollo " },
          { date: "2026-10-12T00:00:00", slot: "desayuno", slug: "AVENA" },
        ],
      },
      ctx,
    );
    expect(r.changes.map((c) => [c.key, c.recipeId])).toEqual([
      [slotKey("2026-10-12", "lunch"), "pollo"],
      [slotKey("2026-10-12", "breakfast"), "avena"],
    ]);
  });
});

describe("recetas nuevas en la respuesta", () => {
  const dish: CustomDish = {
    card: card("11111111-1111-4111-8111-111111111111", { slug: "nueva-11111111", name_es: "Bowl de quinua", name_en: "Quinoa bowl", custom: true }),
    recipe: {
      name_es: "Bowl de quinua", name_en: "Quinoa bowl", description: "", emoji: "🥗", meal_types: ["lunch"], servings: 2, time_minutes: 20,
      country: "PE", ingredients: [], steps: ["Mezclar"],
    },
  };
  const ctx = { cards: byId, slots, dates: new Set(["2026-10-12"]), busy: new Set<string>(), newDishes: [{ ref: "bowl-quinua", dish }] };

  it("acepta el ref de una receta nueva y la devuelve si quedó en el plan", () => {
    const r = sanitizeReply({ message: "ok", plan: [{ date: "2026-10-12", slot: "lunch", slug: "bowl-quinua" }] }, ctx);
    expect(r.changes).toEqual([{ key: slotKey("2026-10-12", "lunch"), recipeId: dish.card.id, reason: undefined }]);
    expect(r.custom).toEqual([dish]);
  });
  it("también por su nombre", () => {
    const r = sanitizeReply({ message: "ok", plan: [{ date: "2026-10-12", slot: "dinner", slug: "Quinoa Bowl" }] }, ctx);
    expect(r.changes[0].recipeId).toBe(dish.card.id);
  });
  it("una receta nueva que no se usa no se devuelve", () => {
    const r = sanitizeReply({ message: "ok", plan: [{ date: "2026-10-12", slot: "lunch", slug: "pollo" }] }, ctx);
    expect(r.custom).toEqual([]);
  });
  it("las alternativas pueden incluir recetas nuevas", () => {
    const r = sanitizeReply({ message: "ok", alternatives: { date: "2026-10-12", slot: "lunch", options: [{ slug: "bowl-quinua" }, { slug: "pollo" }] } }, ctx);
    expect(r.alternatives?.options.map((o) => o.recipeId)).toEqual([dish.card.id, "pollo"]);
    expect(r.custom).toEqual([dish]);
  });
});

describe("migración de borradores", () => {
  it("un borrador v2 se lee como v3 sin recetas nuevas", () => {
    expect(migrateDraft({ v: 2, plan: {} })).toEqual({ v: 3, plan: {}, custom: {} });
  });
  it("los demás quedan igual", () => {
    const d = { v: 3, custom: {} };
    expect(migrateDraft(d)).toBe(d);
    expect(migrateDraft(null)).toBe(null);
  });
});
