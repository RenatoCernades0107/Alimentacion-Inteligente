import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import es from "../../messages/es.json";
import en from "../../messages/en.json";
import {
  adviceFor,
  allAdviceIds,
  allProfiles,
  defaultRipeness,
  defaultStorage,
  durationParts,
  hasRipeness,
  moveExpiry,
  predictExpiry,
  shelfLifeDays,
  storageNote,
  storageOptions,
  validRipeness,
  validStorage,
  type ShelfFood,
} from "./shelf-life";

const food = (key: string, category = "other"): ShelfFood => ({ key, category });
const avocado = food("avocado", "fruit");
const chicken = food("chicken", "meat");
const tomato = food("tomato", "produce");
const custom = (name: string, days: number | null = null): ShelfFood => ({ key: null, category: "custom", name_es: name, name_en: name, shelf_life_days: days });

describe("perfiles", () => {
  it("el lugar por defecto es una de las opciones y los días son enteros positivos", () => {
    for (const { id, profile } of allProfiles()) {
      const tables = profile.ripe ? [profile.ripe.unripe, profile.ripe.ripe] : [profile.days];
      for (const table of tables) {
        expect(Object.keys(table), id).toContain(profile.def);
        for (const days of Object.values(table)) {
          expect(Number.isInteger(days), id).toBe(true);
          expect(days, id).toBeGreaterThan(0);
          expect(days, id).toBeLessThanOrEqual(1200);
        }
      }
    }
  });

  it("verde y maduro ofrecen los mismos lugares, y días es el del estado por defecto", () => {
    for (const { id, profile } of allProfiles()) {
      if (!profile.ripe) continue;
      expect(Object.keys(profile.ripe.unripe).sort(), id).toEqual(Object.keys(profile.ripe.ripe).sort());
      expect(profile.days, id).toEqual(profile.ripe[profile.ripe.def]);
    }
  });

  it("congelado dura más que refrigerado (salvo que el refrigerador sea 'descongelado' o 'ya preparado')", () => {
    for (const { id, profile } of allProfiles()) {
      const tables = profile.ripe ? [profile.ripe.unripe, profile.ripe.ripe] : [profile.days];
      const note = profile.notes?.fridge;
      for (const t of tables) {
        if (t.fridge && t.freezer && note !== "thawed") expect(t.freezer, id).toBeGreaterThanOrEqual(t.fridge);
      }
    }
  });
});

