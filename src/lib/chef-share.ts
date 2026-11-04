import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { parseDraftData } from "@/lib/chef-drafts";
import type { DishCard, DraftData } from "@/lib/chef";

/** Un plan compartido por link, tal como se muestra a quien lo abre. */
export type SharedPlan = {
  id: string;
  title: string;
  data: DraftData;
  /** Platos del plan (por id de receta), con lo necesario para mostrarlos. */
  dishes: Record<string, DishCard>;
  ownerName: string | null;
  updatedAt: string;
  isMine: boolean;
  /** Solo para el dueño: su borrador original. */
  draftId: string | null;
};

const Token = z.string().uuid();

const DishSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name_es: z.string(),
  name_en: z.string(),
  emoji: z.string().nullable(),
  image_url: z.string().nullable(),
  country: z.string(),
  meal_types: z.array(z.string()),
  time: z.number().nullable(),
  kcal: z.number().nullable(),
  protein: z.number().nullable(),
  carbs: z.number().nullable(),
  fat: z.number().nullable(),
});

/** Lee un plan compartido por su token (null si no existe o el token no es válido). Funciona sin sesión. */
export async function loadSharedPlan(supabase: SupabaseClient, token: string): Promise<SharedPlan | null> {
  if (!Token.safeParse(token).success) return null;
  const { data, error } = await supabase.rpc("get_chef_share", { p_id: token });
  if (error) {
    console.error("chef share", error.message);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { id: string; title: string; data: unknown; dishes: unknown; owner_name: string | null; updated_at: string; is_mine: boolean | null; draft_id: string | null }
    | undefined;
  if (!row) return null;
  const draft = parseDraftData(row.data);
  if (!draft) return null;
  const dishes: Record<string, DishCard> = {};
  for (const [id, d] of Object.entries((row.dishes ?? {}) as Record<string, unknown>)) {
    const parsed = DishSchema.safeParse(d);
    if (parsed.success) dishes[id] = { ...(parsed.data as Omit<DishCard, "have" | "total" | "expiring" | "meat">), have: 0, total: 0, expiring: false, meat: true };
  }
  return {
    id: row.id, title: row.title, data: draft, dishes, ownerName: row.owner_name, updatedAt: row.updated_at,
    isMine: !!row.is_mine, draftId: row.draft_id,
  };
}

/** Lo que se guarda de cada plato en el link: sin datos del inventario de la familia. */
export function shareDish(c: DishCard) {
  return {
    id: c.id, slug: c.slug, name_es: c.name_es, name_en: c.name_en, emoji: c.emoji, image_url: c.image_url, country: c.country,
    meal_types: c.meal_types, time: c.time, kcal: c.kcal, protein: c.protein, carbs: c.carbs, fat: c.fat,
  };
}
