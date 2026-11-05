/**
 * Chef IA: lógica pura del planificador (sin llamadas a la IA ni a la base de datos), para poder
 * probarla y usarla tanto en el servidor como en el cliente.
 *
 * - Objetivos y metas de macros del día.
 * - Tarjetas de platos (kcal, macros, ingredientes en casa) a partir de las recetas.
 * - Puntaje de cada plato según el objetivo y las preferencias; mazo para "calibrar tu gusto".
 * - Plan de respaldo sin IA (si la IA no responde) y validación de lo que propone la IA.
 */
import { addDays, daysBetween } from "./dates";
import { mealTypeForSlot } from "./meals";
import { kcalPerServing, macrosPerServing, portionFor, slotShare, type NutritionItem } from "./nutrition";
import type { Suggestion } from "./suggestions";
import { recipeCost, type PriceMap } from "./cost";
import type { Country, MealSlot, Unit } from "./types";

// ───────────────────────────────────────────── Tipos ─────────────────────────────────────────────

export const GOALS = ["lose", "muscle", "maintain", "healthy", "energy"] as const;
export type Goal = (typeof GOALS)[number];

export const SCOPES = ["today", "tomorrow", "week"] as const;
export type Scope = (typeof SCOPES)[number];

export const PREFS = ["pantry", "expiring", "quick", "peruvian", "american", "veggie"] as const;
export type Pref = (typeof PREFS)[number];

export type ChefPrefs = { goal: Goal; scope: Scope; prefs: Pref[]; /** Primer día del plan (YYYY-MM-DD). */ start: string };

/** Un plato tal como se muestra en las tarjetas del Chef. Macros y kcal son por porción de la receta. */
export type DishCard = {
  id: string;
  slug: string;
  name_es: string;
  name_en: string;
  emoji: string | null;
  image_url: string | null;
  country: Country;
  meal_types: string[];
  time: number | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /** Ingredientes obligatorios (sin básicos) que ya hay en casa / total. */
  have: number;
  total: number;
  /** Usa algo que vence en ≤ 3 días. */
  expiring: boolean;
  /** Lleva carne, aves o mariscos. */
  meat: boolean;
  /** Receta nueva inventada por el Chef (vive en el borrador hasta pasarla al calendario). */
  custom?: boolean;
  /** Costo de la receta completa en S/ con los precios de la tienda de la familia; null u omitido = sin precios. */
  cost?: number | null;
  /** Costo por porción en S/. */
  costPerServing?: number | null;
  /** false si a algún ingrediente obligatorio le falta el precio (el costo es aproximado). */
  costComplete?: boolean;
};

/** Ingrediente de una receta inventada por el Chef (siempre un alimento existente). */
export type CustomIngredient = {
  foodId: string;
  name_es: string;
  name_en: string;
  emoji: string | null;
  /** null = "al gusto". */
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
};

/** Receta inventada por el Chef: lo necesario para mostrarla y guardarla en "Recetas". */
export type CustomRecipe = {
  name_es: string;
  name_en: string;
  description: string;
  emoji: string;
  meal_types: ("breakfast" | "lunch" | "dinner" | "snack")[];
  servings: number;
  time_minutes: number | null;
  country: Country;
  ingredients: CustomIngredient[];
  steps: string[];
};

/** Receta nueva con su tarjeta (kcal, macros y lo que hay en casa calculados por la app, no por la IA). */
export type CustomDish = { card: DishCard; recipe: CustomRecipe };

/** Máximo de recetas nuevas guardadas en un borrador. */
export const MAX_CUSTOM = 24;

/** Una comida que ya está en el calendario (lo que el Chef puede proponer cambiar). */
export type CalendarMeal = { id: string; name: string; status: "proposed" | "planned" | "completed" | "cancelled"; seriesId: string | null; recipeId: string | null };

/**
 * Cambio propuesto a una franja que ya tiene comida en el calendario: quitar lo que hay (las comidas
 * `mealIds`, que no estén completadas) y, si `recipeId`, poner ese plato. Se aplica solo al confirmar.
 */
export type CalendarChange = { key: SlotKey; recipeId: string | null; reason?: string; before: string; mealIds: string[] };

/** Cambios al calendario de un mensaje del Chef y si ya se aplicaron. */
export type CalendarProposal = { changes: CalendarChange[]; status: "pending" | "applied" | "dismissed" };