describe("lugares según el alimento", () => {
  it("lo crudo y los lácteos nunca van al ambiente", () => {
    for (const f of [chicken, food("beef_steak", "meat"), food("salmon", "seafood"), food("milk", "dairy"), food("eggs", "dairy"), food("yogurt", "dairy"), food("ground_beef", "meat")]) {
      expect(storageOptions(f), f.key!).not.toContain("pantry");
    }
  });

  it("secos y enlatados van al ambiente; los enlatados, abiertos, al refrigerador", () => {
    expect(storageOptions(food("rice", "grains"))).toEqual(["pantry"]);
    expect(defaultStorage(food("pasta", "grains"))).toBe("pantry");
    expect(storageOptions(food("tuna_can", "pantry"))).toEqual(["pantry", "fridge"]);
    expect(storageNote(food("tuna_can", "pantry"), "fridge")).toBe("opened");
    expect(shelfLifeDays(food("tuna_can", "pantry"), "fridge")).toBeLessThan(shelfLifeDays(food("tuna_can", "pantry"), "pantry")!);
  });

  it("papas, cebollas, ajo, tomates y plátanos van primero al ambiente; frutos rojos y hojas al refrigerador", () => {
    for (const [key, category] of [["potato", "produce"], ["onion", "produce"], ["garlic", "produce"], ["tomato", "produce"], ["banana", "fruit"]]) {
      expect(defaultStorage(food(key, category)), key).toBe("pantry");
    }
    for (const [key, category] of [["strawberries", "fruit"], ["blueberries", "fruit"], ["lettuce", "produce"], ["spinach", "produce"], ["cilantro", "produce"]]) {
      expect(defaultStorage(food(key, category)), key).toBe("fridge");
    }
  });

  it("el pan va al ambiente o al congelador, los huevos solo al refrigerador", () => {
    expect(storageOptions(food("bread", "grains"))).toEqual(["pantry", "freezer"]);
    expect(storageOptions(food("eggs", "dairy"))).toEqual(["fridge"]);
  });

  it("un lugar que no corresponde se cambia por el recomendado", () => {
    expect(validStorage(chicken, "pantry")).toBe("fridge");
    expect(validStorage(chicken, "freezer")).toBe("freezer");
    expect(validStorage(chicken, "nonsense")).toBe("fridge");
    expect(validStorage(chicken, null)).toBe("fridge");
  });

  it("un alimento propio sin pistas no tiene lugares y usa los días que escribió la familia", () => {
    expect(storageOptions(custom("salsa de tamarindo con miel picante"))).toEqual([]);
    expect(defaultStorage(custom("salsa de tamarindo con miel picante"))).toBeNull();
    expect(shelfLifeDays(custom("salsa de tamarindo con miel picante", 45))).toBe(45);
    expect(shelfLifeDays(custom("salsa de tamarindo con miel picante"))).toBeNull();
    expect(validStorage(custom("algo", 10), "fridge")).toBeNull();
  });

  it("un alimento propio con nombre de sobras se trata como comida cocida", () => {
    for (const name of ["Sobras de arroz con pollo", "Guiso de lentejas", "Leftover soup", "sopa de ayer"]) {
      expect(storageOptions(custom(name)), name).toEqual(["fridge", "freezer"]);
      expect(shelfLifeDays(custom(name)), name).toBe(3);
    }
    // Si la familia escribió sus días, se respetan en el lugar habitual.
    expect(shelfLifeDays(custom("Sobras de pizza", 2))).toBe(2);
    expect(shelfLifeDays(custom("Sobras de pizza", 2), "freezer")).toBe(90);
  });

  it("sin alimento no hay nada que decir", () => {
    expect(storageOptions(null)).toEqual([]);
    expect(shelfLifeDays(undefined)).toBeNull();
    expect(adviceFor(null)).toEqual({ warnings: [], tips: [] });
    expect(predictExpiry({ food: null, from: "2026-10-03" }).expiresOn).toBeNull();
  });
});

describe("madurez", () => {
  it("solo la fruta que madura después de cosechada la pregunta", () => {
    for (const [key, category] of [["avocado", "fruit"], ["banana", "fruit"], ["mango", "fruit"], ["papaya", "fruit"], ["peach", "fruit"], ["pear", "fruit"], ["kiwi", "fruit"], ["tomato", "produce"], ["plantain", "fruit"], ["lucuma", "fruit"]]) {
      expect(hasRipeness(food(key, category)), key).toBe(true);
    }
    for (const [key, category] of [["apple", "fruit"], ["potato", "produce"], ["chicken", "meat"], ["rice", "grains"], ["strawberries", "fruit"]]) {
      expect(hasRipeness(food(key, category)), key).toBe(false);
      expect(validRipeness(food(key, category), "ripe"), key).toBeNull();
    }
    expect(hasRipeness(null)).toBe(false);
  });

  it("la palta verde madura al ambiente (dura más que una madura) y la madura dura más en el refrigerador", () => {
    expect(defaultRipeness(avocado)).toBe("unripe");
    expect(defaultStorage(avocado)).toBe("pantry");
    expect(shelfLifeDays(avocado, "pantry", "unripe")).toBeGreaterThan(shelfLifeDays(avocado, "pantry", "ripe")!);
    expect(shelfLifeDays(avocado, "fridge", "ripe")).toBeGreaterThan(shelfLifeDays(avocado, "pantry", "ripe")!);
    expect(shelfLifeDays(avocado)).toBe(shelfLifeDays(avocado, "pantry", "unripe"));
  });

  it("el tomate se supone maduro", () => {
    expect(defaultRipeness(tomato)).toBe("ripe");
    expect(shelfLifeDays(tomato, "fridge", "ripe")).toBeGreaterThanOrEqual(shelfLifeDays(tomato, "pantry", "ripe")!);
  });

  it("una madurez inválida se cambia por la de por defecto", () => {
    expect(validRipeness(avocado, "rotten")).toBe("unripe");
    expect(validRipeness(avocado, "ripe")).toBe("ripe");
    expect(validRipeness(avocado, null)).toBe("unripe");
  });
});

