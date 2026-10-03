/**
 * Vida útil estimada de los alimentos según DÓNDE se guardan (ambiente, refrigerador o congelador),
 * su madurez (fruta que madura fuera del árbol) y consejos de conservación.
 *
 * Módulo puro y sin imports: lo usan la app, las acciones del servidor, los scripts y las pruebas.
 * Es la fuente de verdad: `foods.shelf_life_days` (supabase/data/foods.mjs) solo guarda el valor del lugar
 * por defecto de cada alimento y `shelf-life.test.ts` verifica que coincidan.
 *
 * Los días son estimaciones de CALIDAD con el alimento en buen estado y bien guardado, no fechas de
 * seguridad: ante la duda manda lo que se ve, huele y la fecha del empaque. Donde las fuentes dan un rango
 * se eligió el extremo prudente (en carnes, pescados y lácteos, el menor).
 *
 * Fuentes:
 * - The Food Keeper (FMI / Cornell University / USDA-FSIS, 4.ª ed., 2014), la base de USDA FoodKeeper:
 *   https://ifdaonline.org/wp-content/uploads/2024/02/food-keeper-2015-pdf.pdf — carnes, pescados, lácteos,
 *   sobras (3-4 días), panes, frutas y verduras, secos, latas (bajas en ácido 2-5 años, altas 12-18 meses;
 *   abiertas 3-7 días), condimentos y salsas (cerradas / abiertas), congelados.
 * - FoodSafety.gov, tablas de almacenamiento en frío: https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts
 * - Virginia Cooperative Extension, "Food Storage Guidelines For Consumers" (pub. 348-960):
 *   https://www.pubs.ext.vt.edu/348/348-960/348-960.html — qué no se refrigera, fruta que madura y luego va al
 *   refrigerador, papas / camotes / cebollas en lugar fresco (10-16 °C) y ventilado.
 * - UC Davis Postharvest Technology Center, hojas de frutas y hortalizas (daño por frío, madurez):
 *   https://postharvest.ucdavis.edu/produce-facts-sheets/avocado — palta con carne oscura y fibrosa si se enfría
 *   verde; plátano, tomate, mango y papaya se dañan bajo 10-13 °C; berenjena, pepino y albahaca también.
 * - Avocados From Mexico, "How to store avocados": https://avocadosfrommexico.com/education/how-to/store-avocados/
 *   (maduran en 4-5 días; maduras, 2-3 días en el refrigerador; cortadas con limón y tapadas).
 * - Palta Hass y frío: https://www7.uc.cl/sw_educ/agronomia/desorden_fruta/html/fichas/palta/frio/frio.htm (Pontificia
 *   Universidad Católica de Chile) y https://repositorio.unsch.edu.pe/handle/UNSCH/2655 (Universidad Nacional de
 *   San Cristóbal de Huamanga): madura en ~5-6 días a 20-25 °C; el frío en fruta verde da pulpa pardeada.
 * - Ají amarillo (2 semanas en el refrigerador, 4-6 meses congelado):
 *   https://elcomercio.pe/mag/respuestas/truco-cocina-como-conservar-el-aji-amarillo-hasta-por-un-mes-hacks-nndamn-noticia/
 * - Choclo con chala y congelado: https://comoconservar.org/choclo/ y https://infoagro.com.ar/como-conservar-el-choclo-y-tenerlo-fresco-todo-el-ano/
 * - Chirimoya (8-12 °C, madura en ~3-5 días) y lúcuma (climatérica, madura a temperatura ambiente):
 *   https://www.frutas-hortalizas.com/Frutas/Poscosecha-Chirimoya.html y https://www.portalfruticola.com/noticias/2026/06/01/cultivo-de-lucuma/
 * - Huevos (FDA, "Seguridad con los huevos"): https://www.fda.gov/media/82236/download
 * Lo que no figura en estas fuentes (tubérculos andinos, aguaymanto, frutas exóticas, quesos frescos peruanos,
 * chorizo parrillero) se estimó con prudencia a partir de la categoría más parecida.
 */

export const STORAGES = ["pantry", "fridge", "freezer"] as const;
/** Dónde se guarda: ambiente (despensa), refrigerador o congelador. */
export type Storage = (typeof STORAGES)[number];

export const RIPENESSES = ["unripe", "ripe"] as const;
/** Madurez de la fruta que madura después de cosechada (palta, plátano, mango…). */
export type Ripeness = (typeof RIPENESSES)[number];

/** Aclaración de un lugar: "refrigerador (ya abierto)", "ambiente (sin abrir)"… */
export type StorageNote = "unopened" | "opened" | "cut" | "thawed" | "prepared";

/** Lo mínimo que hace falta de un alimento (cabe una fila de `foods` tal cual). */
export type ShelfFood = {
  key?: string | null;
  category?: string | null;
  name_es?: string | null;
  name_en?: string | null;
  /** Días que escribió la familia en un alimento propio (los del catálogo no se leen: manda este módulo). */
  shelf_life_days?: number | null;
};

type Days = Partial<Record<Storage, number>>;
/** Consejo con condición: solo aplica si se guarda en ese lugar y/o con esa madurez. */
type Cond = { id: string; storage?: Storage; ripeness?: Ripeness };
type Tip = string | Cond;