/** Lo que pensó el Chef antes de responder (para mostrarlo plegado bajo su mensaje). */
export type Thinking = { steps: string[]; text: string; ms: number };

/** Clave de una franja de un día en el plan: "2026-10-12|lunch". */
export type SlotKey = `${string}|${MealSlot}`;
export const slotKey = (date: string, slot: MealSlot): SlotKey => `${date}|${slot}`;
export function parseSlotKey(key: string): { date: string; slot: MealSlot } {
  const [date, slot] = key.split("|");
  return { date, slot: slot as MealSlot };
}

export type PlanEntry = { recipeId: string; /** Por qué la IA lo eligió (opcional). */ reason?: string };
export type Plan = Partial<Record<SlotKey, PlanEntry>>;

export type ChatMessage = { role: "user" | "model"; text: string };

/** Página web que el Chef consultó para responder. */
export type Source = { title: string; url: string };

/** Mensaje tal como se muestra (y se guarda en el borrador). */
export type UiMessage = {
  role: "user" | "model";
  text: string;
  /** Respondió el respaldo sin IA (o hubo un error). */
  offline?: boolean;
  /** Fuentes de la web que usó el Chef. */
  sources?: Source[];
  /** Cuántas comidas del plan cambió esta respuesta. */
  changes?: number;
  /** Pasos y razonamiento del Chef en esta respuesta. */
  thinking?: Thinking;
  /** Cambios que propuso a comidas que ya están en el calendario (se confirman). */
  calendar?: CalendarProposal;
  /** Cambios que pidió la IA y no se pudieron aplicar (franja o plato inválido). */
  dropped?: number;
};

/** Contenido de un borrador del Chef (lo que se guarda en `chef_drafts.data`). */
export type DraftData = {
  v: 3;
  prefs: ChefPrefs;
  liked: string[];
  disliked: string[];
  plan: Plan;
  messages: UiMessage[];
  quickReplies: string[];
  /** Recetas inventadas por el Chef en este borrador (por id). */
  custom: Record<string, CustomDish>;
};

/** Resumen de un borrador para la lista lateral. */
export type DraftMeta = { id: string; title: string; updatedAt: string; start: string | null; meals: number };

/** Lo que devuelve el Chef en cada turno (ya validado y con ids de receta). */
export type ChefReply = {
  message: string;
  /** Título corto para el borrador (solo lo propone en la primera respuesta). */
  title?: string;
  /** Páginas de la web que consultó (solo las que de verdad devolvió la búsqueda). */
  sources: Source[];
  quickReplies: string[];
  /** Cambios al plan: poner (recipeId) o quitar (null) un plato de una franja. */
  changes: { key: SlotKey; recipeId: string | null; reason?: string }[];
  /** Alternativas para una franja, para elegir deslizando. */
  alternatives: { key: SlotKey; options: { recipeId: string; reason?: string }[] } | null;
  /** Recetas nuevas que inventó en este turno (las que usa en el plan, el calendario o las alternativas). */
  custom: CustomDish[];
  /** Cambios propuestos a comidas que ya están en el calendario (se aplican al confirmar). */
  calendar: CalendarChange[];
  /** Cambios que pidió la IA y se descartaron por no ser válidos. */
  dropped: number;
  /** true si respondió el plan de respaldo (sin IA). */
  offline?: boolean;
};

// ─────────────────────────────────────────── Metas del día ──────────────────────────────────────

/** Reparto de las kcal del día entre proteína, carbohidratos y grasa según el objetivo. */
export const GOAL_SPLIT: Record<Goal, { protein: number; carbs: number; fat: number }> = {
  lose: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  muscle: { protein: 0.3, carbs: 0.45, fat: 0.25 },
  maintain: { protein: 0.2, carbs: 0.5, fat: 0.3 },
  healthy: { protein: 0.22, carbs: 0.5, fat: 0.28 },
  energy: { protein: 0.18, carbs: 0.57, fat: 0.25 },
};

/** kcal de referencia cuando la persona aún no completó sus datos. */
export const DEFAULT_KCAL = 2000;

export type DayTargets = { kcal: number; protein: number; carbs: number; fat: number; estimated: boolean };

export function dayTargets(kcal: number | null, goal: Goal): DayTargets {
  const k = kcal ?? DEFAULT_KCAL;
  const s = GOAL_SPLIT[goal];
  return {
    kcal: k,
    protein: Math.round((k * s.protein) / 4),
    carbs: Math.round((k * s.carbs) / 4),
    fat: Math.round((k * s.fat) / 9),
    estimated: kcal == null,
  };
}

