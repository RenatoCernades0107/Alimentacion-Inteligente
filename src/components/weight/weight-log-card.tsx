"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WeightChart } from "@/components/weight/weight-chart";
import { formatKg } from "@/components/weight/goal-slider";
import { addWeight, deleteWeight } from "@/app/actions/body";
import { bmi as bmiOf } from "@/lib/body";
import { parseDate } from "@/lib/dates";
import type { WeightLog } from "@/lib/types";

const VISIBLE = 8;

export function WeightLogCard({
  bodyId,
  logs,
  goalKg,
  canEdit,
  today,
  askHeight,
  currentHeightCm,
}: {
  bodyId: string;
  /** En orden cronológico (del más antiguo al más reciente). */
  logs: WeightLog[];
  goalKg: number | null;
  canEdit: boolean;
  today: string;
  /** Pide también la estatura en cada pesaje (menores, que crecen). */
  askHeight: boolean;
  currentHeightCm: number | null;
}) {
  const t = useTranslations("weight");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [pending, start] = useTransition();

  const last = logs[logs.length - 1];
  const [kg, setKg] = useState(last ? String(last.weight_kg) : "");
  const [on, setOn] = useState(today);
  const [cm, setCm] = useState(askHeight && currentHeightCm ? String(currentHeightCm) : "");
  const [confirm, setConfirm] = useState<{ bmi: number } | null>(null);
  const [toDelete, setToDelete] = useState<WeightLog | null>(null);
  const [showAll, setShowAll] = useState(false);

  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const points = logs.map((l) => ({ on: l.logged_on, kg: Number(l.weight_kg) }));
  const desc = [...logs].reverse();
  const shown = showAll ? desc : desc.slice(0, VISIBLE);

  function submit(confirmed = false) {
    const weight = Number(kg.replace(",", "."));
    const height = cm.trim() ? Number(cm.replace(",", ".")) : null;
    start(async () => {
      try {
        const res = await addWeight(bodyId, on, weight, height, confirmed);
        if (!res.ok) {
          if (res.error === "implausible") {
            const h = height ?? currentHeightCm ?? 0;
            setConfirm({ bmi: h ? Math.round(bmiOf(weight, h) * 10) / 10 : 0 });
          } else {
            toast.error(tc("error"));
          }
          return;
        }
        setConfirm(null);
        toast.success(t("logSaved"));
      } catch {
        toast.error(tc("error"));
      }
    });
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3"
        >
          <div className={askHeight ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-3"}>
            <div className="space-y-1.5">
              <Label htmlFor="log-kg">{t("logWeight")}</Label>
              <Input id="log-kg" type="number" inputMode="decimal" step="0.1" min={2} max={400} required value={kg} onChange={(e) => setKg(e.target.value)} className="h-10" />
            </div>
            {askHeight && (
              <div className="space-y-1.5">
                <Label htmlFor="log-cm">{t("logHeight")}</Label>
                <Input id="log-cm" type="number" inputMode="decimal" step="0.1" min={45} max={230} value={cm} onChange={(e) => setCm(e.target.value)} className="h-10" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="log-on">{t("logDate")}</Label>
              <Input id="log-on" type="date" required value={on} max={today} onChange={(e) => setOn(e.target.value)} className="h-10" />
            </div>
          </div>
          <Button type="submit" className="h-10 w-full" disabled={pending || !kg}>
            {t("logAdd")}
          </Button>
        </form>
      )}

      {logs.length >= 2 ? (
        <div>
          <h3 className="mb-1 text-sm font-medium text-muted-foreground">{t("logChart")}</h3>
          <WeightChart logs={points} goalKg={goalKg} locale={locale} label={t("logChart")} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{logs.length ? t("logNeedMore") : t("logEmpty")}</p>
      )}

      {shown.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {shown.map((l, i) => {
            const previous = desc[desc.indexOf(l) + 1];
            const diff = previous ? Number(l.weight_kg) - Number(previous.weight_kg) : null;
            return (
              <li key={l.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 text-muted-foreground">{dateFmt.format(parseDate(l.logged_on))}</span>
                {diff !== null && Math.abs(diff) >= 0.05 && (
                  <span className={diff < 0 ? "text-emerald-600 tabular-nums dark:text-emerald-400" : "text-muted-foreground tabular-nums"}>
                    {diff > 0 ? "+" : "−"}
                    {formatKg(Math.abs(diff), locale)}
                  </span>
                )}
                <span className={i === 0 ? "font-semibold tabular-nums" : "tabular-nums"}>{formatKg(Number(l.weight_kg), locale)} kg</span>
                {canEdit && (
                  <Button variant="ghost" size="icon" className="-mr-1 size-8" aria-label={t("logDelete", { date: dateFmt.format(parseDate(l.logged_on)) })} onClick={() => setToDelete(l)}>
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {desc.length > VISIBLE && (
        <Button variant="ghost" className="h-9 w-full text-muted-foreground" onClick={() => setShowAll((v) => !v)}>
          {showAll ? t("logShowLess") : t("logShowAll", { count: desc.length })}
        </Button>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmBody", { bmi: confirm?.bmi ?? 0 })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit(true)}>{t("confirmYes")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toDelete ? t("logDelete", { date: dateFmt.format(parseDate(toDelete.logged_on)) }) : ""}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    if (toDelete) await deleteWeight(toDelete.id);
                    setToDelete(null);
                  } catch {
                    toast.error(tc("error"));
                  }
                })
              }
            >
              {tc("delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