type Profile = {
  /** Lugar sugerido. */
  def: Storage;
  /** Días por lugar. Solo están los lugares sensatos y seguros para este alimento. */
  days: Days;
  /** Si hay madurez, los días por lugar de cada estado (y `days` es el del estado `def`). */
  ripe?: { def: Ripeness; unripe: Days; ripe: Days };
  notes?: Partial<Record<Storage, StorageNote>>;
  tips: Tip[];
  warns?: Cond[];
  /** Perecedero (carnes, lácteos, cocidos…): suma el aviso de "ante la duda, bótalo". */
  care?: boolean;
};

const d = (pantry?: number, fridge?: number, freezer?: number): Days => ({
  ...(pantry ? { pantry } : {}),
  ...(fridge ? { fridge } : {}),
  ...(freezer ? { freezer } : {}),
});

const prof = (def: Storage, days: Days, tips: Tip[], extra: Pick<Profile, "notes" | "warns" | "care"> = {}): Profile => ({ def, days, tips, ...extra });

const ripening = (rdef: Ripeness, def: Storage, unripe: Days, ripe: Days, tips: Tip[], warns: Cond[] = []): Profile => ({
  def,
  days: rdef === "unripe" ? unripe : ripe,
  ripe: { def: rdef, unripe, ripe },
  tips,
  warns,
});

const FREEZE_VEG: Cond = { id: "freezeVeg", storage: "freezer" };
const COLD_STOPS: Cond = { id: "coldStopsRipening", storage: "fridge", ripeness: "unripe" };
const RIPE_SOON: Cond = { id: "ripeSoon", storage: "pantry", ripeness: "ripe" };

