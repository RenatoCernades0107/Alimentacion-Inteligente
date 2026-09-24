"use server";

import { requireParent } from "@/lib/session";
import { analyzeImage, type CatalogEntry, type VisionItem } from "@/lib/vision";
import { toProduct, type StoreProduct } from "@/lib/stores";
import type { DetectedItem, DetectedMatch, PhotoMode } from "@/lib/photo";
import type { OffProduct } from "@/lib/off";
import type { Food, Unit } from "@/lib/types";

const MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BASE64 = 5_000_000; // ~3.7 MB de imagen

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Detecta los alimentos de una foto (o de una boleta) y los asocia con el catálogo. */
export async function analyzeFoodPhoto(input: { mode: PhotoMode; dataUrl: string }): Promise<DetectedItem[]> {
  const { supabase } = await requireParent();
  const m = /^data:([^;]+);base64,(.+)$/.exec(input.dataUrl);
  if (!m || !MIME_TYPES.includes(m[1]) || m[2].length > MAX_BASE64) throw new Error("invalid image");
  const mode: PhotoMode = input.mode === "receipt" ? "receipt" : "food";

  // Genéricos (por key) y alimentos propios de la familia (por id); RLS deja ver solo esos.
  const { data } = await supabase.from("foods").select("*");
  const foods = (data as Food[] | null) ?? [];
  const byRef = new Map<string, Food>();
  const byId = new Map<string, Food>();
  const catalog: CatalogEntry[] = [];
  for (const f of foods) {
    const ref = f.key ?? f.id;
    byRef.set(ref, f);
    byId.set(f.id, f);
    catalog.push({ ref, name: f.name_es, aliases: (f as Food & { aliases?: string[] }).aliases ?? [] });
  }

  const items = await analyzeImage({ mode, base64: m[2], mimeType: m[1], catalog });

  return Promise.all(
    items.map(async (item, i): Promise<DetectedItem> => {
      const food = item.food_ref ? byRef.get(item.food_ref) ?? null : null;
      const product = item.packaged ? await findStoreProduct(supabase, item) : null;

      let match: DetectedMatch;
      if (product) match = { kind: "product", product, linked: (product.foodId && byId.get(product.foodId)) || food };
      else if (food) match = { kind: "food", food };
      else match = { kind: "new", name: item.name.slice(0, 80), emoji: item.emoji?.slice(0, 8) || "🍽️" };

      return { id: String(i), raw_text: item.raw_text, confidence: item.confidence, match, ...amount(item, product) };
    }),
  );
}

/** Busca el producto en los supermercados; solo se acepta si todas las palabras coinciden. */
async function findStoreProduct(supabase: Awaited<ReturnType<typeof requireParent>>["supabase"], item: VisionItem): Promise<OffProduct | null> {
  const query = (item.search_query || [item.name, item.brand].filter(Boolean).join(" ")).trim();
  const words = normalize(query).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !/\d/.test(w));
  if (!words.length) return null;
  const { data } = await supabase.rpc("search_store_products", { p_query: words.join(" "), p_limit: 3 });
  const hit = ((data as StoreProduct[] | null) ?? []).find((p) => {
    const text = normalize(`${p.name} ${p.brand ?? ""}`);
    return words.every((w) => text.includes(w));
  });
  return hit ? toProduct(hit) : null;
}

/** Cantidad total: count × tamaño de cada paquete (o el del producto de supermercado). */
function amount(item: VisionItem, product: OffProduct | null): { quantity: number; unit: Unit } {
  const count = item.count || 1;
  if (item.size && item.size_unit) return { quantity: round(count * item.size), unit: item.size_unit };
  if (product?.quantity && product.unit) return { quantity: round(count * product.quantity), unit: product.unit };
  return { quantity: round(count), unit: "unit" };
}

function round(n: number) {
  return +n.toFixed(3);
}
