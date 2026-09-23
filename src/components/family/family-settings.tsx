"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { setLocale, signOut, updateFamilySettings } from "@/app/actions/family";

export function FamilySettings({
  isParent, mealsPerDay, locale,
}: {
  isParent: boolean;
  familyName: string;
  mealsPerDay: number;
  locale: "es" | "en";
}) {
  const t = useTranslations("family");
  const to = useTranslations("onboarding");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        await fn();
        toast.success(tc("saved"));
      } catch {
        toast.error(tc("error"));
      }
    });

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      {isParent && (
        <div className="space-y-2">
          <Label htmlFor="meals">{t("mealsPerDay")}</Label>
          <NativeSelect
            id="meals"
            defaultValue={String(mealsPerDay)}
            disabled={pending}
            onChange={(e) => run(() => updateFamilySettings({ meals_per_day: Number(e.target.value) }))}
          >
            {[3, 4, 5].map((n) => <option key={n} value={n}>{to("mealsOption", { count: n })}</option>)}
          </NativeSelect>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="lang">{t("language")}</Label>
        <NativeSelect id="lang" defaultValue={locale} disabled={pending} onChange={(e) => run(() => setLocale(e.target.value as "es" | "en"))}>
          <option value="es">Español</option>
          <option value="en">English</option>
        </NativeSelect>
      </div>
      <Button variant="outline" className="h-10 w-full" onClick={() => start(() => signOut())} disabled={pending}>
        <LogOut /> {t("signOut")}
      </Button>
    </div>
  );
}
