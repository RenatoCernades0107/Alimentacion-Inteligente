"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { MealDrawer, type MealDraft, type RecipeOption } from "@/components/meals/meal-drawer";
import { MealActionsDrawer } from "@/components/meals/meal-actions";
import { RecipeImage } from "@/components/recipe-image";
import { addDays, parseDate } from "@/lib/dates";
import { mealName, type Meal, type MealSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CalendarView({
  date, today, weekStart, meals, recipes, slots, isParent,
}: {
  date: string;
  today: string;
  weekStart: string;
  meals: Meal[];
  recipes: RecipeOption[];
  slots: MealSlot[];
  isParent: boolean;
}) {
  const t = useTranslations("calendar");
  const ts = useTranslations("slots");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [selected, setSelected] = useState<Meal | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const longFmt = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const dayMeals = meals.filter((m) => m.date === date);
  const hasMeals = new Set(meals.map((m) => m.date));

  return (
    <>
      <div className="flex items-center gap-1">
        <Link href={`/calendar?date=${addDays(weekStart, -7)}`} scroll={false} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="prev">
          <ChevronLeft />
        </Link>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {days.map((d) => (
            <Link
              key={d}
              href={`/calendar?date=${d}`}
              scroll={false}
              className={cn(
                "flex flex-col items-center rounded-xl py-1.5 text-xs",
                d === date ? "bg-primary text-primary-foreground" : d === today ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="capitalize">{dayFmt.format(parseDate(d)).slice(0, 3)}</span>
              <span className="text-base font-semibold">{parseDate(d).getUTCDate()}</span>
              <span className={cn("size-1 rounded-full", hasMeals.has(d) ? (d === date ? "bg-primary-foreground" : "bg-primary") : "bg-transparent")} />
            </Link>
          ))}
        </div>
        <Link href={`/calendar?date=${addDays(weekStart, 7)}`} scroll={false} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="next">
          <ChevronRight />
        </Link>
      </div>

      <h2 className="mt-4 text-lg font-semibold capitalize">
        {date === today ? `${tc("today")} · ` : ""}
        {longFmt.format(parseDate(date))}
      </h2>

      <div className="mt-3 space-y-3">
        {slots.map((slot) => {
          const items = dayMeals.filter((m) => m.slot === slot);
          return (
            <div key={slot} className="rounded-2xl border bg-card p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">{ts(slot)}</h3>
                <Button variant="ghost" size="icon-sm" onClick={() => setDraft({ date, slot })} aria-label={t("addMeal")}>
                  <Plus />
                </Button>
              </div>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground/70">{t("empty")}</p>
              ) : (
                <ul className="mt-1 space-y-1.5">
                  {items.map((m) => (
                    <li key={m.id}>
                      <button
                        onClick={() => setSelected(m)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left active:bg-muted",
                          m.status === "proposed" && "border border-dashed border-amber-400 bg-amber-50",
                          m.status === "completed" && "opacity-60",
                        )}
                      >
                        <RecipeImage src={m.recipe?.image_url} emoji={m.recipe?.emoji} className="size-8 rounded-lg text-xl" />
                        <span className={cn("flex-1 font-medium", m.status === "completed" && "line-through")}>{mealName(m, locale)}</span>
                        {m.series_id && <Repeat className="size-3.5 text-muted-foreground" />}
                        {m.status === "proposed" && <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-900">{t("proposed")}</span>}
                        {m.status === "completed" && <span className="text-xs text-primary">✓ {t("completed")}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {!isParent && <p className="mt-4 text-center text-sm text-muted-foreground">{t("childHint")}</p>}

      <MealDrawer draft={draft} onClose={() => setDraft(null)} recipes={recipes} slots={slots} isParent={isParent} />
      <MealActionsDrawer
        meal={selected}
        today={today}
        isParent={isParent}
        onClose={() => setSelected(null)}
        onEdit={(m) => {
          setSelected(null);
          setDraft({ id: m.id, seriesId: m.series_id, date: m.date, slot: m.slot, recipeId: m.recipe_id, title: m.title, recurrence: m.series?.recurrence ?? null });
        }}
      />
    </>
  );
}
