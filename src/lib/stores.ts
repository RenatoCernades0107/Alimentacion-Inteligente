import type { OffProduct } from "./off";
import type { Unit } from "./types";

export type StoreId = "plazavea" | "wong" | "tottus" | "tambo";

export const STORES: Record<StoreId, { name: string; className: string }> = {
  plazavea: { name: "Plaza Vea", className: "bg-red-100 text-red-700" },
  wong: { name: "Wong", className: "bg-rose-100 text-rose-800" },
  tottus: { name: "Tottus", className: "bg-green-100 text-green-800" },
  tambo: { name: "Tambo", className: "bg-purple-100 text-purple-800" },
};

/** Fila de la tabla store_products. */
export type StoreProduct = {
  id: string;
  name: string;
  brand: string | null;
  barcodes: string[];
  quantity: number | null;
  unit: Unit | null;
  pack: number;
  image_url: string | null;
  food_id: string | null;
  stores: StoreId[];
};

/** Convierte un producto de supermercado al formato que usa el formulario de agregar. */
export function toProduct(p: StoreProduct): OffProduct {
  return {
    id: p.id,
    code: p.barcodes[0] ?? null,
    name: p.name,
    brand: p.brand,
    image: p.image_url,
    quantity: p.quantity !== null ? +(p.quantity * (p.pack || 1)).toFixed(3) : null,
    unit: p.unit,
    categories: [],
    foodId: p.food_id,
    stores: p.stores,
  };
}
