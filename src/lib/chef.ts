/**
 * Chef IA: lógica pura del planificador (sin llamadas a la IA ni a la base de datos), para poder
 * probarla y usarla tanto en el servidor como en el cliente.
 *
 * - Objetivos y metas de macros del día.
 * - Tarjetas de platos (kcal, macros, ingredientes en casa) a partir de las recetas.
 * - Puntaje de cada plato según el objetivo y las preferencias; mazo para "calibrar tu gusto".
 * - Plan de respaldo sin IA (si Gemini no responde) y validación de lo que propone la IA.
 */
import { addDays } from "./dates";
import { mealTypeForSlot } from "./meals";
import { kcalPerServing, macrosPerServing, portionFor, slotShare, type NutritionItem } from "./nutrition";
import type { Suggestion } from "./suggestions";
import type { Country, MealSlot } from "./types";

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
};

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

/** Lo que devuelve el Chef en cada turno (ya validado y con ids de receta). */
export type ChefReply = {
  message: string;
  quickReplies: string[];
  /** Cambios al plan: poner (recipeId) o quitar (null) un plato de una franja. */
  changes: { key: SlotKey; recipeId: string | null; reason?: string }[];
  /** Alternativas para una franja, para elegir deslizando. */
  alternatives: { key: SlotKey; options: { recipeId: string; reason?: string }[] } | null;
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
export function toCard(s: Suggestion): DishCard {
  const r: RecipeWithIngredients = s.recipe;
  const items: NutritionItem[] = (r.recipe_ingredients ?? []).map((i) => ({
    quantity: i.quantity,
    unit: i.unit,
    optional: i.optional,
    food: i.food ?? { kcal_100g: null, g_per_unit: null, g_per_ml: null },
  }));
  const m = macrosPerServing(items, r.servings);
  const kcal = r.kcal_per_serving ?? (items.length ? kcalPerServing(items, r.servings).kcal : null);
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
  };
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

export type RawReply = {
  message?: string;
  quick_replies?: string[];
  plan?: { date: string; slot: string; slug: string; reason?: string | null }[];
  remove?: { date: string; slot: string }[];
  alternatives?: { date: string; slot: string; options: { slug: string; reason?: string | null }[] } | null;
};

/**
 * Convierte la respuesta de la IA en cambios seguros: solo recetas que el usuario puede ver, fechas
 * dentro del rango permitido, franjas de la familia y nunca franjas que ya tienen comida.
 */
export function sanitizeReply(
  raw: RawReply,
  ctx: { cards: ReadonlyMap<string, DishCard>; slots: MealSlot[]; dates: ReadonlySet<string>; busy: ReadonlySet<string> },
): ChefReply {
  const bySlug = new Map([...ctx.cards.values()].map((c) => [c.slug, c]));
  const validKey = (date: string, slot: string): SlotKey | null => {
    if (!ctx.dates.has(date) || !ctx.slots.includes(slot as MealSlot)) return null;
    const key = slotKey(date, slot as MealSlot);
    return ctx.busy.has(key) ? null : key;
  };
  const clip = (s: string | null | undefined, n: number) => (s ?? "").trim().slice(0, n) || undefined;

  const changes: ChefReply["changes"] = [];
  const touched = new Set<string>();
  for (const p of raw.plan ?? []) {
    const key = validKey(p.date, p.slot);
    const card = bySlug.get(p.slug);
    if (!key || !card || touched.has(key)) continue;
    touched.add(key);
    changes.push({ key, recipeId: card.id, reason: clip(p.reason, 160) });
  }
  for (const r of raw.remove ?? []) {
    const key = validKey(r.date, r.slot);
    if (!key || touched.has(key)) continue;
    touched.add(key);
    changes.push({ key, recipeId: null });
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

  return {
    message: clip(raw.message, 1200) ?? "",
    quickReplies: (raw.quick_replies ?? []).map((q) => q.trim().slice(0, 60)).filter(Boolean).slice(0, 4),
    changes,
    alternatives,
  };
}
