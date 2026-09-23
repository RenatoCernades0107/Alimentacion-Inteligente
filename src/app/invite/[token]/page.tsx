import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { GoogleButton } from "@/components/google-button";
import { DevLogin } from "@/components/dev-login";
import { AcceptInviteButton } from "@/components/accept-invite-button";

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const tr = await getTranslations("roles");

  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_info", { p_token: token });
  const info = (data as { family_name: string; role: "parent" | "child"; valid: boolean }[] | null)?.[0];
  const session = await getSession();

  if (session?.family) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-6 pt-safe pb-safe text-center">
      <div className="text-5xl">💌</div>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {!info?.valid ? (
        <p className="text-muted-foreground">{t("invalid")}</p>
      ) : (
        <>
          <p className="text-muted-foreground">{t("joinAs", { family: info.family_name, role: tr(info.role) })}</p>
          {session ? (
            <AcceptInviteButton token={token} label={t("join")} />
          ) : (
            <>
              <GoogleButton next={`/invite/${token}`} label={t("loginToJoin")} />
              {process.env.NODE_ENV === "development" && <DevLogin next={`/invite/${token}`} />}
            </>
          )}
        </>
      )}
    </main>
  );
}
