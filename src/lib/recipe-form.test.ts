import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CUSTOM_SLUG,
  computeRecipeKcal,
  isEmoji,
  isHttpUrl,
  localizeTexts,
  newRecipeSlug,
  parseRecipeInput,
  recipeSlug,
  resolveEditTarget,
  textsInLocale,
  type RecipeInput,
  type RecipeTexts,
} from "./recipe-form";
import { kcalPerServing, type FoodNutrition } from "./nutrition";

const RICE = "11111111-1111-4111-8111-111111111111";
const EGG = "22222222-2222-4222-8222-222222222222";
const OIL = "33333333-3333-4333-8333-333333333333";

const valid = (patch: Partial<RecipeInput> = {}): RecipeInput => ({
  sourceId: null,
  name: "  Arroz con huevo  ",
  description: "",
  emoji: "🍚",
  mealTypes: ["lunch"],
  servings: 2,
  timeMinutes: 20,
  country: "PE",
  sourceUrl: "",
  ingredients: [{ foodId: RICE, quantity: 200, unit: "g", optional: false }],
  steps: ["Hierve el arroz."],
  ...patch,
});

describe("slug de recetas propias", () => {
  it("quita tildes y símbolos y agrega el sufijo", () => {
    expect(recipeSlug("Ají de gallina", "a1b2c3d4")).toBe("aji-de-gallina_a1b2c3d4");
    expect(recipeSlug("  ¡Pollo & papas (al horno)!  ", "00ff00ff")).toBe("pollo-papas-al-horno_00ff00ff");
    expect(recipeSlug("Ñoquis de Camote", "12345678")).toBe("noquis-de-camote_12345678");
  });

  it("sin letras ni números usa 'receta'", () => {
    expect(recipeSlug("🍕🍕", "12345678")).toBe("receta_12345678");
    expect(recipeSlug("   ", "12345678")).toBe("receta_12345678");
  });

  it("recorta nombres largos sin dejar un guion al final", () => {
    const slug = recipeSlug("a".repeat(39) + " bbbbbbbbbb", "12345678");
    expect(slug).toBe("a".repeat(39) + "_12345678");
    expect(recipeSlug("x".repeat(100), "12345678").length).toBe(40 + 1 + 8);
  });

  it("siempre cumple el formato que exige la base de datos", () => {
    for (const name of ["Ceviche", "Ají de gallina", "🍕", "a", "Mamá's ñandú — 100%", "x".repeat(200)]) {
      expect(recipeSlug(name, "0123abcd")).toMatch(CUSTOM_SLUG);
    }
  });

  it("el sufijo aleatorio cambia en cada llamada", () => {
    const a = newRecipeSlug("Tortilla");
    const b = newRecipeSlug("Tortilla");
    expect(a).toMatch(CUSTOM_SLUG);
    expect(b).toMatch(CUSTOM_SLUG);
    expect(a).not.toBe(b);
  });

  it("los slugs del catálogo no pueden chocar con los propios (nunca llevan guion bajo)", () => {
    // Mismo invariante que apoya la migración: el seed hace upsert por slug y los propios llevan "_".
    const source = readFileSync(fileURLToPath(new URL("../../supabase/data/recipes.mjs", import.meta.url)), "utf8");
    const slugs = [...source.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(slugs.length).toBeGreaterThan(50);
    for (const slug of slugs) {
      expect(slug, slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(slug).not.toMatch(CUSTOM_SLUG);
    }
  });
});

describe("emoji y links", () => {
  it("acepta un solo emoji", () => {
    for (const e of ["🍚", "🌶️", "👩‍🍳", "🍽️", "🇵🇪"]) expect(isEmoji(e), e).toBe(true);
    for (const e of ["", "A", "1", "🍚🍚", "hola", "🍚 "]) expect(isEmoji(e), e).toBe(false);
  });

  it("solo acepta links http(s)", () => {
    expect(isHttpUrl("https://www.bbcgoodfood.com/recipes/x")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    for (const u of ["javascript:alert(1)", "data:text/html,hola", "ftp://example.com", "example.com", "https://a b.com", ""]) {
      expect(isHttpUrl(u), u).toBe(false);
    }
  });
});

describe("validación del formulario", () => {
  it("acepta una receta válida y limpia los textos", () => {
    const r = parseRecipeInput(valid({ steps: ["  Hierve el arroz.  ", "", "   ", "Sirve."] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.name).toBe("Arroz con huevo");
    expect(r.data.steps).toEqual(["Hierve el arroz.", "Sirve."]);
  });

  it("deja los tipos de comida sin repetir y en el orden del día", () => {
    const r = parseRecipeInput(valid({ mealTypes: ["dinner", "breakfast", "dinner"] }));
    expect(r.ok && r.data.mealTypes).toEqual(["breakfast", "dinner"]);
  });

  it("rechaza datos inválidos", () => {
    const bad: Partial<RecipeInput>[] = [
      { name: "   " },
      { name: "x".repeat(81) },
      { description: "x".repeat(401) },
      { emoji: "A" },
      { mealTypes: [] },
      { mealTypes: ["brunch" as never] },
      { servings: 0 },
      { servings: 1.5 },
      { servings: 101 },
      { timeMinutes: 0 },
      { timeMinutes: 2000 },
      { country: "ES" as never },
      { sourceUrl: "javascript:alert(1)" },
      { sourceUrl: "no es un link" },
      { sourceId: "no-es-uuid" },
      { ingredients: [] },
      { ingredients: [{ foodId: "x", quantity: 1, unit: "g", optional: false }] },
      { ingredients: [{ foodId: RICE, quantity: 0, unit: "g", optional: false }] },
      { ingredients: [{ foodId: RICE, quantity: -3, unit: "g", optional: false }] },
      { ingredients: [{ foodId: RICE, quantity: 1, unit: "cup" as never, optional: false }] },
      // Cantidad y unidad van juntas.
      { ingredients: [{ foodId: RICE, quantity: 1, unit: null, optional: false }] },
      { ingredients: [{ foodId: RICE, quantity: null, unit: "g", optional: false }] },
      // Un alimento no se repite en la receta.
      { ingredients: [{ foodId: RICE, quantity: 1, unit: "g", optional: false }, { foodId: RICE, quantity: 2, unit: "g", optional: true }] },
      { steps: ["x".repeat(601)] },
      { steps: Array.from({ length: 41 }, (_, i) => `Paso ${i}`) },
    ];
    for (const patch of bad) expect(parseRecipeInput(valid(patch)).ok, JSON.stringify(patch)).toBe(false);
  });

  it("acepta ingredientes 'al gusto' y opcionales", () => {
    const r = parseRecipeInput(
      valid({
        ingredients: [
          { foodId: RICE, quantity: null, unit: null, optional: false },
          { foodId: EGG, quantity: 2.5, unit: "unit", optional: true },
        ],
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("no acepta algo que no sea un objeto", () => {
    for (const raw of [null, undefined, "x", 3, [], {}]) expect(parseRecipeInput(raw).ok).toBe(false);
  });
});

describe("textos en los dos idiomas", () => {
  const catalog: RecipeTexts = {
    name_es: "Ceviche",
    name_en: "Ceviche (Peruvian)",
    description_es: "Pescado marinado.",
    description_en: "Marinated fish.",
    steps_es: ["Corta el pescado.", "Sirve."],
    steps_en: ["Cut the fish.", "Serve."],
  };

  it("una receta nueva se guarda igual en ambos idiomas", () => {
    expect(localizeTexts("es", { name: "Tortilla", description: " Con papas ", steps: ["Fríe."] })).toEqual({
      name_es: "Tortilla", name_en: "Tortilla",
      description_es: "Con papas", description_en: "Con papas",
      steps_es: ["Fríe."], steps_en: ["Fríe."],
    });
    expect(localizeTexts("en", { name: "Omelette", description: "", steps: [] })).toEqual({
      name_es: "Omelette", name_en: "Omelette",
      description_es: null, description_en: null,
      steps_es: [], steps_en: [],
    });
  });

  it("editar en un idioma copia al otro solo lo que cambió", () => {
    // Quien usa la app en español cambia solo los pasos de una receta del catálogo.
    const r = localizeTexts("es", { name: "Ceviche", description: "Pescado marinado.", steps: ["Corta el pescado.", "Sirve con camote."] }, catalog);
    expect(r.steps_es).toEqual(["Corta el pescado.", "Sirve con camote."]);
    expect(r.steps_en).toEqual(["Corta el pescado.", "Sirve con camote."]);
    // El nombre y la descripción no se tocaron: conservan su versión en inglés.
    expect(r.name_en).toBe("Ceviche (Peruvian)");
    expect(r.description_en).toBe("Marinated fish.");
  });

  it("sin cambios conserva ambos idiomas tal cual", () => {
    const own = textsInLocale(catalog, "en");
    expect(localizeTexts("en", own, catalog)).toEqual(catalog);
    expect(localizeTexts("es", textsInLocale(catalog, "es"), catalog)).toEqual(catalog);
  });

  it("cambiar el nombre en inglés lo copia al español", () => {
    const r = localizeTexts("en", { name: "Lime fish", description: "Marinated fish.", steps: catalog.steps_en }, catalog);
    expect(r.name_en).toBe("Lime fish");
    expect(r.name_es).toBe("Lime fish");
    expect(r.steps_es).toEqual(catalog.steps_es);
  });

  it("borrar la descripción la quita en los dos idiomas", () => {
    const r = localizeTexts("es", { name: "Ceviche", description: "  ", steps: catalog.steps_es }, catalog);
    expect(r.description_es).toBeNull();
    expect(r.description_en).toBeNull();
  });

  it("textsInLocale entrega los textos del idioma pedido", () => {
    expect(textsInLocale(catalog, "es")).toEqual({ name: "Ceviche", description: "Pescado marinado.", steps: catalog.steps_es });
    expect(textsInLocale({ ...catalog, description_en: null }, "en").description).toBe("");
  });
});

describe("kcal de una receta propia", () => {
  const foods = new Map<string, FoodNutrition>([
    [RICE, { kcal_100g: 360, g_per_unit: null, g_per_ml: null }],
    [EGG, { kcal_100g: 143, g_per_unit: 50, g_per_ml: null }],
    [OIL, { kcal_100g: 884, g_per_unit: null, g_per_ml: 0.92 }],
  ]);

  it("suma los ingredientes obligatorios y divide entre las porciones (igual que el seed)", () => {
    const items = [
      { foodId: RICE, quantity: 200, unit: "g" as const, optional: false },
      { foodId: EGG, quantity: 2, unit: "unit" as const, optional: false },
      { foodId: OIL, quantity: 10, unit: "ml" as const, optional: true },
    ];
    const r = computeRecipeKcal(items, foods, 2);
    // (200 g × 3.6 + 2 × 50 g × 1.43) / 2 porciones
    expect(r.kcal).toBe(Math.round((720 + 143) / 2));
    expect(r.complete).toBe(true);
    expect(r.tooHigh).toBe(false);
    // Es exactamente lo que da la función del seed.
    const direct = kcalPerServing(items.map((i) => ({ ...i, food: foods.get(i.foodId)! })), 2);
    expect(r.kcal).toBe(direct.kcal);
  });

  it("sin cantidad ('al gusto') suma 0 y no vuelve incompleta la receta", () => {
    const r = computeRecipeKcal([{ foodId: RICE, quantity: null, unit: null, optional: false }], foods, 4);
    expect(r).toEqual({ kcal: 0, complete: true, tooHigh: false });
  });

  it("un alimento sin dato de kcal (o desconocido) deja la receta incompleta", () => {
    const noKcal = new Map(foods).set(EGG, { kcal_100g: null, g_per_unit: 50, g_per_ml: null });
    expect(computeRecipeKcal([{ foodId: EGG, quantity: 1, unit: "unit", optional: false }], noKcal, 1).complete).toBe(false);
    expect(computeRecipeKcal([{ foodId: "otro", quantity: 1, unit: "g", optional: false }], foods, 1).complete).toBe(false);
    // "unidades" sin peso por unidad tampoco se puede calcular.
    expect(computeRecipeKcal([{ foodId: RICE, quantity: 2, unit: "unit", optional: false }], foods, 1).complete).toBe(false);
  });

  it("un opcional sin dato no afecta", () => {
    const r = computeRecipeKcal(
      [{ foodId: RICE, quantity: 100, unit: "g", optional: false }, { foodId: "otro", quantity: 1, unit: "g", optional: true }],
      foods,
      1,
    );
    expect(r).toEqual({ kcal: 360, complete: true, tooHigh: false });
  });

  it("avisa de kcal imposibles (cantidades o unidades que no cuadran)", () => {
    const r = computeRecipeKcal([{ foodId: RICE, quantity: 3, unit: "kg", optional: false }], foods, 1);
    expect(r.kcal).toBe(10800);
    expect(r.tooHigh).toBe(true);
    expect(computeRecipeKcal([{ foodId: RICE, quantity: 1, unit: "kg", optional: false }], foods, 1).tooHigh).toBe(false);
  });
});

describe("qué receta se actualiza al editar", () => {
  const me = "user-me";
  const other = "user-other";
  const catalog = { id: "r-catalog", family_id: null, created_by: null };
  const mine = { id: "r-mine", family_id: "fam", created_by: me };
  const theirs = { id: "r-theirs", family_id: "fam", created_by: other };

  it("mi receta se actualiza en su lugar", () => {
    expect(resolveEditTarget(mine, me, [])).toEqual({ kind: "in-place", id: "r-mine" });
    // Aunque sea una versión mía de otra receta.
    expect(resolveEditTarget(mine, me, [{ id: "r-mine", parent_recipe_id: "r-catalog" }])).toEqual({ kind: "in-place", id: "r-mine" });
  });

  it("la primera edición de una del catálogo crea mi versión", () => {
    expect(resolveEditTarget(catalog, me, [])).toEqual({ kind: "new-copy", parentId: "r-catalog" });
  });

  it("las siguientes ediciones usan la versión que ya tengo (sin duplicados)", () => {
    const copies = [{ id: "c-other", parent_recipe_id: "r-something-else" }, { id: "c-1", parent_recipe_id: "r-catalog" }];
    expect(resolveEditTarget(catalog, me, copies)).toEqual({ kind: "my-copy", id: "c-1" });
  });

  it("editar la receta de otro integrante también crea mi versión, sin tocar la suya", () => {
    expect(resolveEditTarget(theirs, me, [])).toEqual({ kind: "new-copy", parentId: "r-theirs" });
    expect(resolveEditTarget(theirs, me, [{ id: "c-2", parent_recipe_id: "r-theirs" }])).toEqual({ kind: "my-copy", id: "c-2" });
  });

  it("una receta sin dueño nunca es 'mía', aunque coincida el autor", () => {
    expect(resolveEditTarget({ id: "r-x", family_id: null, created_by: me }, me, [])).toEqual({ kind: "new-copy", parentId: "r-x" });
  });
});
