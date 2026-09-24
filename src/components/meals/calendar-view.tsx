"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { enUS, es } from "react-day-picker/locale";
import { Apple, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Coffee, Cookie, Moon, Plus, Repeat, Soup, type LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MealDrawer, type MealDraft, type RecipeOption } from "@/components/meals/meal-drawer";
import { MealActionsDrawer } from "@/components/meals/meal-actions";
import { RecipeImage } from "@/components/recipe-image";
import { addDays, parseDate } from "@/lib/dates";
import { mealName, type Meal, type MealSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Icono y color de cada franja del día. */
const SLOT_STYLE: Record<MealSlot, { icon: LucideIcon; chip: string }> = {
  breakfast: { icon: Coffee, chip: "bg-amber-100 text-amber-700" },
  morning_snack: { icon: Apple, chip: "bg-lime-100 text-lime-700" },
  lunch: { icon: Soup, chip: "bg-orange-100 text-orange-700" },
  afternoon_snack: { icon: Cookie, chip: "bg-pink-100 text-pink-700" },
  dinner: { icon: Moon, chip: "bg-indigo-100 text-indigo-700" },
};

/** Fecha YYYY-MM-DD ↔ Date local (react-day-picker trabaja en hora local). */
const toLocal = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fromLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function CalendarView({
  date, today, weekStart, meals, mealDates, recipes, slots, isParent,
}: {
  date: string;
  today: string;
  weekStart: string;
  meals: Meal[];
  mealDates: string[];
  recipes: RecipeOption[];
  slots: MealSlot[];
  isParent: boolean;
}) {
  const t = useTranslations("calendar");
  const ts = useTranslations("slots");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [selected, setSelected] = useState<Meal | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = (d: string) => router.push(`/calendar?date=${d}`, { scroll: false });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const longFmt = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const dayMeals = meals.filter((m) => m.date === date);
  const plannedSlots = slots.filter((s) => dayMeals.some((m) => m.slot === s)).length;
  const onToday = date === today;

  return (
    <>
      {/* Mes + salto rápido a cualquier fecha */}
      <div className="flex items-center justify-between">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger className="-ml-2 inline-flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-base font-semibold active:bg-muted">
            <CalendarDays className="size-4 text-primary" />
            <span className="first-letter:uppercase">{monthFmt.format(parseDate(date))}</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <Calendar
              mode="single"
              locale={locale === "en" ? enUS : es}
              weekStartsOn={1}
              selected={toLocal(date)}
              defaultMonth={toLocal(date)}
              onSelect={(d) => {
                if (!d) return;
                setPickerOpen(false);
                go(fromLocal(d));
              }}
              modifiers={{ hasMeals: mealDates.map(toLocal) }}
              modifiersClassNames={{
                hasMeals: "after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
              }}
              className="[--cell-size:--spacing(10)]"
            />
          </PopoverContent>
        </Popover>
        {!onToday && (
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => go(today)}>
            {tc("today")}
          </Button>
        )}
      </div>

      {/* Tira de la semana (también se cambia deslizando) */}
      <div
        className="mt-2 flex items-center gap-0.5 rounded-3xl bg-gradient-to-br from-emerald-50 to-lime-50 p-1.5 ring-1 ring-emerald-100"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(addDays(date, dx < 0 ? 7 : -7));
        }}
      >
        <Link href={`/calendar?date=${addDays(date, -7)}`} scroll={false} className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "rounded-full text-emerald-700")} aria-label={t("prevWeek")}>
          <ChevronLeft />
        </Link>
        <div className="grid flex-1 grid-cols-7 gap-0.5">
          {days.map((d) => {
            const isSel = d === date;
            const count = meals.filter((m) => m.date === d).length;
            return (
              <Link
                key={d}
                href={`/calendar?date=${d}`}
                scroll={false}
                aria-current={isSel ? "date" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-2xl py-2 transition-all",
                  isSel ? "bg-primary text-primary-foreground shadow-md shadow-primary/30" : "text-foreground active:bg-white/70",
                )}
              >
                <span className={cn("text-[11px] font-medium capitalize", !isSel && "text-muted-foreground")}>
                  {dayFmt.format(parseDate(d)).replace(".", "").slice(0, 3)}
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-base font-bold",
                    d === today && !isSel && "bg-white text-primary ring-2 ring-primary",
                  )}
                >
                  {parseDate(d).getUTCDate()}
                </span>
                <span className="flex h-1.5 gap-0.5">
                  {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                    <span key={i} className={cn("size-1.5 rounded-full", isSel ? "bg-primary-foreground" : "bg-primary")} />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
        <Link href={`/calendar?date=${addDays(date, 7)}`} scroll={false} className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "rounded-full text-emerald-700")} aria-label={t("nextWeek")}>
          <ChevronRight />
        </Link>
      </div>

      {/* Resumen del día */}
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          {onToday && <p className="text-xs font-semibold tracking-wide text-primary uppercase">{tc("today")}</p>}
          <h2 className="text-xl font-bold first-letter:uppercase">{longFmt.format(parseDate(date))}</h2>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground">{t("plannedCount", { done: plannedSlots, total: slots.length })}</span>
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${(plannedSlots / slots.length) * 100}%` }} />
          </span>
        </div>
      </div>

      {/* Línea de tiempo por franja */}
      <ol className="relative mt-4 space-y-4 before:absolute before:top-4 before:bottom-4 before:left-[15px] before:w-0.5 before:rounded-full before:bg-border">
        {slots.map((slot) => {
          const items = dayMeals.filter((m) => m.slot === slot);
          const { icon: Icon, chip } = SLOT_STYLE[slot];
          return (
            <li key={slot} className="relative pl-11">
              <span className={cn("absolute top-0 left-0 flex size-8 items-center justify-center rounded-full ring-4 ring-background", chip)}>
                <Icon className="size-4" />
              </span>
              <div className="flex h-8 items-center justify-between">
                <h3 className="text-sm font-semibold">{ts(slot)}</h3>
                {items.length > 0 && (
                  <Button variant="ghost" size="icon-sm" className="rounded-full text-muted-foreground" onClick={() => setDraft({ date, slot })} aria-label={t("addMeal")}>
                    <Plus />
                  </Button>
                )}
              </div>

              {items.length === 0 ? (
                <button
                  onClick={() => setDraft({ date, slot })}
                  className="mt-1 flex w-full items-center gap-2 rounded-2xl border-2 border-dashed border-muted-foreground/20 px-3 py-3 text-sm text-muted-foreground transition-colors active:border-primary/40 active:bg-primary/5"
                >
                  <Plus className="size-4" />
                  {isParent ? t("addTo", { slot: ts(slot).toLowerCase() }) : t("proposeMeal")}
                </button>
              ) : (
                <ul className="mt-1 space-y-2">
                  {items.map((m) => (
                    <li key={m.id}>
                      <button
                        onClick={() => setSelected(m)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border bg-card p-2 pr-3 text-left shadow-sm transition-transform active:scale-[0.98]",
                          m.status === "proposed" && "border-dashed border-amber-300 bg-amber-50/70",
                        )}
                      >
                        <span className="relative">
                          <RecipeImage src={m.recipe?.image_url} emoji={m.recipe?.emoji} className={cn("size-14 rounded-xl text-2xl", m.status === "completed" && "opacity-50")} />
                          {m.status === "completed" && (
                            <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
                              <Check className="size-3" strokeWidth={3} />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate font-semibold", m.status === "completed" && "text-muted-foreground line-through")}>
                            {mealName(m, locale)}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            {m.status === "proposed" && <span className="rounded-full bg-amber-200 px-2 py-0.5 font-medium text-amber-900">{t("proposed")}</span>}
                            {m.status === "completed" && <span className="font-medium text-primary">{t("completed")}</span>}
                            {m.series_id && (
                              <span className="inline-flex items-center gap-1">
                                <Repeat className="size-3" /> {t("repeats")}
                              </span>
                            )}
                          </span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>

      {!isParent && <p className="mt-6 rounded-2xl bg-muted/60 p-3 text-center text-sm text-muted-foreground">{t("childHint")}</p>}

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
