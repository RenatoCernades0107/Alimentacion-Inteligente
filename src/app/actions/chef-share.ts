"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireMember } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { loadChefData } from "@/lib/chef-data";
import { parseDraftData } from "@/lib/chef-drafts";
import { loadSharedPlan, shareDish } from "@/lib/chef-share";
import { saveChefDraft } from "@/app/actions/chef-drafts";

const Id = z.string().uuid();

export type ShareInfo = { id: string; updatedAt: string };

/** Link actual de un borrador propio (null si no está compartido). */
export async function getChefShare(draftId: string): Promise<ShareInfo | null> {
  const { supabase } = await requireMember();
  const { data } = await supabase.from("chef_shares").select("id, updated_at").eq("draft_id", Id.parse(draftId)).maybeSingle();
  return data ? { id: data.id as string, updatedAt: data.updated_at as string } : null;
}

/**
 * Comparte un borrador propio: guarda una foto de cómo está ahora (o actualiza la foto si ya tenía link)
 * y devuelve el token del link. La foto se arma en el servidor desde lo guardado, no desde el cliente.
 */
export async function shareChefDraft(draftId: string): Promise<ShareInfo> {
  const { supabase, family } = await requireMember();
  const id = Id.parse(draftId);
  const { data: row } = await supabase.from("chef_drafts").select("title, data").eq("id", id).maybeSingle();
  const draft = row && parseDraftData(row.data);
  if (!row || !draft) throw new Error("not found");

  const locale = (await getLocale()) === "en" ? "en" : "es";
  const { cards } = await loadChefData(supabase, family.id, todayIn(family.timezone), locale);
  // Las recetas nuevas del Chef viajan en el borrador; en el link no van datos del inventario.
  const byId = new Map([...cards, ...Object.values(draft.custom).map((d) => d.card)].map((c) => [c.id, c]));
  const custom = Object.fromEntries(
    Object.entries(draft.custom).map(([cid, d]) => [cid, { ...d, card: { ...d.card, have: 0, total: 0, expiring: false } }]),
  );
  const dishes = Object.fromEntries(
    [...new Set(Object.values(draft.plan).flatMap((e) => (e ? [e.recipeId] : [])))]
      .filter((rid) => byId.has(rid))
      .map((rid) => [rid, shareDish(byId.get(rid)!)]),
  );
  const snapshot = { title: (row.title as string) ?? "", data: { ...draft, custom }, dishes };

  const { data: existing } = await supabase.from("chef_shares").select("id").eq("draft_id", id).maybeSingle();
  const query = existing
    ? supabase.from("chef_shares").update(snapshot).eq("id", existing.id)
    : supabase.from("chef_shares").insert({ draft_id: id, ...snapshot });
  const { data: saved, error } = await query.select("id, updated_at").single();
  if (error || !saved) throw new Error(error?.message ?? "share failed");
  return { id: saved.id as string, updatedAt: saved.updated_at as string };
}

/** Deja de compartir: el link deja de funcionar. */
export async function unshareChefDraft(draftId: string): Promise<void> {
  const { supabase } = await requireMember();
  const { error } = await supabase.from("chef_shares").delete().eq("draft_id", Id.parse(draftId));
  if (error) throw new Error(error.message);
}

/**
 * "Seguir editando" un plan compartido: lo copia como borrador propio de quien lo abrió (con la
 * conversación) y devuelve su id. El dueño vuelve a su borrador original en vez de copiarlo.
 */
export async function continueSharedPlan(token: string): Promise<string> {
  const { supabase } = await requireMember();
  const shared = await loadSharedPlan(supabase, token);
  if (!shared) throw new Error("not found");
  if (shared.isMine && shared.draftId) return shared.draftId;
  const meta = await saveChefDraft({ title: shared.title.slice(0, 80), data: shared.data });
  return meta.id;
}
