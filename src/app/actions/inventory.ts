"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireParent } from "@/lib/session";
import { isValidDate, todayIn } from "@/lib/dates";
import { UNITS } from "@/lib/units";
import { predictExpiry, RIPENESSES, STORAGES, validRipeness, validStorage, type Ripeness, type ShelfFood, type Storage } from "@/lib/shelf-life";
import type { Unit } from "@/lib/types";

export type NewItem = {
  food_id?: string | null;
  barcode?: string | null;
  product_name?: string | null;
  brand?: string | null;
  image_url?: string | null;
  quantity: number;
  unit: Unit;
  expires_on?: string | null;
  /** Dónde se guarda; si no corresponde a ese alimento, se usa el recomendado. */
  storage?: Storage | null;
  /** Madurez de la fruta que madura después de cosechada. */
  ripeness?: Ripeness | null;
};

function cleanUnit(u: string): Unit {
  return (UNITS as string[]).includes(u) ? (u as Unit) : "unit";
}

// Lo que llega del cliente no es de fiar: un valor desconocido cuenta como "sin dato".
const StorageSchema = z.enum(STORAGES).nullish().catch(null);
const RipenessSchema = z.enum(RIPENESSES).nullish().catch(null);

type Session = Awaited<ReturnType<typeof requireParent>>;

const SHELF_FOOD_FIELDS = "key, category, name_es, name_en, shelf_life_days";

/** Lo que hace falta de un alimento para estimar su vida útil. */
async function loadShelfFood(supabase: Session["supabase"], foodId: string | null | undefined): Promise<ShelfFood | null> {
  if (!foodId) return null;
  const { data } = await supabase.from("foods").select(SHELF_FOOD_FIELDS).eq("id", foodId).single();
  return (data as ShelfFood | null) ?? null;
}

/**
 * Fila de inventario lista para insertar. La fecha escrita (o impresa en el empaque) se respeta; sin fecha, se
 * estima según el alimento, dónde se guarda y su madurez (src/lib/shelf-life.ts).
 */
async function buildRow({ supabase, family, user }: Session, input: NewItem) {
  if (!input.food_id && !input.product_name) throw new Error("invalid");

  const food = await loadShelfFood(supabase, input.food_id);
  const prediction = predictExpiry({
    food,
    storage: StorageSchema.parse(input.storage),
    ripeness: RipenessSchema.parse(input.ripeness),
    from: todayIn(family.timezone),
    printedDate: isValidDate(input.expires_on) ? input.expires_on : null,
  });

  return {
    family_id: family.id,
    food_id: input.food_id || null,
    barcode: input.barcode || null,
    product_name: input.product_name?.slice(0, 120) || null,
    brand: input.brand?.slice(0, 80) || null,
    image_url: input.image_url || null,
    quantity: Math.max(0, Number(input.quantity) || 0),
    unit: cleanUnit(input.unit),
    expires_on: prediction.expiresOn,
    expiry_estimated: prediction.expiresOn !== null && prediction.estimated,
    storage: prediction.storage,
    ripeness: prediction.ripeness,
    created_by: user.id,
  };
}

export async function addInventoryItem(input: NewItem) {
  const session = await requireParent();
  const { error } = await session.supabase.from("inventory_items").insert(await buildRow(session, input));
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/**
 * `kcal` es opcional: por unidad si la unidad del alimento es "unid.", y por 100 g (o 100 ml) en los demás casos.
 */
export type NewFood = { name: string; emoji?: string; default_unit: Unit; shelf_life_days?: number | null; kcal?: number | null };

/** Agrega varios alimentos de una vez (foto o boleta); los que no existen se crean como propios. */
export async function addInventoryItems(items: (NewItem & { new_food?: NewFood | null })[]) {
  const session = await requireParent();
  if (!items.length || items.length > 100) throw new Error("invalid");
  const rows = [];
  for (const item of items) {
    const food_id = item.new_food ? (await insertCustomFood(session, item.new_food)).id : item.food_id;
    rows.push(await buildRow(session, { ...item, food_id }));
  }
  const { error } = await session.supabase.from("inventory_items").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  return rows.length;
}

export type ItemEdit = {
  quantity: number;
  unit: Unit;
  expires_on: string | null;
  /** true si la fecha la calculó la app (y no la escribió el usuario ni viene del empaque). */
  expiry_estimated?: boolean;
  /** Dónde se guarda ahora ("lo pasé al congelador"); sin este campo no se toca. */
  storage?: Storage | null;
  ripeness?: Ripeness | null;
};

export async function updateInventoryItem(id: string, input: ItemEdit) {
  const { supabase } = await requireParent();
  const expires_on = isValidDate(input.expires_on) ? input.expires_on : null;

  // Lugar y madurez se validan contra el alimento del ítem (RLS deja leer solo los de la familia).
  const patch: { storage?: Storage | null; ripeness?: Ripeness | null } = {};
  if (input.storage !== undefined || input.ripeness !== undefined) {
    const { data } = await supabase.from("inventory_items").select(`food:foods(${SHELF_FOOD_FIELDS})`).eq("id", id).single();
    const food = ((data as { food: ShelfFood | null } | null)?.food ?? null) as ShelfFood | null;
    if (input.storage !== undefined) patch.storage = validStorage(food, StorageSchema.parse(input.storage));
    if (input.ripeness !== undefined) patch.ripeness = validRipeness(food, RipenessSchema.parse(input.ripeness));
  }

  const { error } = await supabase
    .from("inventory_items")
    .update({
      quantity: Math.max(0, Number(input.quantity) || 0),
      unit: cleanUnit(input.unit),
      expires_on,
      expiry_estimated: expires_on !== null && input.expiry_estimated === true,
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function deleteInventoryItem(id: string) {
  const { supabase } = await requireParent();
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/** Crea un alimento propio de la familia (ej. "salsa de tamarindo con miel picante"). */
export async function createCustomFood(input: NewFood) {
  return insertCustomFood(await requireParent(), input);
}

async function insertCustomFood({ supabase, family, user }: Session, input: NewFood) {
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("invalid");
  const unit = cleanUnit(input.default_unit);
  const kcal = input.kcal == null ? null : Number(input.kcal);
  if (kcal !== null && !(Number.isFinite(kcal) && kcal >= 0 && kcal <= 1000)) throw new Error("invalid");
  const { data, error } = await supabase
    .from("foods")
    .insert({
      family_id: family.id,
      name_es: name,
      name_en: name,
      category: "custom",
      emoji: input.emoji?.slice(0, 8) || "🍽️",
      default_unit: unit,
      shelf_life_days: input.shelf_life_days && input.shelf_life_days > 0 ? Math.round(input.shelf_life_days) : null,
      // Por unidad: se guarda "1 unidad = 100 g" para que kcal_100g sea justo las kcal de una unidad.
      kcal_100g: kcal,
      g_per_unit: kcal !== null && unit === "unit" ? 100 : null,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
