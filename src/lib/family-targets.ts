import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { dailyTarget, type BodyData, type LogPoint } from "@/lib/body";
import { addDays, todayIn } from "@/lib/dates";
import { memberAvatarSrc } from "@/lib/avatars";
import type { MemberTarget } from "@/lib/portions";
import type { BodyRow, Family, Role } from "@/lib/types";

type LogRow = { body_id: string; logged_on: string; weight_kg: number; height_cm: number | null };

/** Solo los últimos días influyen en el peso tendencia (constante de 7 días). */
const LOG_WINDOW_DAYS = 60;

const toBodyData = (b: BodyRow | undefined): BodyData => ({
  sex: b?.sex ?? null,
  birthDate: b?.birth_date ?? null,
  heightCm: b?.height_cm != null ? Number(b.height_cm) : null,
  activity: b?.activity ?? "light",
  goalKg: b?.goal_weight_kg != null ? Number(b.goal_weight_kg) : null,
  pace: b?.goal_pace ?? "recommended",
});

const toLogPoints = (rows: LogRow[] | undefined): LogPoint[] =>
  (rows ?? []).map((r) => ({ on: r.logged_on, kg: Number(r.weight_kg), cm: r.height_cm != null ? Number(r.height_cm) : null }));

/**
 * Calcula las kcal diarias de todas las personas de la familia (cuentas y dependientes).
 * Usa el cliente admin porque los datos corporales son privados, pero SOLO devuelve datos
 * derivados; el visor debe ser un miembro de la familia (lo garantiza requireMember en quien llama).
 * `viewer.supabase` es el cliente con RLS del visor: sirve para saber qué fichas puede abrir.
 */
export async function loadFamilyTargets(viewer: {
  supabase: SupabaseClient;
  userId: string;
  isParent: boolean;
  family: Family;
}): Promise<MemberTarget[]> {
  const admin = createAdminClient();
  const today = todayIn(viewer.family.timezone);

  const [{ data: profiles }, { data: dependents }] = await Promise.all([
    admin.from("profiles").select("id, full_name, avatar, avatar_url, role").eq("family_id", viewer.family.id).order("created_at"),
    admin.from("dependents").select("id, name, avatar").eq("family_id", viewer.family.id).order("created_at"),
  ]);
  const people = (profiles ?? []) as { id: string; full_name: string | null; avatar: string | null; avatar_url: string | null; role: Role | null }[];
  const kids = (dependents ?? []) as { id: string; name: string; avatar: string | null }[];

  const [{ data: profileBodies }, { data: dependentBodies }, { data: visible }] = await Promise.all([
    people.length ? admin.from("body_profiles").select("*").in("profile_id", people.map((p) => p.id)) : { data: [] },
    kids.length ? admin.from("body_profiles").select("*").in("dependent_id", kids.map((d) => d.id)) : { data: [] },
    viewer.supabase.from("body_profiles").select("id"),
  ]);
  const bodyByProfile = new Map(((profileBodies ?? []) as BodyRow[]).map((b) => [b.profile_id, b]));
  const bodyByDependent = new Map(((dependentBodies ?? []) as BodyRow[]).map((b) => [b.dependent_id, b]));
  const visibleIds = new Set(((visible ?? []) as { id: string }[]).map((b) => b.id));

  const bodyIds = [...bodyByProfile.values(), ...bodyByDependent.values()].map((b) => b.id);
  const logsByBody = new Map<string, LogRow[]>();
  if (bodyIds.length) {
    const { data: logs } = await admin
      .from("weight_logs")
      .select("body_id, logged_on, weight_kg, height_cm")
      .in("body_id", bodyIds)
      .gte("logged_on", addDays(today, -LOG_WINDOW_DAYS))
      .order("logged_on");
    for (const l of (logs ?? []) as LogRow[]) logsByBody.set(l.body_id, [...(logsByBody.get(l.body_id) ?? []), l]);

    // Quien no pesó en la ventana: se toma su último pesaje (así se detecta que está desactualizado).
    await Promise.all(
      bodyIds
        .filter((id) => !logsByBody.has(id))
        .map(async (id) => {
          const { data } = await admin
            .from("weight_logs")
            .select("body_id, logged_on, weight_kg, height_cm")
            .eq("body_id", id)
            .order("logged_on", { ascending: false })
            .limit(1);
          if (data?.length) logsByBody.set(id, data as LogRow[]);
        }),
    );
  }

  const canOpen = (body: BodyRow | undefined, isSelf: boolean, kind: "profile" | "dependent", role: Role | null) => {
    if (body) return visibleIds.has(body.id);
    // Todavía sin datos: la propia persona, o un padre (de un hijo o de un dependiente), pueden completarlos.
    return isSelf || (viewer.isParent && (kind === "dependent" || role === "child"));
  };

  const build = (
    kind: "profile" | "dependent",
    id: string,
    name: string,
    avatarSrc: string | null,
    body: BodyRow | undefined,
    role: Role | null,
  ): MemberTarget => {
    const t = dailyTarget(toBodyData(body), toLogPoints(body ? logsByBody.get(body.id) : undefined), today);
    return {
      key: `${kind === "profile" ? "p" : "d"}:${id}`,
      kind,
      id,
      name,
      avatarSrc,
      kcal: t.kcal,
      state: t.status,
      stale: t.stale,
      href: canOpen(body, id === viewer.userId, kind, role) ? `/weight/${id}` : null,
    };
  };

  const targets = [
    ...people.map((p) => build("profile", p.id, p.full_name ?? "", memberAvatarSrc(p), bodyByProfile.get(p.id), p.role)),
    ...kids.map((d) => build("dependent", d.id, d.name, memberAvatarSrc({ avatar: d.avatar }), bodyByDependent.get(d.id), null)),
  ];
  // La propia persona primero.
  return targets.sort((a, b) => Number(b.id === viewer.userId) - Number(a.id === viewer.userId));
}
