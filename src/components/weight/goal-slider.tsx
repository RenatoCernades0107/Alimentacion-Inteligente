"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Slider } from "@base-ui/react/slider";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { healthyRangeKg, sliderScale, type BmiClass } from "@/lib/body";
import { cn } from "@/lib/utils";

/** Resolución interna del control: posición 0–1000 sobre la escala por tramos. */
const RES = 1000;

const ZONE_COLOR: Record<BmiClass, string> = {
  under: "bg-sky-300 dark:bg-sky-700",
  healthy: "bg-emerald-400 dark:bg-emerald-600",
  over: "bg-amber-300 dark:bg-amber-600",
  obese: "bg-rose-400 dark:bg-rose-700",
};

export function formatKg(n: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: n % 1 ? 1 : 0, maximumFractionDigits: 1 }).format(n);
}

/**
 * Control de la meta de peso. Es una barra con zonas de color (bajo peso ← saludable → sobrepeso) donde
 * el peso recomendado queda siempre en el centro. La meta no puede caer bajo el mínimo saludable, ni
 * subir por encima del peso actual si ya hay sobrepeso (esa zona se muestra atenuada).
 */
export function GoalSlider({
  cm,
  years,
  currentKg,
  value,
  onChange,
  disabled,
}: {
  cm: number;
  years: number;
  /** Peso actual (tendencia). */
  currentKg: number;
  /** Meta elegida, en kg. */
  value: number;
  onChange: (kg: number) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("weight");
  const locale = useLocale();
  const scale = useMemo(() => sliderScale({ cm, years, kg: currentKg }), [cm, years, currentKg]);
  const healthy = useMemo(() => healthyRangeKg(cm, years), [cm, years]);
  const clampKg = (kg: number) => Math.min(scale.goalMaxKg, Math.max(scale.goalMinKg, kg));

  const kg = clampKg(value);
  const pos = Math.round(scale.toPos(kg) * RES);
  const pct = (x: number) => `${scale.toPos(x) * 100}%`;
  const fmt = (n: number) => formatKg(n, locale);

  const change = kg < currentKg - 0.25 ? t("goalLose", { kg: fmt(currentKg - kg) }) : kg > currentKg + 0.25 ? t("goalGain", { kg: fmt(kg - currentKg) }) : t("goalKeep");

  const handle = (next: number, reason: string) => {
    const delta = next - pos;
    // Teclado: cada flecha mueve 0.5 kg y Re Pág/Av Pág 2.5 kg; Inicio/Fin saltan a los extremos.
    if (reason === "keyboard" && Math.abs(delta) <= 10) {
      onChange(clampKg(kg + Math.sign(delta) * (Math.abs(delta) >= 10 ? 2.5 : 0.5)));
    } else {
      onChange(clampKg(scale.toKg(next / RES)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="icon" className="size-11 shrink-0 rounded-full" aria-label={t("goalLower")} disabled={disabled || kg <= scale.goalMinKg} onClick={() => onChange(clampKg(kg - 0.5))}>
          <Minus />
        </Button>
        <div className="min-w-0 text-center">
          <div className="text-4xl font-bold tracking-tight tabular-nums" aria-live="polite">
            {fmt(kg)} <span className="text-lg font-medium text-muted-foreground">kg</span>
          </div>
          <div className="text-sm text-muted-foreground">{change}</div>
        </div>
        <Button type="button" variant="outline" size="icon" className="size-11 shrink-0 rounded-full" aria-label={t("goalHigher")} disabled={disabled || kg >= scale.goalMaxKg} onClick={() => onChange(clampKg(kg + 0.5))}>
          <Plus />
        </Button>
      </div>

      <Slider.Root
        value={pos}
        min={0}
        max={RES}
        step={1}
        largeStep={10}
        disabled={disabled}
        onValueChange={(next, details) => handle(next, details.reason)}
        className="mx-4 pt-6"
      >
        <Slider.Control className="relative flex h-9 w-full touch-none items-center select-none data-disabled:opacity-60">
          <Slider.Track className="relative h-3.5 w-full overflow-hidden rounded-full">
            {scale.zones.map((z) => (
              <div key={z.key} className={cn("absolute inset-y-0", ZONE_COLOR[z.key])} style={{ left: `${z.from * 100}%`, width: `${(z.to - z.from) * 100}%` }} />
            ))}
            {/* Zonas donde la meta no puede quedar. */}
            <div className="absolute inset-y-0 left-0 bg-background/70" style={{ width: pct(scale.goalMinKg) }} />
            <div className="absolute inset-y-0 right-0 bg-background/70" style={{ width: `${100 - scale.toPos(scale.goalMaxKg) * 100}%` }} />
          </Slider.Track>

          {/* Marcas: peso recomendado (centro) y peso de hoy. */}
          <span aria-hidden className="pointer-events-none absolute top-1/2 h-6 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-foreground/60" style={{ left: "50%" }} />
          <span aria-hidden className="pointer-events-none absolute -top-5 -translate-x-1/2 text-[11px] leading-none font-medium whitespace-nowrap text-muted-foreground" style={{ left: pct(currentKg) }}>
            ▾ {t("goalToday")}
          </span>

          <Slider.Thumb
            getAriaLabel={() => t("goalLabel")}
            getAriaValueText={() => `${fmt(kg)} kg`}
            className="block size-8 rounded-full border-2 border-primary bg-background shadow-md outline-none transition-shadow after:absolute after:-inset-2 focus-visible:ring-4 focus-visible:ring-ring/50 data-dragging:ring-4 data-dragging:ring-ring/40"
          />
        </Slider.Control>
      </Slider.Root>

      <div className="mx-4 grid grid-cols-3 text-xs text-muted-foreground">
        <span>{t("goalUnder")}</span>
        <span className="text-center font-medium text-foreground">
          {t("goalRecommended")}
          <span className="block font-normal text-muted-foreground tabular-nums">{fmt(Math.round(scale.centerKg * 2) / 2)} kg</span>
        </span>
        <span className="text-right">{t("goalOver")}</span>
      </div>

      <p className="text-center text-xs text-muted-foreground">{t("goalRange", { min: fmt(healthy.minKg), max: fmt(healthy.maxKg) })}</p>
      {kg <= scale.goalMinKg && <p role="status" className="text-center text-xs font-medium text-amber-700 dark:text-amber-400">{t("goalBlocked", { kg: fmt(scale.goalMinKg) })}</p>}
    </div>
  );
}
