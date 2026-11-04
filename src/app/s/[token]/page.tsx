import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { loadSharedPlan } from "@/lib/chef-share";
import { SharedPlanView } from "@/components/chef/shared-plan";

/** Plan del Chef compartido por link: se puede ver sin cuenta; para seguir editando se copia a tu Chef. */
export default async function SharedPlanPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const session = await getSession();
  const shared = await loadSharedPlan(session?.supabase ?? (await createClient()), token);
  if (!shared) notFound();
  return <SharedPlanView shared={shared} signedIn={!!session} />;
}

export async function generateMetadata({ params }: PageProps<"/s/[token]">): Promise<Metadata> {
  const { token } = await params;
  const t = await getTranslations("share");
  const shared = await loadSharedPlan(await createClient(), token);
  return {
    title: shared ? `${shared.title || t("untitled")} · Chef IA` : t("notFoundTitle"),
    description: t("metaDescription"),
    robots: { index: false, follow: false },
  };
}
