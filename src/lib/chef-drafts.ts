import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isValidDate } from "@/lib/dates";
import { GOALS, PREFS, SCOPES, type DraftData, type DraftMeta } from "@/lib/chef";

/** Cuántos borradores se muestran (los más recientes). */
export const MAX_DRAFTS = 60;

const Uuid = z.string().uuid();
const Key = z.string().regex(/^\d{4}-\d{2}-\d{2}\|[a-z_]+$/);
const SourceSchema = z.object({ title: z.string().max(200), url: z.string().url().max(600) });

/** Contenido de un borrador (lo que llega del cliente o de la base). */
export const DraftDataSchema = z.object({
  v: z.literal(2),
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
      }),
    )
    .max(120),
  quickReplies: z.array(z.string().max(80)).max(6),
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
  const parsed = DraftDataSchema.safeParse(raw);
  return parsed.success ? (parsed.data as DraftData) : null;
}