// -----------------------------------------------------------------------------------------------
// Perfiles: cada uno agrupa alimentos que se guardan igual. Los números van en días.
// -----------------------------------------------------------------------------------------------
const PROFILES: Record<string, Profile> = {
  // --- Secos y de despensa ---
  dry: prof("pantry", d(365), ["dry"]),
  rice: prof("pantry", d(730), ["dry", "riceCooked"]),
  spice: prof("pantry", d(1095), ["spice"]),
  oil: prof("pantry", d(365), ["oil"]),
  honey: prof("pantry", d(730), ["honey"]),
  chocolate: prof("pantry", d(365), ["chocolate"]),
  flour: prof("pantry", d(365, undefined, 730), ["flour"]),
  nuts: prof("pantry", d(180, 270, 365), ["nuts"]),
  seeds: prof("pantry", d(365, 540, 730), ["nuts"]),
  driedFruit: prof("pantry", d(180, 270), ["driedFruit"], { notes: { fridge: "opened" } }),
  fat: prof("pantry", d(180, 365), ["oil"], { notes: { fridge: "opened" } }),
  yeast: prof("pantry", d(365, 180, 730), ["yeast"], { notes: { fridge: "opened", freezer: "opened" } }),
  coffee: prof("pantry", d(180, undefined, 365), ["coffee"]),
  panettone: prof("pantry", d(90, undefined, 180), ["panettone"]),
  pudding: prof("pantry", d(365, 3), ["pudding"], { notes: { pantry: "unopened", fridge: "prepared" } }),
  canned: prof("pantry", d(1095, 3), ["canned"], { notes: { fridge: "opened" } }),
  condiment: prof("pantry", d(365, 180), ["condiment"], { notes: { pantry: "unopened", fridge: "opened" } }),
  creamySauce: prof("pantry", d(90, 60), ["creamySauce"], { notes: { pantry: "unopened", fridge: "opened" } }),
  freshSauce: prof("fridge", d(undefined, 7), ["creamySauce"], { care: true }),
  pastaSauce: prof("pantry", d(365, 5, 90), ["condiment"], { notes: { pantry: "unopened", fridge: "opened" } }),
  stock: prof("pantry", d(365, 4, 120), ["stock"], { notes: { pantry: "unopened", fridge: "opened" } }),
  juice: prof("fridge", d(180, 7), ["juice"], { notes: { pantry: "unopened" } }),

  // --- Frutas que maduran: días según la madurez en cada lugar ---
  avocado: ripening(
    "unripe", "pantry", d(6, 6, 120), d(2, 4, 120),
    ["avocadoRipen", { id: "avocadoRipeFridge", ripeness: "ripe" }, "avocadoCut", { id: "avocadoFreeze", storage: "freezer" }, RIPE_SOON],
    [{ id: "avocadoFridgeUnripe", storage: "fridge", ripeness: "unripe" }],
  ),
  banana: ripening(
    "unripe", "pantry", d(5, 5, 90), d(3, 5, 90),
    ["bananaRipen", { id: "bananaRipeFridge", storage: "fridge", ripeness: "ripe" }, { id: "bananaFreeze", storage: "freezer" }, RIPE_SOON],
    [COLD_STOPS],
  ),
  plantain: ripening(
    "unripe", "pantry", d(7, 7, 180), d(3, 5, 180),
    ["plantain", { id: "plantainFreeze", storage: "freezer" }, RIPE_SOON],
    [COLD_STOPS],
  ),
  mango: ripening("unripe", "pantry", d(6, 6, 240), d(3, 5, 240), ["mangoRipen", RIPE_SOON], [COLD_STOPS]),
  papaya: ripening("unripe", "pantry", d(5, 5, 240), d(3, 5, 240), ["papayaRipen", RIPE_SOON], [COLD_STOPS]),
  pear: ripening("unripe", "pantry", d(6, 10, 60), d(2, 5, 60), ["pearRipen", RIPE_SOON]),
  stoneFruit: ripening("unripe", "pantry", d(5, 5, 180), d(2, 5, 180), ["stoneRipen", RIPE_SOON], [COLD_STOPS]),
  kiwi: ripening("unripe", "pantry", d(7, 21), d(2, 5), ["kiwiRipen", RIPE_SOON]),
  tomato: ripening(
    "ripe", "pantry", d(7, 7, 60), d(5, 7, 60),
    ["tomatoCounter", { id: "tomatoFreeze", storage: "freezer" }],
    [{ id: "tomatoFridge", storage: "fridge", ripeness: "unripe" }, { id: "tomatoFridgeRipe", storage: "fridge", ripeness: "ripe" }],
  ),
  cherimoya: ripening("unripe", "pantry", d(4, 4, 300), d(2, 4, 300), ["cherimoyaRipen", RIPE_SOON], [COLD_STOPS]),
  soursop: ripening("unripe", "pantry", d(4, 4, 180), d(2, 4, 180), ["soursopRipen", RIPE_SOON], [COLD_STOPS]),
  lucuma: ripening("unripe", "pantry", d(5, 5, 180), d(2, 5, 180), ["lucumaRipen", RIPE_SOON], [COLD_STOPS]),

  // --- Otras frutas ---
  apple: prof("fridge", d(14, 30), ["apple"]),
  quince: prof("pantry", d(14, 30), ["quince"]),
  citrus: prof("fridge", d(7, 21), ["citrus"]),
  coconut: prof("pantry", d(7, 14, 180), ["coconut"], { notes: { freezer: "cut" } }),
  melon: prof("pantry", d(7, 4), ["melon"], { notes: { fridge: "cut" } }),
  pineapple: prof("fridge", d(3, 5, 270), ["pineapple"]),
  grapes: prof("fridge", d(undefined, 7, 30), ["grapes"]),
  berries: prof("fridge", d(undefined, 5, 270), ["berries", { id: "berriesFreeze", storage: "freezer" }]),
  frozenFruit: prof("freezer", d(undefined, 4, 180), ["frozenFood"], { notes: { fridge: "thawed" } }),
  exotic: prof("fridge", d(5, 7), ["exotic"]),
  exoticPulp: prof("fridge", d(5, 7, 240), ["exotic", { id: "pulpFreeze", storage: "freezer" }]),
  goldenberry: prof("fridge", d(7, 10, 180), ["goldenberry"]),
  pomegranate: prof("fridge", d(7, 21, 270), ["pomegranate"], { notes: { freezer: "cut" } }),
  figs: prof("fridge", d(2, 5, 180), ["figs"]),

  // --- Verduras y hortalizas ---
  potato: prof("pantry", d(21, 28), ["potato"], { warns: [{ id: "potatoFridge", storage: "fridge" }] }),
  sweetPotato: prof("pantry", d(21), ["sweetPotato"]),
  yuca: prof("pantry", d(7, 3, 60), ["yuca"], { notes: { fridge: "cut", freezer: "cut" } }),
  andean: prof("pantry", d(14), ["andean"]),
  onion: prof("pantry", d(30, 7, 270), ["onion"], { notes: { fridge: "cut", freezer: "cut" } }),
  garlic: prof("pantry", d(90, 7, 180), ["garlic"], { notes: { fridge: "cut", freezer: "cut" } }),
  greenOnion: prof("fridge", d(undefined, 7, 180), ["greenOnion"], { notes: { freezer: "cut" } }),
  ginger: prof("fridge", d(5, 21, 180), ["ginger"]),
  pepper: prof("fridge", d(4, 10, 240), ["pepper", FREEZE_VEG]),
  aji: prof("fridge", d(3, 10, 150), ["pepper"]),
  rootVeg: prof("fridge", d(undefined, 21, 270), ["rootVeg", FREEZE_VEG]),
  radish: prof("fridge", d(undefined, 14), ["rootVeg"]),
  stalks: prof("fridge", d(undefined, 14, 270), ["stalks", FREEZE_VEG]),
  leafy: prof("fridge", d(undefined, 7), ["leafy"]),
  saladMix: prof("fridge", d(undefined, 5), ["saladMix"]),
  leafyCook: prof("fridge", d(undefined, 5, 270), ["leafy", FREEZE_VEG]),
  brassica: prof("fridge", d(undefined, 7, 270), ["brassica", FREEZE_VEG]),
  crisper: prof("fridge", d(undefined, 7), ["crisper"]),
  crisperFreeze: prof("fridge", d(undefined, 7, 240), ["crisper", FREEZE_VEG]),
  eggplant: prof("fridge", d(2, 7, 240), ["eggplant", FREEZE_VEG]),
  sprouts: prof("fridge", d(undefined, 3), ["sprouts"], { care: true }),
  mushrooms: prof("fridge", d(undefined, 7, 180), ["mushrooms"]),
  corn: prof("fridge", d(undefined, 5, 240), ["corn", FREEZE_VEG]),
  squash: prof("pantry", d(30, 5, 270), ["squash"], { notes: { fridge: "cut", freezer: "prepared" } }),
  legumeFresh: prof("fridge", d(undefined, 5, 240), ["legumeFresh", FREEZE_VEG]),
  herb: prof("fridge", d(undefined, 7, 90), ["herbs"], { notes: { freezer: "cut" } }),
  basil: prof("pantry", d(5, 5, 90), ["herbs"], { warns: [{ id: "basilFridge", storage: "fridge" }], notes: { freezer: "cut" } }),

  // --- Lácteos y huevos (nunca al ambiente) ---
  eggs: prof("fridge", d(undefined, 28), ["eggs", "eggsRoom"], { care: true }),
  milk: prof("fridge", d(undefined, 7, 90), ["milk"], { care: true }),
  plantMilk: prof("fridge", d(undefined, 7), ["plantMilk"]),
  butter: prof("fridge", d(undefined, 60, 240), ["butter"]),
  cream: prof("fridge", d(undefined, 10, 90), ["cream"], { care: true }),
  cultured: prof("fridge", d(undefined, 14), ["cultured"], { care: true }),
  cheeseSoft: prof("fridge", d(undefined, 10, 90), ["cheeseSoft"], { care: true }),
  cheeseNoFreeze: prof("fridge", d(undefined, 7), ["cheeseSoft"], { care: true }),
  cheeseHard: prof("fridge", d(undefined, 28, 180), ["cheeseHard"]),
  tofu: prof("fridge", d(undefined, 7, 150), ["tofu"], { care: true }),
  hummus: prof("fridge", d(undefined, 7), ["hummus"], { care: true }),

  // --- Carnes y pescados (nunca al ambiente) ---
  poultryRaw: prof("fridge", d(undefined, 2, 270), ["rawPoultry"], { care: true }),
  beefCut: prof("fridge", d(undefined, 4, 240), ["rawMeat"], { care: true }),
  groundMeat: prof("fridge", d(undefined, 2, 120), ["groundMeat"], { care: true }),
  offal: prof("fridge", d(undefined, 2, 90), ["offal"], { care: true }),
  cured: prof("fridge", d(undefined, 7, 60), ["curedMeat"], { care: true }),
  fishRaw: prof("fridge", d(undefined, 2, 90), ["rawFish"], { care: true }),
  shellfishRaw: prof("fridge", d(undefined, 1, 90), ["shellfish"], { care: true }),
  frozenMeat: prof("freezer", d(undefined, 2, 90), ["frozenFood"], { notes: { fridge: "thawed" }, care: true }),

  // --- Panes y repostería ---
  bread: prof("pantry", d(5, undefined, 90), ["bread", { id: "breadFreeze", storage: "freezer" }]),
  pastry: prof("pantry", d(3, 4, 60), ["pastry"]),
  freshPasta: prof("fridge", d(undefined, 5, 60), ["freshPasta"], { care: true }),
  dough: prof("fridge", d(undefined, 14, 90), ["freshPasta"], { care: true }),

  // --- Congelados y cocidos ---
  frozenOnly: prof("freezer", d(undefined, undefined, 90), ["frozenFood"]),
  frozenMeal: prof("freezer", d(undefined, 3, 60), ["frozenFood"], { notes: { fridge: "thawed" }, care: true }),
  cooked: prof("fridge", d(undefined, 3, 90), ["leftovers"], { care: true }),
};

