import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Family, Profile } from "@/lib/types";

/** Usuario actual con su perfil y familia (memoizado por request). */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*, family:families(*)")
    .eq("id", user.id)
    .single();

  const { family, ...profile } = (data ?? {}) as Profile & { family: Family | null };
  return { supabase, user, profile: profile as Profile, family: family ?? null };
});

/** Exige un miembro de una familia; si no, redirige al login u onboarding. */
export async function requireMember() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.family || !session.profile.role) redirect("/onboarding");
  return {
    ...session,
    family: session.family,
    role: session.profile.role,
    isParent: session.profile.role === "parent",
  };
}

/** Igual que requireMember pero además exige rol de padre (para server actions). */
export async function requireParent() {
  const session = await requireMember();
  if (!session.isParent) throw new Error("forbidden");
  return session;
}
