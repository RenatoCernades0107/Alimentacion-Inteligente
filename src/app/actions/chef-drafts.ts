"use server";

import { z } from "zod";
import { requireMember } from "@/lib/session";
import { DraftDataSchema, META_COLUMNS, parseDraftData, toMeta } from "@/lib/chef-drafts";
import type { DraftData, DraftMeta } from "@/lib/chef";

const Id = z.string().uuid();
const Title = z.string().trim().max(80);

/**
 * Guarda un borrador del Chef: lo crea si no tiene id o lo actualiza. Devuelve su resumen para la
 * lista. El dueño y la familia los pone la base (RLS), nunca el cliente.
 */
export async function saveChefDraft(input: { id?: string | null; title: string; data: DraftData }): Promise<DraftMeta> {
  const { supabase } = await requireMember();
  const title = Title.parse(input.title);
  const data = DraftDataSchema.parse(input.data);
  const query = input.id
    ? supabase.from("chef_drafts").update({ title, data }).eq("id", Id.parse(input.id))
    : supabase.from("chef_drafts").insert({ title, data });
  const { data: row, error } = await query.select(META_COLUMNS).single();
  if (error || !row) throw new Error(error?.message ?? "not found");
  return toMeta(row as unknown as Parameters<typeof toMeta>[0]);
}

/** Contenido de un borrador propio (null si no existe, no es mío o está dañado). */
export async function getChefDraft(id: string): Promise<{ meta: DraftMeta; data: DraftData } | null> {
  const { supabase } = await requireMember();
  const { data: row } = await supabase.from("chef_drafts").select(`${META_COLUMNS}, data`).eq("id", Id.parse(id)).maybeSingle();
  if (!row) return null;
  const data = parseDraftData((row as { data: unknown }).data);
  return data ? { meta: toMeta(row as unknown as Parameters<typeof toMeta>[0]), data } : null;
}

export async function renameChefDraft(id: string, title: string): Promise<void> {
  const { supabase } = await requireMember();
  const { error } = await supabase.from("chef_drafts").update({ title: Title.parse(title) }).eq("id", Id.parse(id));
  if (error) throw new Error(error.message);
}

export async function deleteChefDraft(id: string): Promise<void> {
  const { supabase } = await requireMember();
  const { error } = await supabase.from("chef_drafts").delete().eq("id", Id.parse(id));
  if (error) throw new Error(error.message);
}

/** Copia un borrador (para reusar un plan como plantilla sin tocar el original). */
export async function duplicateChefDraft(id: string, title: string): Promise<DraftMeta> {
  const draft = await getChefDraft(id);
  if (!draft) throw new Error("not found");
  return saveChefDraft({ title, data: draft.data });
}
