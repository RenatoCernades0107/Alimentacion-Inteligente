"use server";

import { revalidatePath } from "next/cache";
import { requireParent } from "@/lib/session";
import { addDays, isValidDate, todayIn } from "@/lib/dates";
import { UNITS } from "@/lib/units";
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
};

function cleanUnit(u: string): Unit {
  return (UNITS as string[]).includes(u) ? (u as Unit) : "unit";
}

export async function addInventoryItem(input: NewItem) {
  const { supabase, family, user } = await requireParent();
  if (!input.food_id && !input.product_name) throw new Error("invalid");

  let expires_on = isValidDate(input.expires_on) ? input.expires_on : null;
  let expiry_estimated = false;

  // Genéricos sin fecha: se estima según la vida útil del alimento.
  if (!expires_on && input.food_id && !input.barcode) {
    const { data: food } = await supabase.from("foods").select("shelf_life_days").eq("id", input.food_id).single();
    if (food?.shelf_life_days) {
      expires_on = addDays(todayIn(family.timezone), food.shelf_life_days);
      expiry_estimated = true;
    }
  }

  const { error } = await supabase.from("inventory_items").insert({
    family_id: family.id,
    food_id: input.food_id || null,
    barcode: input.barcode || null,
    product_name: input.product_name?.slice(0, 120) || null,
    brand: input.brand?.slice(0, 80) || null,
    image_url: input.image_url || null,
    quantity: Math.max(0, Number(input.quantity) || 0),
    unit: cleanUnit(input.unit),
    expires_on,
    expiry_estimated,
    created_by: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function updateInventoryItem(id: string, input: { quantity: number; unit: Unit; expires_on: string | null }) {
  const { supabase } = await requireParent();
  const { error } = await supabase
    .from("inventory_items")
    .update({
      quantity: Math.max(0, Number(input.quantity) || 0),
      unit: cleanUnit(input.unit),
      expires_on: isValidDate(input.expires_on) ? input.expires_on : null,
      expiry_estimated: false,
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
export async function createCustomFood(input: { name: string; emoji?: string; default_unit: Unit; shelf_life_days?: number | null }) {
  const { supabase, family, user } = await requireParent();
  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("invalid");
  const { data, error } = await supabase
    .from("foods")
    .insert({
      family_id: family.id,
      name_es: name,
      name_en: name,
      category: "custom",
      emoji: input.emoji?.slice(0, 8) || "🍽️",
      default_unit: cleanUnit(input.default_unit),
      shelf_life_days: input.shelf_life_days && input.shelf_life_days > 0 ? Math.round(input.shelf_life_days) : null,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