/** Perfil por defecto de cada categoría del catálogo (para alimentos del catálogo sin entrada propia). Siempre del lado seguro. */
const CATEGORY_PROFILE: Record<string, Profile> = {
  basics: PROFILES.dry,
  pantry: PROFILES.dry,
  spices: PROFILES.spice,
  grains: PROFILES.dry,
  snacks: PROFILES.dry,
  legumes: PROFILES.dry,
  nuts: PROFILES.nuts,
  beverages: PROFILES.dry,
  frozen: PROFILES.frozenOnly,
  fruit: prof("fridge", d(undefined, 5), ["crisper"]),
  produce: PROFILES.crisper,
  dairy: prof("fridge", d(undefined, 7, 60), ["milk"], { care: true }),
  meat: prof("fridge", d(undefined, 2, 120), ["rawMeat"], { care: true }),
  seafood: prof("fridge", d(undefined, 1, 90), ["rawFish"], { care: true }),
};

/** Perfil de cada alimento del catálogo (key de supabase/data/foods.mjs); `[perfil, días]` cambia los días del perfil. */
const MEMBERS: Record<string, (string | [string, Days])[]> = {
  dry: [
    ["salt", d(1095)], ["sugar", d(730)], "baking_powder", ["baking_soda", d(1095)], ["vanilla", d(1095)], ["cornstarch", d(730)], ["chuno", d(730)],
    ["vinegar", d(1095)], ["hazelnut_spread", d(180)], "algarrobina", ["panela", d(730)], ["sweetener", d(730)], "instant_soup",
    ["bread_crumbs", d(180)], ["soda_crackers", d(180)], ["cocoa", d(730)], "purple_corn", ["gelatin", d(730)], "baking_mix", "maca",
    ["pasta", d(730)], ["macaroni", d(730)], ["lasagna_sheets", d(730)], "oats", "cereal", ["granola", d(180)], ["cereal_bar", d(180)],
    ["quinoa", d(730)], ["kiwicha", d(730)], ["wheat", d(730)], ["barley", d(730)], "mote", "cancha", ["toast", d(90)],
    "popcorn", ["chips", d(90)], ["cookies", d(180)], "candy",
    "canary_beans", "kidney_beans", "black_beans", "lentils", "chickpeas", "lima_beans",
    ["chia", d(730)], ["sesame", d(730)], ["tea", d(730)], "chocolate_drink",
  ],
  rice: [["rice", d(730)]],
  spice: [
    "cumin", "oregano", "paprika", "cinnamon", "garlic_powder", "chili_powder", "bay_leaf", "turmeric", "cloves", "nutmeg", "anise", "curry",
    "rosemary", "thyme", ["black_pepper", d(730)], ["seasoning", d(730)], ["dried_chili", d(365)],
  ],
  oil: ["vegetable_oil", ["olive_oil", d(540)]],
  fat: ["lard"],
  honey: [["honey", d(730)]],
  chocolate: ["chocolate"],
  flour: ["flour", ["bran", d(180)], "semolina", "cornmeal"],
  nuts: ["peanuts", "walnuts", "pecans", "cashews", "brazil_nuts", "pistachios", "hazelnuts", "macadamia", "mixed_nuts", ["almonds", d(365, 540, 730)]],
  seeds: ["flaxseed", "seeds"],
  driedFruit: ["raisins", "dried_fruit"],
  yeast: ["yeast"],
  coffee: ["coffee"],
  panettone: ["panettone"],
  pudding: ["pudding"],
  canned: [
    ["tuna_can", d(1095, 3)], ["canned_fish", d(1095, 3)], ["canned_fruit", d(730, 5)], ["palm_hearts", d(730, 5)],
    ["canned_tomatoes", d(730, 5)], ["tomato_paste", d(365, 7)], ["evaporated_milk", d(365, 4)], ["condensed_milk", d(365, 5)],
  ],
  condiment: [
    ["soy_sauce", d(730, 90)], ["oyster_sauce", d(365, 270)], ["worcestershire", d(730, 365)], "ketchup", ["mustard", d(365, 365)],
    ["dressing", d(270, 60)], ["aji_sauce", d(180, 90)], ["maple_syrup", d(365, 180)], "jam", ["dulce_de_leche", d(180, 30)],
    ["bbq_sauce", d(365, 120)], ["peanut_butter", d(180, 120)], ["aji_amarillo_paste", d(180, 30, 180)], ["aji_panca_paste", d(180, 30, 180)],
    ["capers", d(365, 180)], ["pickles", d(365, 60)], ["olives", d(365, 14)],
  ],
  creamySauce: ["mayonnaise"],
  freshSauce: ["huancaina_sauce"],
  pastaSauce: ["pasta_sauce"],
  stock: ["chicken_stock"],
  juice: ["juice"],

  avocado: ["avocado"],
  banana: ["banana"],
  plantain: ["plantain"],
  mango: ["mango"],
  papaya: ["papaya"],
  pear: ["pear"],
  stoneFruit: ["peach", "plums"],
  kiwi: ["kiwi"],
  tomato: ["tomato"],
  cherimoya: ["cherimoya"],
  soursop: ["soursop"],
  lucuma: ["lucuma"],

  apple: ["apple"],
  quince: ["quince"],
  citrus: [["lime", d(7, 21)], ["lemon", d(7, 21)], ["orange", d(7, 21)], ["grapefruit", d(7, 21)], ["tangerine", d(7, 14)]],
  coconut: ["coconut"],
  melon: ["watermelon", "melon"],
  pineapple: ["pineapple"],
  grapes: ["grapes"],
  berries: ["strawberries", ["blueberries", d(undefined, 7, 270)], ["raspberries", d(undefined, 3, 270)], ["blackberries", d(undefined, 3, 270)], "cherries"],
  frozenFruit: ["mixed_berries", "fruit_pulp"],
  exotic: ["prickly_pear", "starfruit", "pitahaya"],
  exoticPulp: ["passion_fruit", ["granadilla", d(10, 14, 240)]],
  goldenberry: ["goldenberries"],
  pomegranate: ["pomegranate"],
  figs: ["figs"],

  potato: ["potato", ["yellow_potato", d(14, 21)]],
  sweetPotato: ["sweet_potato"],
  yuca: ["yuca"],
  andean: ["olluco"],
  onion: ["onion", "red_onion"],
  garlic: ["garlic"],
  greenOnion: ["green_onion"],
  ginger: ["ginger"],
  pepper: ["bell_pepper", "jalapeno"],
  aji: ["aji_amarillo", "aji_limo", ["rocoto", d(3, 14, 180)]],
  rootVeg: ["carrot", ["beet", d(undefined, 21, 240)], ["turnip", d(undefined, 14, 270)]],
  radish: [["radish", d(undefined, 14)]],
  stalks: ["celery", "leek", ["fennel", d(undefined, 7, 270)]],
  leafy: ["lettuce", ["arugula", d(undefined, 5)], ["watercress", d(undefined, 5)]],
  saladMix: ["salad_mix"],
  leafyCook: ["spinach", "chard", ["kale", d(undefined, 7, 270)]],
  brassica: [["cabbage", d(undefined, 21, 270)], ["bok_choy", d(undefined, 5, 270)], "broccoli", "cauliflower"],
  crisper: ["artichoke", "caigua", "cucumber"],
  crisperFreeze: [["asparagus", d(undefined, 5, 150)], "zucchini", "green_beans", ["snow_peas", d(undefined, 5, 240)], ["mixed_vegetables", d(undefined, 5, 240)]],
  eggplant: ["eggplant"],
  sprouts: [["bean_sprouts", d(undefined, 3)]],
  mushrooms: ["mushrooms"],
  corn: ["corn"],
  squash: ["squash"],
  legumeFresh: ["peas", "fava_beans"],
  herb: ["cilantro", "parsley", "dill", "mint", "huacatay"],
  basil: ["basil"],

  eggs: ["eggs"],
  milk: ["milk"],
  plantMilk: ["plant_milk"],
  butter: ["butter", ["margarine", d(undefined, 120, 365)]],
  cream: ["heavy_cream"],
  cultured: ["sour_cream", ["yogurt", d(undefined, 14, 45)]],
  cheeseSoft: ["fresh_cheese", ["mozzarella", d(undefined, 21, 120)]],
  cheeseNoFreeze: [["cream_cheese", d(undefined, 14)], "ricotta"],
  cheeseHard: ["cheddar", ["parmesan", d(undefined, 90, 180)]],
  tofu: ["tofu"],
  hummus: ["hummus"],

  poultryRaw: ["chicken", "chicken_breast", "chicken_thighs", "chicken_wings", ["turkey", d(undefined, 2, 270)], ["duck", d(undefined, 2, 180)], "guinea_pig", "rabbit"],
  beefCut: ["beef_sirloin", "beef_steak", "pork", "pork_chops", ["lamb", d(undefined, 3, 240)]],
  groundMeat: ["ground_beef", "beef_stew"],
  offal: ["offal", "beef_heart"],
  cured: [
    ["bacon", d(undefined, 7, 30)], ["ham", d(undefined, 5, 60)], ["cold_cuts", d(undefined, 14, 60)], ["pate", d(undefined, 7, 60)],
    ["sausage", d(undefined, 7, 60)], ["chorizo", d(undefined, 3, 60)], ["blood_sausage", d(undefined, 5, 60)],
  ],
  fishRaw: [["white_fish", d(undefined, 2, 180)], ["salmon", d(undefined, 2, 75)], ["trout", d(undefined, 2, 75)], ["fresh_tuna", d(undefined, 2, 75)]],
  shellfishRaw: [
    ["shrimp", d(undefined, 2, 270)], "mussels", "scallops", "clams", ["squid", d(undefined, 2, 180)],
    ["octopus", d(undefined, 2, 180)], ["crab", d(undefined, 2, 90)],
  ],
  frozenMeat: ["burgers", "breaded_chicken", "mixed_seafood"],

  bread: ["bread", ["burger_buns", d(7, undefined, 90)], ["tortillas", d(14, 30, 180)]],
  pastry: ["pastries", ["cake", d(5, 7, 180)]],
  freshPasta: ["stuffed_pasta"],
  dough: ["dough"],

  frozenOnly: [["french_fries", d(undefined, undefined, 180)], "frozen_snacks", ["ice_cream", d(undefined, undefined, 60)]],
  frozenMeal: [["pizza", d(undefined, 3, 60)]],
  cooked: ["empanadas", "ready_meal"],
};

