"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/session";
import { isAvatarId } from "@/lib/avatars";
import { todayIn } from "@/lib/dates";
import {
  ACTIVITIES,
  PACES,
  SEXES,
  ageOn,
  clampGoal,
  isRealDate,
  plausibleBmi,
  trendKg,
  type Activity,
  type Pace,
  type Sex,
} from "@/lib/body";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resultado esperado de una acción. Los errores previstos (datos inválidos, valores raros que hay
 * que confirmar) se devuelven; los inesperados (permisos, red) lanzan y el cliente muestra un aviso.
 * En producción Next oculta el mensaje de los errores lanzados, por eso no se usa para lo previsto.
 */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: "invalid" | "implausible" | "needsWeight" };

const fail = (error: "invalid" | "implausible" | "needsWeight"): { ok: false; error: typeof error } => ({ ok: false, error });

/** Número finito o null. */
function num(v: unknown) {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? n : null;
}
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function uuidOrNull(v: unknown) {
  return typeof v === "string" && UUID.test(v) ? v : null;
}

export type SaveBodyInput = {
  /** Cuenta (id de perfil) o dependiente: exactamente uno. */
  profileId?: string | null;
  dependentId?: string | null;
  sex: Sex;
  birthDate: string;
  heightCm: number;
  activity: Activity;
  /** Primer pesaje (opcional): el peso actual al completar los datos. */
  weightKg?: number | null;
  /** El usuario confirmó un peso/estatura poco habituales. */
  confirm?: boolean;
};

/** Crea o actualiza los datos corporales de una persona. Los permisos los decide la base de datos. */
export async function saveBody(input: SaveBodyInput): Promise<ActionResult<{ bodyId: string }>> {
  const { supabase, family } = await requireMember();
  const profileId = uuidOrNull(input.profileId);
  const dependentId = uuidOrNull(input.dependentId);
  if (!!profileId === !!dependentId) return fail("invalid");
  if (!SEXES.includes(input.sex) || !ACTIVITIES.includes(input.activity)) return fail("invalid");

  const today = todayIn(family.timezone);
  if (!isRealDate(input.birthDate) || !ageOn(input.birthDate, today)) return fail("invalid");
  const height = num(input.heightCm);
  if (height === null || height < 45 || height > 230) return fail("invalid");
  const weight = input.weightKg == null ? null : num(input.weightKg);
  if (input.weightKg != null && (weight === null || weight < 2 || weight > 400)) return fail("invalid");
  if (weight !== null && !input.confirm && plausibleBmi(weight, height) !== "ok") return fail("implausible");

  const { data: bodyId, error } = await supabase.rpc("save_body", {
    p_profile: profileId,
    p_dependent: dependentId,
    p_sex: input.sex,
    p_birth: input.birthDate,
    p_height: round1(height),
    p_activity: input.activity,
  });
  if (error || !bodyId) throw new Error(error?.message ?? "error");

  if (weight !== null) {
    const { error: logError } = await supabase.rpc("add_weight", { p_body: bodyId, p_on: today, p_kg: round2(weight), p_cm: round1(height) });
    if (logError) throw new Error(logError.message);
  }
  revalidatePath("/", "layout");
  return { ok: true, bodyId: bodyId as string };
}

