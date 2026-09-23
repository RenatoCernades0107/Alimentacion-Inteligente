import type { Unit } from "./types";
import type { StoreId } from "./stores";

/** Producto de marca normalizado (de Open Food Facts o de un supermercado). */
export type OffProduct = {
  id?: string;
  code: string | null;
  name: string;
  brand: string | null;
  image: string | null;
  quantity: number | null;
  unit: Unit | null;
  categories: string[];
  /** Alimento genérico ya conocido (productos de supermercado). */
  foodId?: string | null;
  /** Cadenas donde se vende (productos de supermercado). */
  stores?: StoreId[];
};

export const OFF_USER_AGENT = "AlimentacionInteligente/0.1 (prototype)";

const FIELDS = "code,product_name,product_name_es,product_name_en,generic_name,brands,image_small_url,image_front_small_url,image_front_url,quantity,categories_tags";

export const OFF_SEARCH_URL = (q: string, lang: string) =>
  `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=15&langs=${lang}&fields=${FIELDS}`;

export const OFF_PRODUCT_URL = (code: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`;

/** "500 g", "1 L", "1.5kg", "400ml" → { quantity, unit } */
export function parseQuantity(s: string | undefined | null): { quantity: number; unit: Unit } | null {
  if (!s) return null;
  const m = s.toLowerCase().replace(",", ".").match(/([\d.]+)\s*(kg|g|gr|ml|cl|l|lt)\b/);
  if (!m) return null;
  let q = parseFloat(m[1]);
  let unit = m[2];
  if (Number.isNaN(q)) return null;
  if (unit === "gr") unit = "g";
  if (unit === "lt") unit = "l";
  if (unit === "cl") { q = q * 10; unit = "ml"; }
  return { quantity: q, unit: unit as Unit };
}

type RawProduct = Record<string, unknown>;

function str(v: unknown): string | null {
  if (Array.isArray(v)) return v.filter(Boolean).join(", ") || null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function normalizeProduct(p: RawProduct, lang: string): OffProduct | null {
  const name = str(p[`product_name_${lang}`]) ?? str(p.product_name) ?? str(p.product_name_es) ?? str(p.product_name_en) ?? str(p.generic_name);
  const code = str(p.code);
  if (!name || !code) return null;
  const q = parseQuantity(str(p.quantity));
  return {
    code,
    name,
    brand: str(p.brands),
    image: str(p.image_front_small_url) ?? str(p.image_small_url) ?? str(p.image_front_url),
    quantity: q?.quantity ?? null,
    unit: q?.unit ?? null,
    categories: Array.isArray(p.categories_tags) ? (p.categories_tags as string[]) : [],
  };
}
