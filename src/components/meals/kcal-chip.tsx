"use client";

import { useTranslations } from "next-intl";
import { mealKcal } from "@/lib/meals";
import type { Meal } from "@/lib/types";

/** "≈ 620 kcal" (por porción) de una comida; "~" cuando el valor es aproximado. No se muestra sin dato. */
export function KcalChip({ meal }: { meal: Pick<Meal, "recipe" | "custom_items" | "kcal_per_serving" | "status"> }) {
  const t = useTranslations("portions");
  const k = mealKcal(meal);
  if (!k) return null;
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground tabular-nums">
      {(k.approx ? t("kcalChipApprox", { kcal: k.kcal }) : t("kcalChip", { kcal: k.kcal }))}
    </span>
  );
}
