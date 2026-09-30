"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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
import { saveBody } from "@/app/actions/body";
import { ACTIVITIES, SEXES, bmi as bmiOf, type Activity, type Sex } from "@/lib/body";
import { cn } from "@/lib/utils";

export type BodyInitial = {
  sex: Sex | null;
  birthDate: string | null;
  heightCm: number | null;
  activity: Activity;
};

const ACTIVITY_KEY: Record<Activity, "activitySedentary" | "activityLight" | "activityModerate" | "activityActive" | "activityVeryActive"> = {
  sedentary: "activitySedentary",
  light: "activityLight",
  moderate: "activityModerate",
  active: "activityActive",
  very_active: "activityVeryActive",
};
const ACTIVITY_HINT: Record<Activity, "activitySedentaryHint" | "activityLightHint" | "activityModerateHint" | "activityActiveHint" | "activityVeryActiveHint"> = {
  sedentary: "activitySedentaryHint",
  light: "activityLightHint",
  moderate: "activityModerateHint",
  active: "activityActiveHint",
  very_active: "activityVeryActiveHint",
};

/**
 * Datos corporales de una persona (sexo, nacimiento, estatura, actividad y, la primera vez, el peso
 * actual). Muestra un resumen y el formulario se abre al editar o cuando faltan datos.
 */
export function BodyCard({
  profileId,
  dependentId,
  initial,
  needsWeight,
  canEdit,
  today,
  summary,
}: {
  profileId?: string | null;
  dependentId?: string | null;
  initial: BodyInitial;
  /** Todavía no hay ningún pesaje: se pide el peso actual. */
  needsWeight: boolean;
  canEdit: boolean;
  today: string;
  /** Texto del resumen (edad, estatura, actividad) ya armado por el servidor. */
  summary: string;
}) {
  const t = useTranslations("weight");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [pending, start] = useTransition();

  const complete = !!initial.sex && !!initial.birthDate && !!initial.heightCm && !needsWeight;
  // Solo quien puede editar ve el formulario; los demás ven el resumen (o que faltan datos).
  const [open, setOpen] = useState(canEdit && !complete);

  const [sex, setSex] = useState<Sex | null>(initial.sex);
  const [birth, setBirth] = useState(initial.birthDate ?? "");
  const [height, setHeight] = useState(initial.heightCm ? String(initial.heightCm) : "");
  const [activity, setActivity] = useState<Activity>(initial.activity);
  const [weight, setWeight] = useState("");
  const [confirm, setConfirm] = useState<{ bmi: number } | null>(null);

  function submit(confirmed = false) {
    if (!sex) return;
    const heightCm = Number(height.replace(",", "."));
    const weightKg = needsWeight && weight ? Number(weight.replace(",", ".")) : null;
    start(async () => {
      try {
        const res = await saveBody({ profileId, dependentId, sex, birthDate: birth, heightCm, activity, weightKg, confirm: confirmed });
        if (!res.ok) {
          if (res.error === "implausible" && weightKg) setConfirm({ bmi: Math.round(bmiOf(weightKg, heightCm) * 10) / 10 });
          else toast.error(res.error === "invalid" ? t("invalidBirth") : tc("error"));
          return;
        }
        setConfirm(null);
        setOpen(false);
        toast.success(t("dataSaved"));
      } catch {
        toast.error(tc("error"));
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border bg-card p-4">
        <p className="min-w-0 flex-1 text-sm">{complete || canEdit ? summary : t("dataIncompleteBody")}</p>
        {canEdit && (
          <Button variant="ghost" size="sm" className="-mt-1 -mr-2 h-8" onClick={() => setOpen(true)}>
            <Pencil /> {t("dataEdit")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4 rounded-2xl border bg-card p-4"
    >
      {!complete && (
        <div>
          <div className="font-medium">{t("dataIncompleteTitle")}</div>
          <p className="text-sm text-muted-foreground">{t("dataIncompleteBody")}</p>
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("sex")}</legend>
        <div role="radiogroup" aria-label={t("sex")} className="grid grid-cols-2 gap-2">
          {SEXES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sex === s}
              onClick={() => setSex(s)}
              className={cn(
                "h-11 rounded-lg border text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                sex === s ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
              )}
            >
              {s === "female" ? t("female") : t("male")}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="body-birth">{t("birthDate")}</Label>
          <Input id="body-birth" type="date" required value={birth} min="1900-01-01" max={today} onChange={(e) => setBirth(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="body-height">{t("height")}</Label>
          <Input id="body-height" type="number" inputMode="decimal" step="0.1" min={45} max={230} required value={height} onChange={(e) => setHeight(e.target.value)} className="h-10" />
        </div>
      </div>

      {needsWeight && (
        <div className="space-y-1.5">
          <Label htmlFor="body-weight">{t("weightCurrent")}</Label>
          <Input id="body-weight" type="number" inputMode="decimal" step="0.1" min={2} max={400} required value={weight} onChange={(e) => setWeight(e.target.value)} className="h-10" />
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("activity")}</legend>
        <div role="radiogroup" aria-label={t("activity")} className="space-y-2">
          {ACTIVITIES.map((a) => (
            <label
              key={a}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                activity === a ? "border-primary bg-primary/5" : "hover:bg-muted/60",
              )}
            >
              <input type="radio" name="activity" value={a} checked={activity === a} onChange={() => setActivity(a)} className="mt-1 size-4 accent-[var(--primary)]" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t(ACTIVITY_KEY[a])}</span>
                <span className="block text-xs text-muted-foreground">{t(ACTIVITY_HINT[a])}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2">
        {complete && (
          <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => setOpen(false)}>
            {tc("cancel")}
          </Button>
        )}
        <Button type="submit" className="h-11 flex-1 text-base" disabled={pending || !sex || !birth || !height || (needsWeight && !weight)}>
          {t("saveData")}
        </Button>
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmBody", { bmi: confirm ? new Intl.NumberFormat(locale).format(confirm.bmi) : "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => submit(true)}>{t("confirmYes")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