/** Objetivo sugerido a partir de la meta de peso (los menores nunca "bajan"). */
export function defaultGoal(direction: "lose" | "gain" | "maintain" | null | undefined, minor: boolean): Goal {
  if (minor) return "healthy";
  if (direction === "lose") return "lose";
  if (direction === "gain") return "muscle";
  return "healthy";
}

/** Objetivos que se ofrecen: bajar de peso no se ofrece a menores de 18. */
export const goalsFor = (minor: boolean): Goal[] => (minor ? GOALS.filter((g) => g !== "lose") : [...GOALS]);

/** Fechas que cubre el plan. */
export function scopeDates(scope: Scope, today: string, start?: string): string[] {
  const base = start && start >= today ? start : today;
  const first = scope === "tomorrow" ? addDays(base, 1) : base;
  return Array.from({ length: scope === "week" ? 7 : 1 }, (_, i) => addDays(first, i));
}

/** Hasta dónde se puede planificar (el calendario materializa ~2 semanas). */
export const MAX_DAYS_AHEAD = 20;

// ─────────────────────────────────────────── Tarjetas ───────────────────────────────────────────

type RecipeWithIngredients = Suggestion["recipe"];

/** Tarjeta de un plato a partir de la receta (con ingredientes) y lo que dice `suggest` del inventario. */
export function toCard(s: Suggestion, prices?: PriceMap): DishCard {
  const r: RecipeWithIngredients = s.recipe;
  const items: NutritionItem[] = (r.recipe_ingredients ?? []).map((i) => ({
    quantity: i.quantity,
    unit: i.unit,
    optional: i.optional,
    food: i.food ?? { kcal_100g: null, g_per_unit: null, g_per_ml: null },
  }));
  const m = macrosPerServing(items, r.servings);
  const kcal = r.kcal_per_serving ?? (items.length ? kcalPerServing(items, r.servings).kcal : null);
  const ingredients = (r.recipe_ingredients ?? []).filter((i) => i.food);
  const cost = prices?.size && ingredients.length ? recipeCost(ingredients.map((i) => ({ ...i, food: i.food! })), prices, r.servings) : null;
  return {
    id: r.id,
    slug: r.slug,
    name_es: r.name_es,
    name_en: r.name_en,
    emoji: r.emoji,
    image_url: r.image_url,
    country: r.country,
    meal_types: r.meal_types,
    time: r.time_minutes,
    kcal: kcal && kcal > 0 ? kcal : null,
    protein: m.complete ? m.protein : null,
    carbs: m.complete ? m.carbs : null,
    fat: m.complete ? m.fat : null,
    have: s.have,
    total: s.total,
    expiring: s.expiringUsed > 0,
    meat: (r.recipe_ingredients ?? []).some((i) => !i.optional && (i.food?.category === "meat" || i.food?.category === "seafood")),
    ...(cost && cost.total > 0 ? { cost: round2(cost.total), costPerServing: round2(cost.perServing), costComplete: cost.complete } : {}),
  };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Lo que cuesta cocinar el plan (cada plato una vez, como rinde la receta) en los días dados.
 * `count` son los platos con costo; `complete` es false si alguno no tiene precio o le falta alguno.
 */
export function planCost(plan: Plan, dates: string[], slots: MealSlot[], cards: ReadonlyMap<string, DishCard>) {
  let total = 0;
  let complete = true;
  let count = 0;
  for (const date of dates) {
    for (const slot of slots) {
      const entry = plan[slotKey(date, slot)];
      const card = entry && cards.get(entry.recipeId);
      if (!card) continue;
      if (card.cost == null) {
        complete = false;
        continue;
      }
      total += card.cost;
      complete &&= card.costComplete !== false;
      count++;
    }
  }
  return { total, complete, count };
}

/** Porción de quien mira para un plato en una franja (como en el calendario) y lo que aporta. */
export function myServing(card: DishCard, slot: MealSlot, myKcal: number | null, mealsPerDay: number) {
  const kcalDay = myKcal ?? DEFAULT_KCAL;
  const portion = card.kcal ? portionFor(kcalDay, slotShare(slot, mealsPerDay), card.kcal).portion : 1;
  return {
    portion,
    kcal: Math.round((card.kcal ?? 0) * portion),
    protein: Math.round((card.protein ?? 0) * portion),
    carbs: Math.round((card.carbs ?? 0) * portion),
    fat: Math.round((card.fat ?? 0) * portion),
  };
}

/** Suma de lo que aporta el plan de un día a quien mira. */
export function dayTotals(plan: Plan, date: string, slots: MealSlot[], cards: ReadonlyMap<string, DishCard>, myKcal: number | null, mealsPerDay: number) {
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0, filled: 0 };
  for (const slot of slots) {
    const entry = plan[slotKey(date, slot)];
    const card = entry && cards.get(entry.recipeId);
    if (!card) continue;
    const s = myServing(card, slot, myKcal, mealsPerDay);
    total.kcal += s.kcal;
    total.protein += s.protein;
    total.carbs += s.carbs;
    total.fat += s.fat;
    total.filled++;
  }
  return total;
}

