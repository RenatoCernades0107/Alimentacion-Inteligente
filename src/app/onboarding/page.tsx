import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { createFamily } from "@/app/actions/family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { TimezoneInput } from "@/components/timezone-input";
import { AvatarField } from "@/components/family/avatar-grid";
import { isAvatarId } from "@/lib/avatars";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.family) redirect("/");

  const t = await getTranslations("onboarding");
  const ta = await getTranslations("avatar");
  const locale = await getLocale();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 pt-safe pb-safe">
      <div className="space-y-2 text-center">
        <div className="text-5xl">👨‍👩‍👧‍👦</div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form action={createFamily} className="space-y-5">
        <TimezoneInput />
        <div className="space-y-2">
          <Label htmlFor="name">{t("familyName")}</Label>
          <Input id="name" name="name" required maxLength={60} placeholder={t("familyNamePlaceholder")} className="h-10" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meals">{t("mealsPerDay")}</Label>
          <NativeSelect id="meals" name="meals_per_day" defaultValue="3">
            {[3, 4, 5].map((n) => (
              <option key={n} value={n}>{t("mealsOption", { count: n })}</option>
            ))}
          </NativeSelect>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{ta("choose")}</legend>
          <p className="text-sm text-muted-foreground">{ta("subtitle")}</p>
          <AvatarField name="avatar" defaultValue={isAvatarId(session.profile.avatar) ? session.profile.avatar : null} />
        </fieldset>
        <div className="space-y-2">
          <Label htmlFor="locale">{t("language")}</Label>
          <NativeSelect id="locale" name="locale" defaultValue={locale}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </NativeSelect>
        </div>
        <Button type="submit" size="lg" className="h-11 w-full text-base">{t("create")}</Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">{t("haveInvite")}</p>
    </main>
  );
}
