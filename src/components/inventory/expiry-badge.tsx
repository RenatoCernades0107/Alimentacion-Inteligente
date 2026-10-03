"use client";

import { useTranslations } from "next-intl";
import { daysBetween } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** `stacked`: "estimado" va en una segunda línea (la insignia ocupa menos ancho en filas apretadas). */
export function ExpiryBadge({
  expiresOn,
  estimated,
  today,
  stacked,
}: {
  expiresOn: string | null;
  estimated?: boolean;
  today: string;
  stacked?: boolean;
}) {
  const t = useTranslations("inventory");
  if (!expiresOn) return <span className="text-xs text-muted-foreground">{t("noExpiry")}</span>;

  const days = daysBetween(today, expiresOn);
  const tone = days < 0 ? "bg-red-100 text-red-700" : days <= 1 ? "bg-orange-100 text-orange-700" : days <= 7 ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground";
  const label = days < 0 ? t("expired", { days: -days }) : t("expiresIn", { days });

  if (stacked && estimated) {
    return (
      <span className={cn("inline-flex flex-col items-end rounded-2xl px-2.5 py-0.5 text-xs leading-tight font-medium", tone)}>
        {label}
        <span className="text-[10px] font-normal opacity-70">{t("estimated")}</span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
      {label}
      {estimated && <span className="ml-1 opacity-70">· {t("estimated")}</span>}
    </span>
  );
}