// ──────────────────────────────────────────── Puntaje ───────────────────────────────────────────

/** Encaja con las preferencias "duras" (país, sin carne, rápido). */
export function allowed(card: DishCard, prefs: Pref[]): boolean {
  if (prefs.includes("veggie") && card.meat) return false;
  if (prefs.includes("quick") && (card.time ?? 0) > 40) return false;
  const pe = prefs.includes("peruvian");
  const us = prefs.includes("american");
  if (pe !== us && card.country !== (pe ? "PE" : "US")) return false;
  return true;
}

/**
 * Qué tan bien encaja un plato con el objetivo y las preferencias (más es mejor). Se usa para el mazo
 * de gustos y el plan de respaldo; la IA recibe los mismos datos y decide por su cuenta.
 */
export function scoreCard(card: DishCard, goal: Goal, prefs: Pref[]): number {
  let score = 0;
  const p = card.protein ?? 0;
  const c = card.carbs ?? 0;
  const f = card.fat ?? 0;
  const kcal = p * 4 + c * 4 + f * 9 || card.kcal || 1;
  const share = { protein: (p * 4) / kcal, carbs: (c * 4) / kcal, fat: (f * 9) / kcal };
  const target = GOAL_SPLIT[goal];
  // Cercanía al reparto ideal (0 = idéntico).
  const distance = Math.abs(share.protein - target.protein) + Math.abs(share.carbs - target.carbs) + Math.abs(share.fat - target.fat);
  score += 1.5 - distance * 2;
  if (goal === "lose") score += share.protein - (card.kcal ?? 600) / 1500;
  if (goal === "muscle") score += share.protein * 2 + Math.min(p, 50) / 50;
  if (goal === "energy") score += share.carbs;
  if (goal === "healthy" && share.fat > 0.4) score -= 0.5;

  if (prefs.includes("pantry")) score += card.total ? (card.have / card.total) * 1.5 : 0;
  if (prefs.includes("expiring") && card.expiring) score += 1;
  if (prefs.includes("quick") && card.time) score += (40 - Math.min(card.time, 40)) / 40;
  return score;
}

/** El plato sirve para esa franja (los snacks también valen de desayuno ligero y viceversa). */
export function fitsSlot(card: DishCard, slot: MealSlot): boolean {
  const type = mealTypeForSlot(slot);
  if (card.meal_types.includes(type)) return true;
  if (type === "lunch") return card.meal_types.includes("dinner");
  if (type === "dinner") return card.meal_types.includes("lunch");
  return false;
}

/**
 * Mazo para "calibrar tu gusto": platos variados que encajan con el objetivo, mezclando franjas
 * (de cada tipo de comida los mejores, intercalados) para que en pocos gestos se entienda qué te gusta.
 */
export function tasteDeck(cards: DishCard[], goal: Goal, prefs: Pref[], slots: MealSlot[], size = 12): DishCard[] {
  const ok = cards.filter((c) => allowed(c, prefs));
  const pool = ok.length >= size ? ok : cards;
  const byType = [...new Set(slots.map(mealTypeForSlot))].map((type) =>
    pool.filter((c) => c.meal_types.includes(type)).sort((a, b) => scoreCard(b, goal, prefs) - scoreCard(a, goal, prefs)),
  );
  // Almuerzos y cenas pesan más: aparecen el doble.
  const weights = [...new Set(slots.map(mealTypeForSlot))].map((t) => (t === "lunch" || t === "dinner" ? 2 : 1));
  const out: DishCard[] = [];
  const seen = new Set<string>();
  for (let round = 0; out.length < size && byType.some((l) => l.length); round++) {
    byType.forEach((list, i) => {
      for (let k = 0; k < weights[i] && out.length < size; k++) {
        const next = list.find((c) => !seen.has(c.id));
        if (!next) return;
        seen.add(next.id);
        out.push(next);
      }
    });
    if (round > 50) break;
  }
  return out;
}

