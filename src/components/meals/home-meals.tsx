"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { MealActionsDrawer } from "@/components/meals/meal-actions";
import { parseDate } from "@/lib/dates";
import { mealName, type Meal, type MealSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Lista compacta de comidas con sus acciones (completar, aceptar propuesta…). */
export function HomeMeals({ meals, today, isParent, slots, showDate }: { meals: Meal[]; today: string; isParent: boolean; slots: MealSlot[]; showDate?: boolean }) {
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
              <span className="text-2xl">{m.recipe?.emoji ?? "🍽️"}</span>
              <div className="min-w-0 flex-1">
                <div className={cn("truncate font-medium", m.status === "completed" && "line-through opacity-60")}>{mealName(m, locale)}</div>
                <div className="text-sm text-muted-foreground">
                  {showDate && <span className="capitalize">{fmt.format(parseDate(m.date))} · </span>}
                  {ts(m.slot)}
                </div>
              </div>
              {m.status === "proposed" && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">{t("proposed")}</span>}
              {m.status === "completed" && <span className="text-xs text-primary">✓</span>}
            </button>
          </li>
        ))}
      </ul>
      <MealActionsDrawer meal={selected} today={today} isParent={isParent} onClose={() => setSelected(null)} onEdit={(m) => router.push(`/calendar?date=${m.date}`)} />
    </>
  );
}