describe("predictExpiry", () => {
  const from = "2026-10-03";

  it("calcula la fecha con los días del lugar y la marca como estimada", () => {
    const fridge = predictExpiry({ food: chicken, storage: "fridge", from });
    expect(fridge).toMatchObject({ expiresOn: "2026-10-05", days: 2, estimated: true, storage: "fridge" });
    const freezer = predictExpiry({ food: chicken, storage: "freezer", from });
    expect(freezer.days).toBe(270);
    expect(freezer.expiresOn).toBe("2027-06-30");
  });

  it("el lugar cambia la fecha y la madurez también", () => {
    const pantry = predictExpiry({ food: avocado, storage: "pantry", ripeness: "unripe", from });
    const fridgeRipe = predictExpiry({ food: avocado, storage: "fridge", ripeness: "ripe", from });
    const pantryRipe = predictExpiry({ food: avocado, storage: "pantry", ripeness: "ripe", from });
    expect(pantry.expiresOn).not.toBe(fridgeRipe.expiresOn);
    expect(fridgeRipe.days).toBeGreaterThan(pantryRipe.days!);
    expect(pantry.days).toBeGreaterThan(pantryRipe.days!);
  });

  it("sin lugar usa el recomendado y sin madurez la de por defecto", () => {
    expect(predictExpiry({ food: avocado, from })).toMatchObject({ storage: "pantry", ripeness: "unripe" });
    expect(predictExpiry({ food: chicken, storage: "pantry", from })).toMatchObject({ storage: "fridge", days: 2 });
  });

  it("la fecha impresa manda y no es estimada", () => {
    expect(predictExpiry({ food: chicken, storage: "freezer", from, printedDate: "2027-01-15" })).toMatchObject({
      expiresOn: "2027-01-15",
      estimated: false,
      days: null,
      storage: "freezer",
    });
    // Una fecha inválida se ignora.
    expect(predictExpiry({ food: chicken, from, printedDate: "pronto" }).estimated).toBe(true);
    expect(predictExpiry({ food: chicken, from, printedDate: "2026-13-45" }).expiresOn).toBe("2026-10-05");
  });

  it("suma los días cruzando meses y años", () => {
    expect(predictExpiry({ food: food("butter", "dairy"), storage: "fridge", from: "2026-12-20" }).expiresOn).toBe("2027-02-18");
  });

  it("si no se puede estimar, la fecha es null", () => {
    expect(predictExpiry({ food: custom("x"), from })).toMatchObject({ expiresOn: null, estimated: true });
    expect(predictExpiry({ food: chicken, from: "ayer" }).expiresOn).toBeNull();
  });
});