// ─────────────────────────────────────── Plan de respaldo ───────────────────────────────────────

/**
 * Plan sin IA: para cada franja libre, el plato que más encaja (los que te gustaron suman, los que
 * descartaste no entran), sin repetir el mismo plato en el día y repitiendo lo menos posible en la semana.
 */
export function fallbackPlan(input: {
  cards: DishCard[];
  dates: string[];
  slots: MealSlot[];
  goal: Goal;
  prefs: Pref[];
  liked: string[];
  disliked: string[];
  /** Franjas que ya tienen comida en el calendario (no se tocan). */
  busy: SlotKey[];
  plan?: Plan;
}): Plan {
  const plan: Plan = { ...(input.plan ?? {}) };
  const disliked = new Set(input.disliked);
  const liked = new Set(input.liked);
  const busy = new Set(input.busy);
  const uses = new Map<string, number>();
  for (const e of Object.values(plan)) if (e) uses.set(e.recipeId, (uses.get(e.recipeId) ?? 0) + 1);

  for (const date of input.dates) {
    const today = new Set<string>();
    for (const slot of input.slots) {
      const key = slotKey(date, slot);
      if (busy.has(key) || plan[key]) {
        if (plan[key]) today.add(plan[key]!.recipeId);
        continue;
      }
      const candidates = input.cards.filter((c) => !disliked.has(c.id) && !today.has(c.id) && fitsSlot(c, slot));
      const strict = candidates.filter((c) => allowed(c, input.prefs));
      const pool = strict.length ? strict : candidates;
      const best = pool
        .map((c) => ({ c, s: scoreCard(c, input.goal, input.prefs) + (liked.has(c.id) ? 1.5 : 0) - (uses.get(c.id) ?? 0) * 1.2 }))
        .sort((a, b) => b.s - a.s)[0]?.c;
      if (!best) continue;
      plan[key] = { recipeId: best.id };
      today.add(best.id);
      uses.set(best.id, (uses.get(best.id) ?? 0) + 1);
    }
  }
  return plan;
}

/** Alternativas para una franja sin IA: los mejores platos que no están ya en ese día. */
export function fallbackAlternatives(cards: DishCard[], plan: Plan, key: SlotKey, goal: Goal, prefs: Pref[], disliked: string[], n = 5) {
  const { date, slot } = parseSlotKey(key);
  const inDay = new Set(Object.entries(plan).filter(([k]) => k.startsWith(`${date}|`)).map(([, e]) => e!.recipeId));
  const no = new Set(disliked);
  return cards
    .filter((c) => fitsSlot(c, slot) && !inDay.has(c.id) && !no.has(c.id) && allowed(c, prefs))
    .sort((a, b) => scoreCard(b, goal, prefs) - scoreCard(a, goal, prefs))
    .slice(0, n)
    .map((c) => ({ recipeId: c.id }));
}

// ─────────────────────────────────────── Validación de la IA ────────────────────────────────────

/** Nombres de franja que a veces devuelve la IA en vez de la clave. */
const SLOT_ALIASES: Record<string, MealSlot> = {
  desayuno: "breakfast", almuerzo: "lunch", cena: "dinner", comida: "lunch",
  "media manana": "morning_snack", "media tarde": "afternoon_snack", "morning snack": "morning_snack", "afternoon snack": "afternoon_snack",
};

export type RawReply = {
  message?: string;
  title?: string | null;
  /** URLs que la IA dice haber usado; solo se aceptan las que devolvió la búsqueda. */
  sources?: string[] | null;
  quick_replies?: string[];
  plan?: { date: string; slot: string; slug: string; reason?: string | null }[];
  remove?: { date: string; slot: string }[];
  alternatives?: { date: string; slot: string; options: { slug: string; reason?: string | null }[] } | null;
  /** Cambios a comidas que ya están en el calendario (slug null o vacío = quitar). */
  calendar?: { date: string; slot: string; slug?: string | null; reason?: string | null }[] | null;
  /** Recetas que inventa la IA (se validan y se arman en src/lib/chef-custom.ts). */
  new_recipes?: RawNewRecipe[] | null;
};

