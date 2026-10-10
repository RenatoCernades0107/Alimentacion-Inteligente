"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MealActionsDrawer } from "@/components/meals/meal-actions";
import { RecipeImage } from "@/components/recipe-image";
import { KcalChip } from "@/components/meals/kcal-chip";
import { parseDate } from "@/lib/dates";
import { slotSiblings } from "@/lib/meals";
import { mealName, type Meal, type MealSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Lista compacta de comidas con sus acciones (completar, aceptar propuesta…). */
export function HomeMeals({
  meals, today, isParent, slots, showDate, mealsPerDay, myKcal,
}: {
  meals: Meal[];
  today: string;
  isParent: boolean;
  slots: MealSlot[];
  showDate?: boolean;
  /** Comidas al día de la familia y meta diaria de kcal de quien mira (null si faltan sus datos). */
  mealsPerDay: number;
  myKcal: number | null;
}) {
  const t = useTranslations("calendar");
  const ts = useTranslations("slots");
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<Meal | null>(null);
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  const sorted = [...meals].sort((a, b) => a.date.localeCompare(b.date) || slots.indexOf(a.slot) - slots.indexOf(b.slot));

  return (
    <>
      <ul className="divide-y rounded-2xl border bg-card">
        {sorted.map((m) => (
          <li key={m.id}>
            <button onClick={() => setSelected(m)} className="flex w-full items-center gap-3 p-3 text-left active:bg-muted">
              <RecipeImage src={m.recipe?.image_url} emoji={m.recipe?.emoji} />
              <div className="min-w-0 flex-1">
                <div className={cn("truncate font-medium", m.status === "completed" && "line-through opacity-60")}>{mealName(m, locale)}</div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="truncate">
                    {showDate && <span className="capitalize">{fmt.format(parseDate(m.date))} · </span>}
                    {ts(m.slot)}
                  </span>
                  <KcalChip meal={m} siblings={slotSiblings(m, meals)} myKcal={myKcal} mealsPerDay={mealsPerDay} />
                </div>
              </div>
              {m.status === "proposed" && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">{t("proposed")}</span>}
              {m.status === "completed" && <span className="text-xs text-primary">✓</span>}
            </button>
          </li>
        ))}
      </ul>
      <MealActionsDrawer meal={selected} today={today} isParent={isParent} onClose={() => setSelected(null)} onEdit={(m) => router.push(`/?date=${m.date}`)} />
    </>
  );
}
