"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, requireMember, requireParent } from "@/lib/session";
import type { Role } from "@/lib/types";

const ONE_YEAR = 60 * 60 * 24 * 365;

async function setLocaleCookie(locale: string) {
  (await cookies()).set("locale", locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
}

export async function createFamily(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const mealsPerDay = Number(formData.get("meals_per_day"));
  const locale = formData.get("locale") === "en" ? "en" : "es";
  const timezone = String(formData.get("timezone") ?? "");
  if (!name || ![3, 4, 5].includes(mealsPerDay)) throw new Error("invalid");

  const { error } = await session.supabase.rpc("create_family", {
    p_name: name,
    p_meals_per_day: mealsPerDay,
    p_timezone: timezone,
  });
  if (error) throw new Error(error.message);

  await session.supabase.from("profiles").update({ locale }).eq("id", session.user.id);
  await setLocaleCookie(locale);
  redirect("/");
}

export async function acceptInvite(token: string) {
  const session = await getSession();
  if (!session) redirect(`/login?next=/invite/${token}`);
  const { error } = await session.supabase.rpc("accept_invite", { p_token: token });
  if (error) return { error: error.message };
  await setLocaleCookie(session.profile.locale);
  redirect("/");
}

export async function setLocale(locale: "es" | "en") {
  const session = await getSession();
  if (session) await session.supabase.from("profiles").update({ locale }).eq("id", session.user.id);
  await setLocaleCookie(locale);
  revalidatePath("/", "layout");
}

export async function updateFamilySettings(input: { name?: string; meals_per_day?: number }) {
  const { supabase, family } = await requireParent();
  const patch: Record<string, unknown> = {};
  if (input.name?.trim()) patch.name = input.name.trim().slice(0, 60);
  if (input.meals_per_day && [3, 4, 5].includes(input.meals_per_day)) patch.meals_per_day = input.meals_per_day;
  const { error } = await supabase.from("families").update(patch).eq("id", family.id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

/** Link activo para el rol (se crea uno nuevo si no existe, se usó o venció). */
export async function getInviteLink(role: Role) {
  const { supabase } = await requireParent();
  const { data, error } = await supabase.rpc("get_active_invite", { p_role: role });
  if (error) throw new Error(error.message);
  return { token: data.token as string, expiresAt: data.expires_at as string };
}

export async function removeMember(userId: string) {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("remove_member", { p_user: userId });
  if (error) throw new Error(error.message);
  revalidatePath("/family");
}

export async function signOut() {
  const { supabase } = await requireMember();
  await supabase.auth.signOut();
  redirect("/login");
}
