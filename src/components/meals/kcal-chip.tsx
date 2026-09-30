"use client";

import { useTranslations } from "next-intl";
import { formatPortion } from "@/lib/nutrition";
import { mealKcal } from "@/lib/meals";
import { mealPortion } from "@/lib/portions";
import type { Meal } from "@/lib/types";

type ChipMeal = Pick<Meal, "slot" | "recipe" | "custom_items" | "kcal_per_serving" | "status">;

/**
 * Lo que le toca a quien mira en esta comida: "1½ porciones · 930 kcal", calculado con su meta diaria y la parte
 * de la franja que le corresponde a la comida (la franja se reparte entre las comidas que la comparten).
 * "~" cuando el valor es aproximado. Si aún no hay meta (faltan datos) se muestra en su lugar las kcal de una
 * porción de la comida ("≈ 620 kcal"). No se muestra sin dato de kcal.
 */
export function KcalChip({
  meal,
  siblings = 1,
  myKcal,
  mealsPerDay,
}: {
  meal: ChipMeal;
  /** Comidas que se reparten la franja (esta incluida). */
  siblings?: number;
  /** Meta diaria de kcal de quien mira; null si faltan sus datos. */
  myKcal: number | null;
  mealsPerDay: number;
}) {
  const t = useTranslations("portions");
  const k = mealKcal(meal);
  if (!k) return null;

  if (myKcal) {
    const p = mealPortion({ targetKcal: myKcal, mealsPerDay, slot: meal.slot, siblings, kcalPerServing: k.kcal });
    return (
      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-primary tabular-nums">
        {t("mine", {
          portion: formatPortion(p.portion),
          unit: p.portion <= 1 ? t("unitOne") : t("unitMany"),
          kcal: `${k.approx ? "~" : ""}${p.kcal}`,
        })}
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium whitespace-nowrap text-muted-foreground tabular-nums">
      {k.approx ? t("kcalChipApprox", { kcal: k.kcal }) : t("kcalChip", { kcal: k.kcal })}
    </span>
  );
}
