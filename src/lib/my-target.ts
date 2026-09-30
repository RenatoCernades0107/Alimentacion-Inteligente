import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dailyTarget } from "@/lib/body";
import { toBodyData, toLogPoints, type LogRow } from "@/lib/body-data";
import { addDays, todayIn } from "@/lib/dates";
import type { BodyRow } from "@/lib/types";

/** Solo los últimos días influyen en el peso tendencia (constante de 7 días). */
const LOG_WINDOW_DAYS = 60;

export type MyTarget = {
  /** kcal diarias del usuario; null si faltan datos. */
  kcal: number | null;
  state: "ok" | "incomplete" | "infant";
  /** El usuario puede completar/editar sus propios datos (los hijos menores no: los edita un padre). */
  canEdit: boolean;
};

/**
 * Meta diaria de kcal del propio usuario. Lee solo sus datos con el cliente con RLS (nunca el admin),
 * así que sirve para pantallas que muestran únicamente lo suyo (calendario, inicio).
 */
export async function loadMyTarget(supabase: SupabaseClient, userId: string, timeZone: string): Promise<MyTarget> {
  const today = todayIn(timeZone);
  const [{ data: body }, { data: access }] = await Promise.all([
    supabase.from("body_profiles").select("*").eq("profile_id", userId).maybeSingle(),
    supabase.rpc("body_access", { p_profile: userId, p_dependent: null }),
  ]);
  const canEdit = access === "edit";
  if (!body) return { kcal: null, state: "incomplete", canEdit };

  const columns = "logged_on, weight_kg, height_cm";
  const { data: recent } = await supabase
    .from("weight_logs")
    .select(columns)
    .eq("body_id", (body as BodyRow).id)
    .gte("logged_on", addDays(today, -LOG_WINDOW_DAYS))
    .order("logged_on");
  let logs = (recent ?? []) as LogRow[];
  if (!logs.length) {
    // Sin pesajes recientes: se usa el último (así el objetivo existe, aunque esté desactualizado).
    const { data: last } = await supabase
      .from("weight_logs")
      .select(columns)
      .eq("body_id", (body as BodyRow).id)
      .order("logged_on", { ascending: false })
      .limit(1);
    logs = (last ?? []) as LogRow[];
  }

  const target = dailyTarget(toBodyData(body as BodyRow), toLogPoints(logs), today);
  return { kcal: target.kcal, state: target.status, canEdit };
}
