import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isValidDate } from "@/lib/dates";
import { GOALS, MAX_CUSTOM, PREFS, SCOPES, migrateDraft, type DraftData, type DraftMeta } from "@/lib/chef";

/** Cuántos borradores se muestran (los más recientes). */
export const MAX_DRAFTS = 60;

const Uuid = z.string().uuid();
const Key = z.string().regex(/^\d{4}-\d{2}-\d{2}\|[a-z_]+$/);
const SourceSchema = z.object({ title: z.string().max(200), url: z.string().url().max(600) });

const MealType = z.enum(["breakfast", "lunch", "dinner", "snack"]);

/** Receta inventada por el Chef (lo que llega del cliente; el servidor recalcula su tarjeta). */
export const CustomRecipeSchema = z.object({
  name_es: z.string().trim().min(1).max(80),
  name_en: z.string().trim().min(1).max(80),
  description: z.string().max(400),
  emoji: z.string().max(16),
  meal_types: z.array(MealType).min(1).max(4),
  servings: z.number().int().min(1).max(100),
  time_minutes: z.number().int().min(1).max(1440).nullable(),
  country: z.enum(["PE", "US"]),
  ingredients: z
    .array(
      z.object({
        foodId: Uuid,
        name_es: z.string().max(200),
        name_en: z.string().max(200),
        emoji: z.string().max(16).nullable(),
        quantity: z.number().positive().max(100000).nullable(),
        unit: z.enum(["unit", "g", "kg", "ml", "l"]).nullable(),
        optional: z.boolean(),
      }),
    )
    .min(1)
    .max(60),
  steps: z.array(z.string().max(600)).min(1).max(40),
});

const N = z.number().nullable();
const CustomDishSchema = z.object({
  card: z.object({
    id: Uuid, slug: z.string().max(100), name_es: z.string().max(80), name_en: z.string().max(80), emoji: z.string().max(16).nullable(),
    image_url: z.null(), country: z.enum(["PE", "US"]), meal_types: z.array(MealType).max(4), time: N, kcal: N, protein: N, carbs: N, fat: N,
    have: z.number(), total: z.number(), expiring: z.boolean(), meat: z.boolean(), custom: z.literal(true),
  }),
  recipe: CustomRecipeSchema,
});

const ThinkingSchema = z.object({
  steps: z.array(z.string().max(200)).max(20),
  text: z.string().max(4000),
  ms: z.number().int().min(0).max(600_000),
});

/** Contenido de un borrador (lo que llega del cliente o de la base). Los de la versión 2 se migran. */
export const DraftDataSchema = z.object({
  v: z.literal(3),
  prefs: z.object({
    goal: z.enum(GOALS),
    scope: z.enum(SCOPES),
    prefs: z.array(z.enum(PREFS)).max(PREFS.length),
    start: z.string().refine(isValidDate),
  }),
  liked: z.array(Uuid).max(80),
  disliked: z.array(Uuid).max(80),
  plan: z.record(Key, z.object({ recipeId: Uuid, reason: z.string().max(200).optional() })).refine((p) => Object.keys(p).length <= 70),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().max(4000),
        offline: z.boolean().optional(),
        sources: z.array(SourceSchema).max(6).optional(),
        changes: z.number().int().min(0).max(100).optional(),
        thinking: ThinkingSchema.optional(),
        calendar: z
          .object({
            changes: z
              .array(
                z.object({
                  key: Key,
                  recipeId: Uuid.nullable(),
                  reason: z.string().max(200).optional(),
                  before: z.string().max(400),
                  mealIds: z.array(Uuid).max(10),
                }),
              )
              .max(70),
            status: z.enum(["pending", "applied", "dismissed"]),
          })
          .optional(),
        dropped: z.number().int().min(0).max(100).optional(),
      }),
    )
    .max(120),
  quickReplies: z.array(z.string().max(80)).max(6),
  custom: z.record(Uuid, CustomDishSchema).refine((c) => Object.keys(c).length <= MAX_CUSTOM),
});

type Row = { id: string; title: string; updated_at: string; start: string | null; plan: Record<string, unknown> | null };

export function toMeta(r: Row): DraftMeta {
  return { id: r.id, title: r.title, updatedAt: r.updated_at, start: r.start, meals: r.plan ? Object.keys(r.plan).length : 0 };
}

export const META_COLUMNS = "id, title, updated_at, start:data->prefs->>start, plan:data->plan";

/** Borradores de quien mira, del más reciente al más antiguo (si la tabla aún no existe, lista vacía). */
export async function loadDraftList(supabase: SupabaseClient): Promise<DraftMeta[]> {
  const { data, error } = await supabase.from("chef_drafts").select(META_COLUMNS).order("updated_at", { ascending: false }).limit(MAX_DRAFTS);
  if (error) {
    console.error("chef drafts", error.message);
    return [];
  }
  return ((data ?? []) as unknown as Row[]).map(toMeta);
}

/** Lee y valida el contenido de un borrador guardado (null si está dañado). */
export function parseDraftData(raw: unknown): DraftData | null {
  const parsed = DraftDataSchema.safeParse(migrateDraft(raw));
  return parsed.success ? (parsed.data as DraftData) : null;
}

