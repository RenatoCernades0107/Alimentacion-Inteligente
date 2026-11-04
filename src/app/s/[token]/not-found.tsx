import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function SharedPlanNotFound() {
  const t = await getTranslations("share");
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-5xl">🔗</span>
      <h1 className="text-xl font-bold">{t("notFoundTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("notFoundBody")}</p>
      <Link href="/chef" className="mt-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">
        {t("goChef")}
      </Link>
    </main>
  );
}
