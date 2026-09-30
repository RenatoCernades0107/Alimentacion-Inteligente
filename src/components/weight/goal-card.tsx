"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GoalSlider, formatKg } from "@/components/weight/goal-slider";
import { setGoal } from "@/app/actions/body";
import { PACES, planAdult, type Activity, type Pace, type Sex } from "@/lib/body";
import { addDays, parseDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Meta de peso de un adulto: slider, ritmo y el plan (kcal al día y plazo) que resulta. */
export function GoalCard({
  bodyId,
  sex,
  years,
  cm,
  activity,
  savedGoalKg,
  savedPace,
  currentKg,
  canEdit,
  today,
}: {
  bodyId: string;
  sex: Sex;
  years: number;
  cm: number;
  activity: Activity;
  savedGoalKg: number | null;
  savedPace: Pace;
  /** Peso tendencia actual. */
  currentKg: number;
  canEdit: boolean;
  today: string;
}) {
  const t = useTranslations("weight");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [pending, start] = useTransition();

  const [goal, setGoalKg] = useState(savedGoalKg ?? currentKg);
  const [pace, setPace] = useState<Pace>(savedPace);

  const plan = useMemo(
    () => planAdult({ sex, years, cm, kg: currentKg, goalKg: goal, activity, pace }),
    [sex, years, cm, currentKg, goal, activity, pace],
  );
  const fmt = (n: number) => formatKg(n, locale);
  const dirty = pace !== savedPace || (savedGoalKg === null ? plan.direction !== "maintain" : Math.abs(goal - savedGoalKg) > 0.01);

  const save = (next: number | null) =>
    start(async () => {
      try {
        const res = await setGoal(bodyId, next, pace);
        if (!res.ok) {
          toast.error(tc("error"));
          return;
        }
        if (res.goalKg !== null) setGoalKg(res.goalKg);
        toast.success(t("goalSaved"));
      } catch {
        toast.error(tc("error"));
      }
    });

  const paceLabel: Record<Pace, string> = { gentle: t("paceGentle"), recommended: t("paceRecommended"), fast: t("paceFast") };
  const dateLabel = (weeks: number) =>
    new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(parseDate(addDays(today, weeks * 7)));

  return (
    <div className="space-y-5 rounded-2xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{t("goalHelp")}</p>

      <GoalSlider cm={cm} years={years} currentKg={currentKg} value={goal} onChange={setGoalKg} disabled={!canEdit || pending} />

      {canEdit && (
        <div className="space-y-2">
          <div className="text-sm font-medium">{t("pace")}</div>
          <div role="radiogroup" aria-label={t("pace")} className="grid grid-cols-3 gap-2">
            {PACES.filter((p) => !(p === "fast" && years >= 65)).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={pace === p}
                disabled={pending || plan.direction === "maintain"}
                onClick={() => setPace(p)}
                className={cn(
                  "h-10 rounded-lg border text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                  pace === p ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {paceLabel[p]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm" aria-live="polite">
        <div className="font-medium">{t("planTitle")}</div>
        {plan.direction === "maintain" ? (
          <p>{t("planMaintain", { kcal: plan.kcal.toLocaleString(locale) })}</p>
        ) : (
          <>
            <p className="text-lg font-semibold tabular-nums">{t("planKcal", { kcal: plan.kcal.toLocaleString(locale) })}</p>
            <p className="text-muted-foreground">{t("planRate", { kg: fmt(plan.weeklyKg) })}</p>
            <p className="text-muted-foreground">
              {plan.weeks !== null ? t("planWeeks", { weeks: plan.weeks, date: dateLabel(plan.weeks) }) : t("planLong")}
            </p>
            {plan.milestoneKg !== null && <p className="text-muted-foreground">{t("planMilestone", { kg: fmt(plan.milestoneKg) })}</p>}
            {plan.capped === "floor" && <p className="text-amber-700 dark:text-amber-400">{t("planCapFloor")}</p>}
            {plan.capped === "deficit25" && <p className="text-muted-foreground">{t("planCapDeficit")}</p>}
            {plan.capped === "surplus500" && <p className="text-muted-foreground">{t("planCapSurplus")}</p>}
            {plan.capped === "senior" && <p className="text-muted-foreground">{t("planCapSenior")}</p>}
          </>
        )}
        <p className="pt-1 text-xs text-muted-foreground">{t("planRecalc")}</p>
      </div>

      {canEdit && (
        <div className="space-y-2">
          <Button className="h-11 w-full text-base" disabled={pending || !dirty} onClick={() => save(plan.direction === "maintain" ? null : (plan.goalKg ?? goal))}>
            {t("goalSave")}
          </Button>
          {savedGoalKg !== null && (
            <Button variant="ghost" className="w-full" disabled={pending} onClick={() => save(null)}>
              {t("goalRemove")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