describe("moveExpiry", () => {
  const today = "2026-10-03";

  it("al pasar al congelador se cuenta desde hoy con los días del congelador", () => {
    expect(moveExpiry({ food: chicken, from: "fridge", to: "freezer", today, current: "2026-10-04" })).toBe("2027-06-30");
  });

  it("al sacarlo del congelador valen los días de descongelado", () => {
    expect(moveExpiry({ food: chicken, from: "freezer", to: "fridge", today, current: "2027-06-30" })).toBe("2026-10-05");
  });

  it("pasar la mayonesa al refrigerador al abrirla usa los días de abierta", () => {
    const mayo = food("mayonnaise", "pantry");
    expect(moveExpiry({ food: mayo, from: "pantry", to: "fridge", today, current: "2027-01-01" })).toBe("2026-12-02");
  });

  it("a un lugar menos frío no puede durar más de lo que ya se esperaba", () => {
    const apple = food("apple", "fruit");
    expect(moveExpiry({ food: apple, from: "fridge", to: "pantry", today, current: "2026-10-06" })).toBe("2026-10-06");
    expect(moveExpiry({ food: apple, from: "fridge", to: "pantry", today, current: "2026-12-30" })).toBe("2026-10-17");
  });

  it("sin fecha previa o sin lugar de origen se estima desde hoy", () => {
    expect(moveExpiry({ food: chicken, from: null, to: "fridge", today, current: null })).toBe("2026-10-05");
    expect(moveExpiry({ food: chicken, from: "freezer", to: "fridge", today, current: null })).toBe("2026-10-05");
  });

  it("si no se puede estimar deja la fecha que había", () => {
    expect(moveExpiry({ food: custom("x"), from: "fridge", to: "freezer", today, current: "2026-11-01" })).toBe("2026-11-01");
    expect(moveExpiry({ food: custom("x"), from: "fridge", to: "freezer", today, current: null })).toBeNull();
  });
});

describe("consejos", () => {
  it("palta verde en el refrigerador avisa que madura mal; en el ambiente no", () => {
    expect(adviceFor(avocado, "fridge", "unripe").warnings).toEqual(["avocadoFridgeUnripe"]);
    expect(adviceFor(avocado, "pantry", "unripe").warnings).toEqual([]);
    expect(adviceFor(avocado, "fridge", "ripe").warnings).toEqual([]);
  });

  it("los consejos de la palta cubren madurarla, refrigerarla ya madura y cortada", () => {
    const green = adviceFor(avocado, "pantry", "unripe").tips;
    expect(green).toEqual(expect.arrayContaining(["avocadoRipen", "avocadoCut"]));
    expect(green).not.toContain("avocadoRipeFridge");
    expect(adviceFor(avocado, "fridge", "ripe").tips).toContain("avocadoRipeFridge");
    expect(adviceFor(avocado, "pantry", "ripe").tips).toContain("ripeSoon");
    expect(adviceFor(avocado, "freezer", "ripe").tips).toContain("avocadoFreeze");
  });

  it("reaccionan al lugar: papa, tomate, plátano, albahaca", () => {
    expect(adviceFor(food("potato", "produce"), "fridge").warnings).toEqual(["potatoFridge"]);
    expect(adviceFor(food("potato", "produce"), "pantry").warnings).toEqual([]);
    expect(adviceFor(tomato, "fridge", "ripe").warnings).toEqual(["tomatoFridgeRipe"]);
    expect(adviceFor(tomato, "fridge", "unripe").warnings).toEqual(["tomatoFridge"]);
    expect(adviceFor(food("banana", "fruit"), "fridge", "unripe").warnings).toEqual(["coldStopsRipening"]);
    expect(adviceFor(food("banana", "fruit"), "fridge", "ripe").tips).toContain("bananaRipeFridge");
    expect(adviceFor(food("basil", "produce"), "fridge").warnings).toEqual(["basilFridge"]);
  });

  it("congelar suma el consejo general y lo perecedero el de 'ante la duda'", () => {
    expect(adviceFor(chicken, "freezer").tips).toContain("freezeGeneral");
    expect(adviceFor(chicken, "fridge").tips).not.toContain("freezeGeneral");
    expect(adviceFor(chicken, "fridge").tips).toEqual(expect.arrayContaining(["rawPoultry", "doubt"]));
    expect(adviceFor(food("rice", "grains"), "pantry").tips).not.toContain("doubt");
  });

  it("no repite consejos y cada alimento del catálogo conocido tiene al menos uno", () => {
    for (const f of [avocado, chicken, food("bread", "grains"), food("eggs", "dairy"), food("rice", "grains")]) {
      const { tips, warnings } = adviceFor(f);
      expect(new Set(tips).size).toBe(tips.length);
      expect(new Set(warnings).size).toBe(warnings.length);
      expect(tips.length).toBeGreaterThan(0);
    }
  });
});

