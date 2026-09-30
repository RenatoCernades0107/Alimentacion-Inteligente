"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { mealKcal } from "@/lib/meals";
import { dayProgress } from "@/lib/portions";
import type { Meal } from "@/lib/types";
import { cn } from "@/lib/utils";

type GoalMeal = Pick<Meal, "slot" | "status" | "recipe" | "custom_items" | "kcal_per_serving">;

/**
 * Barra de progreso de la meta de kcal del día de quien mira: suma su porción en cada comida planificada
 * (y separa lo ya completado). Al 100 % el plan del día cubre su meta; pasado el 110 % se pinta de ámbar.
 */
export function DayGoal({
  meals,
  myKcal,
  state,
  canEdit,
  mealsPerDay,
}: {
  /** Comidas del día (las propuestas y canceladas no cuentan). */
  meals: GoalMeal[];
  myKcal: number | null;
  state: "ok" | "incomplete" | "infant";
  /** Puede completar sus propios datos (los hijos menores no: los completa un padre). */
  canEdit: boolean;
  mealsPerDay: number;
}) {
  const t = useTranslations("dayGoal");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale);

  if (state === "infant") return null;

  if (!myKcal) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed bg-card p-3 text-sm">
        <p className="min-w-0 flex-1 text-muted-foreground">{canEdit ? t("complete") : t("parentsHint")}</p>
        {canEdit && (
          <Link href="/weight" className="shrink-0 font-medium text-primary">
            {t("completeAction")} →
          </Link>
        )}
      </div>
    );
  }

  const p = dayProgress({
    targetKcal: myKcal,
    mealsPerDay,
    meals: meals.map((m) => ({ slot: m.slot, status: m.status, kcalPerServing: mealKcal(m)?.kcal ?? null })),
  });

  // La barra llega al 100 % en la meta; si se pasa, la escala se amplía y una marca señala dónde estaba la meta.
  const scale = Math.max(p.target, p.total);
  const pct = (kcal: number) => `${(kcal / scale) * 100}%`;
  const over = p.status === "over";
  const percent = Math.round(p.ratio * 100);

  const message =
    p.status === "empty"
      ? t("empty")
      : p.status === "low"
        ? t("low", { kcal: nf.format(p.gap) })
        : p.status === "ok"
          ? t("ok")
          : t("over", { kcal: nf.format(p.gap) });

  return (
    <section className="mt-4 rounded-2xl border bg-card p-3" aria-label={t("title")}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{t("of", { total: nf.format(p.total), target: nf.format(p.target) })}</span>
      </div>

      <div
        role="progressbar"
        aria-label={t("progress", { percent })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
        className="relative mt-2 h-3 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("absolute inset-y-0 left-0", over ? "bg-amber-600" : "bg-primary")} style={{ width: pct(p.completed) }} />
        <div
          className={cn("absolute inset-y-0", over ? "bg-amber-400/70" : "bg-primary/35")}
          style={{ left: pct(p.completed), width: pct(p.planned) }}
        />
        {over && <span aria-hidden className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: pct(p.target) }} />}
      </div>

      {p.completed > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-full", over ? "bg-amber-600" : "bg-primary")} />
            {t("done")} {nf.format(p.completed)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-full", over ? "bg-amber-400/70" : "bg-primary/35")} />
            {t("planned")} {nf.format(p.planned)}
          </span>
        </div>
      )}

      <p aria-live="polite" className={cn("mt-1.5 text-sm font-medium", over && "text-amber-700 dark:text-amber-400", p.status === "ok" && "text-primary")}>
        {message}
      </p>
      {p.unknown > 0 && <p className="text-xs text-muted-foreground">{t("unknown", { count: p.unknown })}</p>}
    </section>
  );
}