/** Registra (o corrige, si ya hay uno ese día) un pesaje. */
export async function addWeight(bodyId: string, on: string, kg: number, cm: number | null, confirm = false): Promise<ActionResult> {
  const { supabase } = await requireMember();
  const id = uuidOrNull(bodyId);
  const weight = num(kg);
  const height = cm == null ? null : num(cm);
  if (!id || weight === null || weight < 2 || weight > 400 || !isRealDate(on)) return fail("invalid");
  if (cm != null && (height === null || height < 45 || height > 230)) return fail("invalid");

  if (!confirm) {
    // Peso y estatura poco habituales: se pide confirmar (con la estatura del pesaje o la vigente).
    const known = height ?? (await supabase.from("body_profiles").select("height_cm").eq("id", id).maybeSingle()).data?.height_cm ?? null;
    if (known && plausibleBmi(weight, Number(known)) !== "ok") return fail("implausible");
  }
  const { error } = await supabase.rpc("add_weight", {
    p_body: id, p_on: on, p_kg: round2(weight), p_cm: height === null ? null : round1(height),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteWeight(logId: string) {
  const { supabase } = await requireMember();
  const id = uuidOrNull(logId);
  if (!id) throw new Error("invalid");
  const { error } = await supabase.rpc("delete_weight", { p_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/**
 * Fija (o quita, con null) la meta de peso de un adulto. La meta se recorta al rango saludable
 * de su estatura y edad; la base de datos exige además que ya haya un pesaje.
 */
export async function setGoal(bodyId: string, goalKg: number | null, pace: Pace): Promise<ActionResult<{ goalKg: number | null }>> {
  const { supabase, family } = await requireMember();
  const id = uuidOrNull(bodyId);
  if (!id || !PACES.includes(pace)) return fail("invalid");

  let goal: number | null = null;
  if (goalKg !== null) {
    const asked = num(goalKg);
    if (asked === null) return fail("invalid");
    const { data: body } = await supabase.from("body_profiles").select("birth_date, height_cm").eq("id", id).maybeSingle();
    const { data: logs } = await supabase
      .from("weight_logs")
      .select("logged_on, weight_kg, height_cm")
      .eq("body_id", id)
      .order("logged_on");
    if (!body) throw new Error("not found");
    const age = ageOn(body.birth_date, todayIn(family.timezone));
    if (!age || age.years < 18) return fail("invalid");
    const points = (logs ?? []).map((l) => ({ on: l.logged_on as string, kg: Number(l.weight_kg) }));
    const trend = trendKg(points);
    const cm = [...(logs ?? [])].reverse().find((l) => l.height_cm != null)?.height_cm ?? body.height_cm;
    if (trend === null || cm == null) return fail("needsWeight");
    goal = clampGoal(asked, { cm: Number(cm), years: age.years, kg: Math.round(trend * 10) / 10 }).kg;
  }

  const { error } = await supabase.rpc("set_goal", { p_body: id, p_goal: goal, p_pace: pace });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  return { ok: true, goalKg: goal };
}

export type DependentInput = { name: string; avatar: string | null; birthDate: string; sex: Sex };

/** Un padre agrega a un integrante sin cuenta. Devuelve su id (la ficha es /weight/<id>). */
export async function addDependent(input: DependentInput): Promise<ActionResult<{ id: string }>> {
  const { supabase, family, isParent } = await requireMember();
  if (!isParent) throw new Error("forbidden");
  const name = String(input.name ?? "").trim().slice(0, 40);
  if (!name || !SEXES.includes(input.sex)) return fail("invalid");
  if (!isRealDate(input.birthDate) || !ageOn(input.birthDate, todayIn(family.timezone))) return fail("invalid");
  const { data, error } = await supabase.rpc("add_dependent", {
    p_name: name,
    p_avatar: isAvatarId(input.avatar) ? input.avatar : null,
    p_birth: input.birthDate,
    p_sex: input.sex,
  });
  if (error || !data) throw new Error(error?.message ?? "error");
  revalidatePath("/", "layout");
  return { ok: true, id: data as string };
}

export async function updateDependent(id: string, name: string, avatar: string | null): Promise<ActionResult> {
  const { supabase, isParent } = await requireMember();
  const depId = uuidOrNull(id);
  const clean = String(name ?? "").trim().slice(0, 40);
  if (!isParent) throw new Error("forbidden");
  if (!depId || !clean) return fail("invalid");
  const { error } = await supabase.rpc("update_dependent", {
    p_id: depId, p_name: clean, p_avatar: isAvatarId(avatar) ? avatar : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeDependent(id: string) {
  const { supabase, isParent } = await requireMember();
  const depId = uuidOrNull(id);
  if (!isParent || !depId) throw new Error("forbidden");
  const { error } = await supabase.rpc("remove_dependent", { p_id: depId });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}
