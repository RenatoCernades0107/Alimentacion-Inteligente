import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { PageHeader } from "@/components/page-header";
import { InventoryList } from "@/components/inventory/inventory-list";
import type { InventoryItem } from "@/lib/types";

export default async function InventoryPage() {
  const { supabase, family, isParent } = await requireMember();
  const t = await getTranslations("inventory");

  const { data } = await supabase
    .from("inventory_items")
    .select("*, food:foods(*)")
    .eq("family_id", family.id)
    .order("expires_on", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title={t("title")} />
      <InventoryList items={(data ?? []) as InventoryItem[]} today={todayIn(family.timezone)} canEdit={isParent} />
    </>
  );
}