/** Receta nueva tal como la propone la IA (sin validar). */
export type RawNewRecipe = {
  ref?: string | null;
  name_es?: string | null;
  name_en?: string | null;
  description?: string | null;
  emoji?: string | null;
  meal_types?: string[] | null;
  servings?: number | null;
  time_minutes?: number | null;
  country?: string | null;
  ingredients?: { food?: string | null; quantity?: number | null; unit?: string | null; optional?: boolean | null }[] | null;
  steps?: string[] | null;
};

/**
 * Convierte la respuesta de la IA en cambios seguros: solo recetas que el usuario puede ver, fechas
 * dentro del rango permitido, franjas de la familia y nunca franjas que ya tienen comida.
 */
export function sanitizeReply(
  raw: RawReply,
  ctx: {
    cards: ReadonlyMap<string, DishCard>;
    slots: MealSlot[];
    dates: ReadonlySet<string>;
    busy: ReadonlySet<string>;
    /** Comidas de cada franja ocupada (para proponer cambios al calendario). Sin esto, no se proponen. */
    calendar?: ReadonlyMap<string, CalendarMeal[]>;
    /** Recetas que la IA inventó en este turno (ya validadas), con la referencia que les puso. */
    newDishes?: { ref: string; dish: CustomDish }[];
  },
  /** Resultados de la búsqueda web de este turno (las fuentes se toman solo de aquí). */
  searched: Source[] = [],
): ChefReply {
  // Los modelos a veces cambian mayúsculas, ponen el nombre del plato en vez del slug o agregan espacios.
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const lookup = new Map<string, DishCard>();
  for (const c of ctx.cards.values()) for (const k of [c.name_en, c.name_es, c.slug]) lookup.set(norm(k), c);
  // Las recetas nuevas de este turno ganan si el nombre coincide con otra (es la que la IA acaba de crear).
  const fresh = new Map<string, CustomDish>();
  for (const { ref, dish } of ctx.newDishes ?? []) {
    fresh.set(dish.card.id, dish);
    for (const k of [dish.card.name_en, dish.card.name_es, dish.card.slug, ref]) if (k) lookup.set(norm(k), dish.card);
  }
  const bySlug = { get: (slug: string | null | undefined) => (typeof slug === "string" ? lookup.get(norm(slug)) : undefined) };
  /**
   * Clave de una franja (o null si no es válida): una del plan, o una que ya tiene comida en el
   * calendario aunque esté fuera de los días del plan (se pueden cambiar las próximas semanas).
   */
  const anyKey = (date: string, rawSlot: string): SlotKey | null => {
    const slot = SLOT_ALIASES[norm(rawSlot ?? "")] ?? norm(rawSlot ?? "");
    date = (date ?? "").trim().slice(0, 10);
    if (!ctx.slots.includes(slot as MealSlot)) return null;
    const key = slotKey(date, slot as MealSlot);
    return ctx.dates.has(date) || ctx.calendar?.has(key) ? key : null;
  };
  /** Franja libre del plan (las ocupadas en el calendario van por `calendar`). */
  const validKey = (date: string, rawSlot: string): SlotKey | null => {
    const key = anyKey(date, rawSlot);
    return key && ctx.dates.has(parseSlotKey(key).date) && !ctx.busy.has(key) ? key : null;
  };
  /** Comidas que se pueden cambiar en una franja ocupada (las completadas no se tocan). */
  const editable = (key: SlotKey) => (ctx.calendar?.get(key) ?? []).filter((m) => m.status !== "completed" && m.status !== "cancelled");
  const clip = (s: string | null | undefined, n: number) => (s ?? "").trim().slice(0, n) || undefined;

  const changes: ChefReply["changes"] = [];
  const calendar: CalendarChange[] = [];
  const touched = new Set<string>();
  let dropped = 0;
  /** Cambio a una franja que ya tiene comida: se propone para confirmar (si hay algo que se pueda cambiar). */
  const toCalendar = (key: SlotKey, recipeId: string | null, reason?: string) => {
    const meals = editable(key);
    // Nada que cambiar, o ya está ese mismo plato: no es un cambio.
    if (!meals.length || (recipeId && meals.length === 1 && meals[0].recipeId === recipeId)) return false;
    calendar.push({ key, recipeId, reason, before: meals.map((m) => m.name).join(", "), mealIds: meals.map((m) => m.id) });
    return true;
  };

  for (const p of raw.plan ?? []) {
    const key = anyKey(p.date, p.slot);
    const card = bySlug.get(p.slug);
    if (!key || !card) {
      dropped++;
      continue;
    }
    if (touched.has(key)) continue;
    touched.add(key);
    if (!ctx.busy.has(key)) changes.push({ key, recipeId: card.id, reason: clip(p.reason, 160) });
    // La IA a veces pone en "plan" franjas que ya están en el calendario: se proponen como cambio.
    else if (!toCalendar(key, card.id, clip(p.reason, 160))) dropped++;
  }
  for (const r of raw.calendar ?? []) {
    const key = anyKey(r.date, r.slot);
    const wantsDish = typeof r.slug === "string" && r.slug.trim() !== "";
    const card = wantsDish ? bySlug.get(r.slug) : undefined;
    if (!key || (wantsDish && !card)) {
      dropped++;
      continue;
    }
    if (touched.has(key)) continue;
    touched.add(key);
    if (!ctx.busy.has(key)) {
      // Franja libre: es un cambio normal del plan.
      if (card) changes.push({ key, recipeId: card.id, reason: clip(r.reason, 160) });
    } else if (!toCalendar(key, card?.id ?? null, clip(r.reason, 160))) dropped++;
  }
  for (const r of raw.remove ?? []) {
    const key = anyKey(r.date, r.slot);
    if (!key) continue;
    if (touched.has(key)) continue;
    touched.add(key);
    if (!ctx.busy.has(key)) changes.push({ key, recipeId: null });
    else toCalendar(key, null);
  }

  let alternatives: ChefReply["alternatives"] = null;
  if (raw.alternatives) {
    const key = validKey(raw.alternatives.date, raw.alternatives.slot);
    const seen = new Set<string>();
    const options = (raw.alternatives.options ?? [])
      .map((o) => ({ card: bySlug.get(o.slug), reason: clip(o.reason, 160) }))
      .filter((o): o is { card: DishCard; reason: string | undefined } => !!o.card && !seen.has(o.card.id) && !!seen.add(o.card.id))
      .slice(0, 6)
      .map((o) => ({ recipeId: o.card.id, reason: o.reason }));
    if (key && options.length) alternatives = { key, options };
  }

  // Fuentes: las que la IA citó (si estaban en la búsqueda); si no citó ninguna, las primeras encontradas.
  const found = new Map(searched.map((r) => [r.url, r]));
  const cited = [...new Set(raw.sources ?? [])].map((u) => found.get(u)).filter((r): r is Source => !!r);
  const sources = (cited.length ? cited : searched).slice(0, 4);

  // Solo se devuelven las recetas nuevas que quedaron en el plan, el calendario o las alternativas.
  const used = new Set([
    ...changes.map((c) => c.recipeId),
    ...calendar.map((c) => c.recipeId),
    ...(alternatives?.options ?? []).map((o) => o.recipeId),
  ]);
  const custom = [...fresh.values()].filter((d) => used.has(d.card.id));

  return {
    message: clip(raw.message, 2400) ?? "",
    title: clip(raw.title, 60),
    sources,
    quickReplies: (raw.quick_replies ?? []).map((q) => q.trim().slice(0, 60)).filter(Boolean).slice(0, 4),
    changes,
    alternatives,
    custom,
    calendar,
    dropped,
  };
}

