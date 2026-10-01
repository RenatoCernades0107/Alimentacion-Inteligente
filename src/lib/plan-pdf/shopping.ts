import { convert } from "@/lib/units";
import type { Unit } from "@/lib/types";

/** Lo que se puede sumar entre sí: unidades, gramos (g/kg) o mililitros (ml/l). */
export type Dimension = "count" | "mass" | "volume";
/** Cantidad en la unidad base de su dimensión (unid., g o ml). */
export type Amount = { dim: Dimension; value: number };

const BASE_UNIT: Record<Dimension, Unit> = { count: "unit", mass: "g", volume: "ml" };
const EPS = 1e-6;

export function dimensionOf(unit: Unit): Dimension {
  return unit === "g" || unit === "kg" ? "mass" : unit === "ml" || unit === "l" ? "volume" : "count";
}

export function toAmount(quantity: number, unit: Unit): Amount {
  const dim = dimensionOf(unit);
  return { dim, value: convert(quantity, unit, BASE_UNIT[dim]) ?? quantity };
}

const trim = (n: number) => String(+n.toFixed(2));

/** "1 ½", "¾", "3" — las mitades y cuartos se leen mejor así que como decimales. */
function formatCount(v: number) {
  const whole = Math.floor(v + 0.01);
  const frac = v - whole;
  if (Math.abs(frac) < 0.01) return String(whole);
  const glyph = ([[0.25, "¼"], [0.5, "½"], [0.75, "¾"]] as const).find(([x]) => Math.abs(frac - x) < 0.01)?.[1];
  if (glyph) return whole ? `${whole} ${glyph}` : glyph;
  return trim(v);
}

/** "800 g", "1.5 kg", "250 ml", "2 unid." — pasa a kg / L desde los 1000. */
export function formatAmount(a: Amount, label: (u: Unit) => string) {
  if (a.dim === "count") return `${formatCount(a.value)} ${label("unit")}`;
  const [small, big]: [Unit, Unit] = a.dim === "mass" ? ["g", "kg"] : ["ml", "l"];
  if (a.value >= 1000) return `${trim(a.value / 1000)} ${label(big)}`;
  return `${a.value >= 10 ? Math.round(a.value) : +a.value.toFixed(1)} ${label(small)}`;
}

/** Cantidad de un ingrediente tal como se muestra en la receta (0.8 kg → "800 g"). */
export function formatQuantityUnit(quantity: number, unit: Unit, label: (u: Unit) => string) {
  return formatAmount(toAmount(quantity, unit), label);
}

/** Lo que hay que comprar se redondea hacia arriba: no se compra media cebolla ni 733.3 g. */
function roundUp(a: Amount): Amount {
  return { dim: a.dim, value: Math.ceil(a.value - EPS) };
}

/** Un ingrediente de una comida planificada. */
export type Need = {
  foodId: string;
  name: string;
  category: string;
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
  /** Nombre de la comida que lo usa. */
  meal: string;
};

export type StockRow = { food_id: string | null; quantity: number; unit: Unit };

export type ShoppingStatus = "buy" | "covered" | "basic";

export type ShoppingEntry = {
  foodId: string;
  name: string;
  category: string;
  status: ShoppingStatus;
  /** Lo que piden las comidas, sumado por dimensión. Vacío si es "al gusto". */
  needed: Amount[];
  /** Lo que hay en el inventario en esas mismas dimensiones. */
  have: Amount[];
  /** Inventario en otra dimensión (ej. pide unidades y hay gramos): no se puede restar. */
  elsewhere: Amount[];
  /** Lo que falta comprar, ya redondeado hacia arriba. */
  buy: Amount[];
  /** Ninguna comida indica cantidad. */
  toTaste: boolean;
  /** Solo se usa como ingrediente opcional. */
  optional: boolean;
  /** Comidas que lo usan, sin repetir y en orden cronológico. */
  meals: string[];
};

/** Orden de las secciones, siguiendo el recorrido habitual del supermercado. */
export const CATEGORY_ORDER = ["produce", "fruit", "meat", "seafood", "dairy", "grains", "legumes", "pantry", "spices", "nuts", "frozen", "snacks", "beverages", "other"] as const;

/** Los básicos (sal, aceite…) se asumen en casa, igual que en las sugerencias de recetas. */
const BASICS = "basics";

export function categoryOf(category: string) {
  return (CATEGORY_ORDER as readonly string[]).includes(category) ? category : "other";
}

function sumByDimension(amounts: Amount[]) {
  const out = new Map<Dimension, number>();
  for (const a of amounts) out.set(a.dim, (out.get(a.dim) ?? 0) + a.value);
  return out;
}

/**
 * Suma los ingredientes de las comidas (en orden cronológico), descuenta lo que hay en el
 * inventario y devuelve una entrada por alimento, ordenada por sección y nombre.
 */
export function buildShoppingList(needs: Need[], stock: StockRow[], locale: string): ShoppingEntry[] {
  const stockByFood = new Map<string, Amount[]>();
  for (const row of stock) {
    if (!row.food_id || !(row.quantity > 0)) continue;
    stockByFood.set(row.food_id, [...(stockByFood.get(row.food_id) ?? []), toAmount(row.quantity, row.unit)]);
  }

  const byFood = new Map<string, Need[]>();
  for (const n of needs) byFood.set(n.foodId, [...(byFood.get(n.foodId) ?? []), n]);

  const entries: ShoppingEntry[] = [];
  for (const [foodId, list] of byFood) {
    const first = list[0];
    const neededByDim = sumByDimension(list.flatMap((n) => (n.quantity && n.unit ? [toAmount(n.quantity, n.unit)] : [])));
    const stockByDim = sumByDimension(stockByFood.get(foodId) ?? []);

    const needed: Amount[] = [];
    const have: Amount[] = [];
    const buy: Amount[] = [];
    for (const [dim, value] of neededByDim) {
      needed.push({ dim, value });
      const owned = stockByDim.get(dim) ?? 0;
      if (owned > 0) have.push({ dim, value: owned });
      if (value - owned > EPS) buy.push(roundUp({ dim, value: value - owned }));
    }
    const elsewhere = [...stockByDim].filter(([dim]) => !neededByDim.has(dim)).map(([dim, value]) => ({ dim, value }));

    const toTaste = neededByDim.size === 0;
    const covered = toTaste ? stockByDim.size > 0 : buy.length === 0;
    entries.push({
      foodId,
      name: first.name,
      category: first.category === BASICS ? BASICS : categoryOf(first.category),
      status: first.category === BASICS ? "basic" : covered ? "covered" : "buy",
      needed,
      have,
      elsewhere,
      buy,
      toTaste,
      optional: list.every((n) => n.optional),
      meals: [...new Set(list.map((n) => n.meal))],
    });
  }

  const order = (e: ShoppingEntry) => (e.status === "basic" ? CATEGORY_ORDER.length : CATEGORY_ORDER.indexOf(e.category as (typeof CATEGORY_ORDER)[number]));
  return entries.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, locale, { sensitivity: "base" }));
}
