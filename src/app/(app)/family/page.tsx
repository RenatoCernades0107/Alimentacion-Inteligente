import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/session";
import { PageHeader, Section } from "@/components/page-header";
import { InviteCard } from "@/components/family/invite-card";
import { PushCard } from "@/components/family/push-card";
import { MemberList } from "@/components/family/member-list";
import { FamilySettings } from "@/components/family/family-settings";
import type { Profile } from "@/lib/types";

export default async function FamilyPage() {
  const { supabase, family, profile, isParent } = await requireMember();
  const t = await getTranslations("family");
  const ti = await getTranslations("invite");

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, locale, family_id")
    .eq("family_id", family.id)
    .order("created_at");

  return (
    <>
      <PageHeader title={family.name} />

      <Section title={t("members")}>
        <MemberList members={(members ?? []) as Profile[]} currentUserId={profile.id} canRemove={isParent} />
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