// ──────────────────────────────────────── Copiar y pegar ────────────────────────────────────────

/** Lo copiado: un plato suelto o las comidas de un día (por franja). */
export type MealClip = { kind: "meal"; recipeId: string } | { kind: "day"; meals: Partial<Record<MealSlot, string>> };

/** Copia las comidas de un día del plan (null si el día está vacío). */
export function copyDay(plan: Plan, date: string, slots: MealSlot[]): MealClip | null {
  const meals: Partial<Record<MealSlot, string>> = {};
  for (const slot of slots) {
    const entry = plan[slotKey(date, slot)];
    if (entry) meals[slot] = entry.recipeId;
  }
  return Object.keys(meals).length ? { kind: "day", meals } : null;
}

/**
 * Pega lo copiado en el plan. Un plato va a una franja (`targets` = [clave]); un día se pega en cada
 * fecha de `targets` (franja por franja). Nunca toca franjas ocupadas en el calendario ni franjas que
 * la familia no usa, y solo pega recetas que existen (`known`).
 */
export function pasteClip(
  plan: Plan,
  clip: MealClip,
  targets: string[],
  opts: { slots: MealSlot[]; busy: { has(key: string): boolean }; known: (recipeId: string) => boolean },
): { plan: Plan; changed: SlotKey[] } {
  const next: Plan = { ...plan };
  const changed: SlotKey[] = [];
  const put = (key: SlotKey, recipeId: string) => {
    if (opts.busy.has(key) || !opts.known(recipeId) || !opts.slots.includes(parseSlotKey(key).slot)) return;
    if (next[key]?.recipeId === recipeId) return;
    next[key] = { recipeId };
    changed.push(key);
  };
  if (clip.kind === "meal") {
    for (const key of targets) put(key as SlotKey, clip.recipeId);
  } else {
    for (const date of targets) {
      for (const slot of opts.slots) {
        const id = clip.meals[slot];
        if (id) put(slotKey(date, slot), id);
      }
    }
  }
  return { plan: next, changed };
}

