import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { PageHeader, Section } from "@/components/page-header";
import { InviteCard } from "@/components/family/invite-card";
import { PushCard } from "@/components/family/push-card";
import { MemberList } from "@/components/family/member-list";
import { FamilySettings } from "@/components/family/family-settings";
import type { BodyRow, Dependent, Profile } from "@/lib/types";

type BodyLite = Pick<BodyRow, "profile_id" | "dependent_id" | "sex" | "birth_date" | "height_cm">;

export default async function FamilyPage() {
  const { supabase, family, profile, isParent } = await requireMember();
  const t = await getTranslations("family");
  const ti = await getTranslations("invite");

  const [{ data: members }, { data: dependents }, { data: bodies }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, avatar, role, locale, family_id")
      .eq("family_id", family.id)
      .order("created_at"),
    supabase.from("dependents").select("id, name, avatar").eq("family_id", family.id).order("created_at"),
    // RLS: solo las fichas que este usuario puede ver.
    supabase.from("body_profiles").select("profile_id, dependent_id, sex, birth_date, height_cm"),
  ]);

  const people = (members ?? []) as Profile[];
  const kids = (dependents ?? []) as Pick<Dependent, "id" | "name" | "avatar">[];
  const rows = new Map(((bodies ?? []) as BodyLite[]).map((b) => [b.profile_id ?? b.dependent_id, b]));

  // Enlaces a la ficha de peso solo para quien puede abrirla, y quiénes tienen datos por completar.
  const links: Record<string, string> = {};
  const incomplete: string[] = [];
  const open = (id: string, row: BodyLite | undefined) => {
    links[id] = `/weight/${id}`;
    if (!row || !row.sex || !row.birth_date || !row.height_cm) incomplete.push(id);
  };
  await Promise.all(
    people.map(async (m) => {
      const row = rows.get(m.id);
      if (row || m.id === profile.id) return open(m.id, row);
      // Sin ficha visible: un padre puede abrir la de un hijo que aún no tiene datos, salvo que ya sea
      // un adulto que se gestiona solo (lo decide la base de datos).
      if (isParent && m.role === "child") {
        const { data: access } = await supabase.rpc("body_access", { p_profile: m.id, p_dependent: null });
        if (access === "edit" || access === "view") open(m.id, undefined);
      }
    }),
  );
  if (isParent) for (const d of kids) open(d.id, rows.get(d.id));

  return (
    <>
      <PageHeader title={family.name} />

      <Section title={t("members")}>
        <MemberList
          members={people}
          dependents={kids}
          currentUserId={profile.id}
          isParent={isParent}
          links={links}
          incomplete={incomplete}
          today={todayIn(family.timezone)}
        />
      </Section>

      {isParent && (
        <Section title={ti("cardTitle")}>
          <InviteCard />
        </Section>
      )}

      <Section title={t("notifications")}>
        <div className="rounded-2xl border bg-card p-4">
          <PushCard />
        </div>
      </Section>

      <Section title={t("settings")}>
        <FamilySettings
          isParent={isParent}
          familyName={family.name}
          mealsPerDay={family.meals_per_day}
          locale={profile.locale}
        />
      </Section>
    </>
  );
}