const FOOD_PROFILE = new Map<string, { id: string; profile: Profile }>();
const DUPLICATE_KEYS: string[] = [];
for (const [id, list] of Object.entries(MEMBERS)) {
  for (const member of list) {
    const [key, override] = typeof member === "string" ? [member, null] : member;
    if (FOOD_PROFILE.has(key)) DUPLICATE_KEYS.push(key);
    const base = PROFILES[id];
    if (!base) throw new Error(`shelf-life: perfil desconocido "${id}"`);
    FOOD_PROFILE.set(key, { id, profile: override ? { ...base, days: { ...base.days, ...override } } : base });
  }
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Alimentos propios sin categoría: solo se reconocen los cocidos, que son los que más conviene no pasar por alto. */
const LEFTOVER_NAME = /\b(sobras?|restos?|leftovers?|guisos?|sopas?|soups?|stews?|cocid[oa]s?|cooked)\b/;

type Resolved = { id: string; profile: Profile; custom: boolean };

function resolve(food: ShelfFood | null | undefined): Resolved | null {
  if (!food) return null;
  const key = food.key ? FOOD_PROFILE.get(food.key) : undefined;
  if (key) return { ...key, custom: false };
  const category = food.category ? CATEGORY_PROFILE[food.category] : undefined;
  if (category) return { id: `category:${food.category}`, profile: category, custom: false };
  const name = norm(`${food.name_es ?? ""} ${food.name_en ?? ""}`);
  if (LEFTOVER_NAME.test(name)) return { id: "cooked", profile: PROFILES.cooked, custom: true };
  return null;
}

/** Días de un alimento propio (los que escribió la familia) cuando no hay perfil. */
function customDays(food: ShelfFood): number | null {
  const n = Number(food.shelf_life_days);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function optionsOf(p: Profile): Storage[] {
  const days = p.ripe ? p.ripe[p.ripe.def] : p.days;
  return STORAGES.filter((s) => days[s] !== undefined);
}

/** Lugares sensatos y seguros para guardar el alimento (en orden: ambiente, refrigerador, congelador). Vacío si no se sabe. */
export function storageOptions(food: ShelfFood | null | undefined): Storage[] {
  const r = resolve(food);
  return r ? optionsOf(r.profile) : [];
}

/** El mejor lugar para guardarlo; null si no se sabe. */
export function defaultStorage(food: ShelfFood | null | undefined): Storage | null {
  const r = resolve(food);
  return r ? r.profile.def : null;
}

/** El lugar si es válido para este alimento; si no, el recomendado (null si no se sabe nada del alimento). */
export function validStorage(food: ShelfFood | null | undefined, storage: string | null | undefined): Storage | null {
  const options = storageOptions(food);
  if (!options.length) return null;
  return (options as string[]).includes(storage ?? "") ? (storage as Storage) : defaultStorage(food);
}

/** Aclaración del lugar ("ya abierto", "sin abrir"…) para mostrarla junto a su nombre. */
export function storageNote(food: ShelfFood | null | undefined, storage: Storage): StorageNote | null {
  return resolve(food)?.profile.notes?.[storage] ?? null;
}

/** ¿La fruta madura después de cosechada (y por eso se pregunta si está verde o madura)? */
export function hasRipeness(food: ShelfFood | null | undefined): boolean {
  return !!resolve(food)?.profile.ripe;
}

export function defaultRipeness(food: ShelfFood | null | undefined): Ripeness | null {
  return resolve(food)?.profile.ripe?.def ?? null;
}

/** La madurez si es válida para este alimento; null si el alimento no madura. */
export function validRipeness(food: ShelfFood | null | undefined, ripeness: string | null | undefined): Ripeness | null {
  const p = resolve(food)?.profile;
  if (!p?.ripe) return null;
  return (RIPENESSES as readonly string[]).includes(ripeness ?? "") ? (ripeness as Ripeness) : p.ripe.def;
}

function daysFor(r: Resolved, food: ShelfFood, storage: Storage, ripeness: Ripeness | null): number | null {
  const p = r.profile;
  const table = p.ripe ? p.ripe[ripeness ?? p.ripe.def] : p.days;
  const days = table[storage];
  if (days === undefined) return null;
  // Un alimento propio que se reconoció por su nombre respeta los días que escribió la familia en su lugar habitual.
  const own = r.custom ? customDays(food) : null;
  return own && storage === p.def ? own : days;
}

/** Días que dura en ese lugar (y con esa madurez); null si no se sabe. Sin lugar, el recomendado. */
export function shelfLifeDays(food: ShelfFood | null | undefined, storage?: Storage | null, ripeness?: Ripeness | null): number | null {
  if (!food) return null;
  const r = resolve(food);
  if (!r) return customDays(food);
  const where = validStorage(food, storage);
  if (!where) return null;
  return daysFor(r, food, where, validRipeness(food, ripeness));
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function isDate(s: unknown): s is string {
  if (typeof s !== "string" || !ISO.test(s)) return false;
  const date = new Date(`${s}T00:00:00Z`);
  // Comparar de vuelta descarta fechas que no existen (2026-02-30).
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === s;
}

/** Suma días a una fecha YYYY-MM-DD (en UTC, sin horas de por medio). */
function plusDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type ShelfPrediction = {
  /** Fecha de vencimiento (YYYY-MM-DD); null si no hay forma de estimarla. */
  expiresOn: string | null;
  /** Días estimados desde `from`; null si la fecha es la impresa en el empaque o no se pudo estimar. */
  days: number | null;
  /** false si la fecha es la impresa en el empaque; true si la calculamos nosotros. */
  estimated: boolean;
  /** Lugar con el que se calculó (null si no se sabe nada del alimento). */
  storage: Storage | null;
  ripeness: Ripeness | null;
};

/**
 * Predice el vencimiento: la fecha impresa manda (no es estimada); si no hay, se calcula con los días del
 * alimento en ese lugar y con esa madurez, desde la fecha de compra (`from`).
 */
export function predictExpiry(input: {
  food: ShelfFood | null | undefined;
  storage?: Storage | null;
  ripeness?: Ripeness | null;
  /** Fecha de compra / de hoy (YYYY-MM-DD). */
  from: string;
  /** Fecha impresa o escrita a mano: si es válida, se respeta tal cual. */
  printedDate?: string | null;
}): ShelfPrediction {
  const { food } = input;
  const storage = validStorage(food, input.storage);
  const ripeness = validRipeness(food, input.ripeness);
  if (isDate(input.printedDate)) return { expiresOn: input.printedDate, days: null, estimated: false, storage, ripeness };
  const days = shelfLifeDays(food, storage, ripeness);
  if (!days || !isDate(input.from)) return { expiresOn: null, days: null, estimated: true, storage, ripeness };
  return { expiresOn: plusDays(input.from, days), days, estimated: true, storage, ripeness };
}

const RANK: Record<Storage, number> = { pantry: 0, fridge: 1, freezer: 2 };

/**
 * Nueva fecha cuando el alimento cambia de lugar ("lo pasé al congelador", "ya lo abrí"): se cuenta desde hoy con
 * los días del lugar nuevo. Si pasa a un lugar menos frío no puede durar más de lo que ya se esperaba (salvo que
 * viniera del congelador: ahí valen los días de descongelado).
 */
export function moveExpiry(input: {
  food: ShelfFood | null | undefined;
  from: Storage | null | undefined;
  to: Storage;
  ripeness?: Ripeness | null;
  today: string;
  current?: string | null;
}): string | null {
  const next = predictExpiry({ food: input.food, storage: input.to, ripeness: input.ripeness, from: input.today }).expiresOn;
  const current = isDate(input.current) ? input.current : null;
  if (!next) return current;
  if (!current || !input.from) return next;
  if (input.from !== "freezer" && RANK[input.to] < RANK[input.from]) return next < current ? next : current;
  return next;
}

/** Consejos de conservación: `warnings` reaccionan al lugar y a la madurez elegidos; `tips` son generales. Son claves de `shelf.warns.*` y `shelf.tips.*`. */
export function adviceFor(
  food: ShelfFood | null | undefined,
  storage?: Storage | null,
  ripeness?: Ripeness | null,
): { warnings: string[]; tips: string[] } {
  const p = resolve(food)?.profile;
  if (!p) return { warnings: [], tips: [] };
  const where = validStorage(food, storage);
  const state = validRipeness(food, ripeness);
  const applies = (c: Cond) => (!c.storage || c.storage === where) && (!c.ripeness || c.ripeness === state);
  const asCond = (t: Tip): Cond => (typeof t === "string" ? { id: t } : t);

  const warnings = (p.warns ?? []).filter(applies).map((c) => c.id);
  const tips = p.tips.map(asCond).filter(applies).map((c) => c.id);
  if (where === "freezer") tips.push("freezeGeneral");
  if (p.care) tips.push("doubt");
  return { warnings: [...new Set(warnings)], tips: [...new Set(tips)] };
}

/** "5 días", "3 semanas", "6 meses", "2 años" como unidad y cantidad (se traduce con `shelf.duration.*`). */
export function durationParts(days: number): { unit: "days" | "weeks" | "months" | "years"; n: number } {
  if (days < 14) return { unit: "days", n: days };
  if (days < 60) return { unit: "weeks", n: Math.round(days / 7) };
  if (days < 700) return { unit: "months", n: Math.round(days / 30) };
  return { unit: "years", n: Math.round(days / 365) };
}

// -----------------------------------------------------------------------------------------------
// Para las pruebas y los scripts
// -----------------------------------------------------------------------------------------------

/** Claves de alimentos del catálogo con perfil propio. */
export function classifiedFoodKeys(): string[] {
  return [...FOOD_PROFILE.keys()];
}

/** Claves repetidas en `MEMBERS` (debe estar vacío). */
export function duplicateFoodKeys(): string[] {
  return DUPLICATE_KEYS;
}

/** Nombre del perfil de un alimento ("rice", "category:meat"…); null si no se reconoce. */
export function profileIdOf(food: ShelfFood | null | undefined): string | null {
  return resolve(food)?.id ?? null;
}

/** Todos los ids de consejos y de avisos que usan los perfiles (para verificar que tengan texto). */
export function allAdviceIds(): { tips: string[]; warnings: string[] } {
  const tips = new Set<string>(["freezeGeneral", "doubt"]);
  const warnings = new Set<string>();
  const profiles = [...Object.values(PROFILES), ...Object.values(CATEGORY_PROFILE)];
  for (const p of profiles) {
    for (const t of p.tips) tips.add(typeof t === "string" ? t : t.id);
    for (const w of p.warns ?? []) warnings.add(w.id);
  }
  return { tips: [...tips], warnings: [...warnings] };
}

/** Todos los perfiles (para verificar su consistencia). */
export function allProfiles(): { id: string; profile: Readonly<Profile> }[] {
  return [
    ...Object.entries(PROFILES).map(([id, profile]) => ({ id, profile })),
    ...Object.entries(CATEGORY_PROFILE).map(([id, profile]) => ({ id: `category:${id}`, profile })),
  ];
}