/** Mueve todas las fechas del plan `shift` días (para reusar un borrador viejo desde hoy). */
export function shiftPlan(plan: Plan, shift: number): Plan {
  if (!shift) return plan;
  const out: Plan = {};
  for (const [key, entry] of Object.entries(plan)) {
    if (!entry) continue;
    const { date, slot } = parseSlotKey(key);
    out[slotKey(addDays(date, shift), slot)] = entry;
  }
  return out;
}

/**
 * Un borrador cuyo primer día ya pasó se reusa desde hoy: se corren el inicio y todas las fechas del
 * plan. Devuelve el mismo objeto si no hace falta moverlo.
 */
export function rebaseDraft(data: DraftData, today: string): { data: DraftData; shifted: number } {
  const shift = data.prefs.start < today ? daysBetween(data.prefs.start, today) : 0;
  if (!shift) return { data, shifted: 0 };
  return { data: { ...data, prefs: { ...data.prefs, start: today }, plan: shiftPlan(data.plan, shift) }, shifted: shift };
}

/** El plan como texto plano (para copiarlo y pegarlo en otra app, ej. WhatsApp). */
export function planToText(
  plan: Plan,
  dates: string[],
  slots: MealSlot[],
  labels: { day: (date: string) => string; slot: (slot: MealSlot) => string; dish: (recipeId: string) => string | null },
): string {
  const blocks: string[] = [];
  for (const date of dates) {
    const lines = slots.flatMap((slot) => {
      const entry = plan[slotKey(date, slot)];
      const name = entry && labels.dish(entry.recipeId);
      return name ? [`• ${labels.slot(slot)}: ${name}`] : [];
    });
    if (lines.length) blocks.push([labels.day(date), ...lines].join("\n"));
  }
  return blocks.join("\n\n");
}

/** Borradores guardados antes de las recetas nuevas (v2): se leen como v3 sin recetas nuevas. */
export function migrateDraft(raw: unknown): unknown {
  if (raw && typeof raw === "object" && (raw as { v?: unknown }).v === 2) return { ...raw, v: 3, custom: {} };
  return raw;
}

/**
 * Qué hacer en el calendario al confirmar los cambios del Chef. Por franja: las comidas sueltas se
 * borran, las de una comida que se repite se cancelan solo ese día (la serie sigue) y, si hay plato
 * nuevo, se agrega. Si las comidas de la franja ya no son las mismas que cuando se propuso (alguien
 * cambió el calendario), esa franja se salta. Las completadas nunca se tocan.
 */
export function calendarOps(changes: CalendarChange[], now: ReadonlyMap<string, CalendarMeal[]>) {
  const remove: string[] = [];
  const cancel: string[] = [];
  const insert: { key: SlotKey; recipeId: string }[] = [];
  const skipped: SlotKey[] = [];
  const seen = new Set<string>();
  for (const c of changes) {
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    const meals = (now.get(c.key) ?? []).filter((m) => m.status !== "completed" && m.status !== "cancelled");
    const same = meals.length === c.mealIds.length && meals.every((m) => c.mealIds.includes(m.id));
    if (!same || (!meals.length && !c.recipeId)) {
      skipped.push(c.key);
      continue;
    }
    for (const m of meals) (m.seriesId ? cancel : remove).push(m.id);
    if (c.recipeId) insert.push({ key: c.key, recipeId: c.recipeId });
  }
  return { remove, cancel, insert, skipped };
}
