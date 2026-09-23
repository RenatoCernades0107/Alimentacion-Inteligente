import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { GoogleButton } from "@/components/google-button";
import { DevLogin } from "@/components/dev-login";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await getSession()) redirect(nextPath);

  const t = await getTranslations("login");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 pt-safe pb-safe text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-green-500 to-green-700 text-5xl shadow-lg">
          🥑
        </div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="max-w-xs text-muted-foreground">{t("subtitle")}</p>
      </div>
      {error && <p className="text-sm text-destructive">{t("error")}</p>}
      <GoogleButton next={nextPath} label={t("google")} />
      {process.env.NODE_ENV === "development" && <DevLogin next={nextPath} />}
    </main>
  );
}