describe("textos", () => {
  const ids = allAdviceIds();

  it("cada consejo y aviso tiene texto en español e inglés", () => {
    for (const messages of [es, en]) {
      const shelf = messages.shelf as { tips: Record<string, string>; warns: Record<string, string> };
      for (const id of ids.tips) expect(shelf.tips[id], `tips.${id}`).toBeTruthy();
      for (const id of ids.warnings) expect(shelf.warns[id], `warns.${id}`).toBeTruthy();
    }
  });

  it("no sobran textos que ningún perfil use", () => {
    for (const messages of [es, en]) {
      const shelf = messages.shelf as { tips: Record<string, string>; warns: Record<string, string> };
      expect(Object.keys(shelf.tips).filter((k) => !ids.tips.includes(k))).toEqual([]);
      expect(Object.keys(shelf.warns).filter((k) => !ids.warnings.includes(k))).toEqual([]);
    }
  });

  it("los textos de los lugares, las aclaraciones y las duraciones existen", () => {
    for (const messages of [es, en]) {
      const shelf = messages.shelf as unknown as Record<string, Record<string, string>>;
      for (const k of ["pantry", "fridge", "freezer"]) {
        expect(shelf.storage[k]).toBeTruthy();
        expect(shelf.at[k]).toBeTruthy();
      }
      for (const k of ["unopened", "opened", "cut", "thawed", "prepared"]) expect(shelf.note[k]).toBeTruthy();
      for (const k of ["unripe", "ripe"]) expect(shelf.state[k]).toBeTruthy();
      for (const k of ["days", "weeks", "months", "years"]) expect(shelf.duration[k]).toBeTruthy();
    }
  });
});

describe("textos con formato", () => {
  it("las duraciones y la estimación se formatean sin errores en los dos idiomas", () => {
    const expected = {
      es: { days: ["1 día", "5 días"], weeks: ["1 semana", "3 semanas"], months: ["1 mes", "6 meses"], years: ["1 año", "2 años"], estimate: "Dura aprox. 5 días en el refrigerador." },
      en: { days: ["1 day", "5 days"], weeks: ["1 week", "3 weeks"], months: ["1 month", "6 months"], years: ["1 year", "2 years"], estimate: "Lasts about 5 days in the fridge." },
    };
    for (const [locale, messages] of [["es", es], ["en", en]] as const) {
      const t = createTranslator({ locale, messages, namespace: "shelf" });
      const want = expected[locale];
      for (const unit of ["days", "weeks", "months", "years"] as const) {
        const n = unit === "days" ? [1, 5] : unit === "weeks" ? [1, 3] : unit === "months" ? [1, 6] : [1, 2];
        expect(n.map((x) => t(`duration.${unit}`, { n: x }))).toEqual(want[unit]);
      }
      expect(t("estimate", { duration: t("duration.days", { n: 5 }), where: t("at.fridge") })).toBe(want.estimate);
    }
  });
});

describe("durationParts", () => {
  it("elige la unidad más natural", () => {
    expect(durationParts(1)).toEqual({ unit: "days", n: 1 });
    expect(durationParts(13)).toEqual({ unit: "days", n: 13 });
    expect(durationParts(21)).toEqual({ unit: "weeks", n: 3 });
    expect(durationParts(90)).toEqual({ unit: "months", n: 3 });
    expect(durationParts(365)).toEqual({ unit: "months", n: 12 });
    expect(durationParts(730)).toEqual({ unit: "years", n: 2 });
  });
});
