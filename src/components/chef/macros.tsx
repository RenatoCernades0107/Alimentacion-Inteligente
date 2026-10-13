"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Colores de cada macro (los mismos en tarjetas, barras y leyendas). */
export const MACRO_COLOR = {
  protein: { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", soft: "bg-rose-100 dark:bg-rose-950/50" },
  carbs: { bar: "bg-amber-400", text: "text-amber-600 dark:text-amber-400", soft: "bg-amber-100 dark:bg-amber-950/50" },
  fat: { bar: "bg-sky-500", text: "text-sky-600 dark:text-sky-400", soft: "bg-sky-100 dark:bg-sky-950/50" },
} as const;

type MacroGrams = { protein: number | null; carbs: number | null; fat: number | null };

/** Barra apilada con la parte de las kcal que aporta cada macro, y los gramos debajo. */
export function MacroStack({ macros, className, light }: { macros: MacroGrams; className?: string; light?: boolean }) {
  const t = useTranslations("chef");
  if (macros.protein == null || macros.carbs == null || macros.fat == null) return null;
  const k = { protein: macros.protein * 4, carbs: macros.carbs * 4, fat: macros.fat * 9 };
  const total = k.protein + k.carbs + k.fat || 1;
  const keys = ["protein", "carbs", "fat"] as const;
  return (
    <div className={className}>
      <div className={cn("flex h-1.5 overflow-hidden rounded-full", light ? "bg-white/25" : "bg-muted")}>
        {keys.map((m) => (
          <span key={m} className={MACRO_COLOR[m].bar} style={{ width: `${(k[m] / total) * 100}%` }} />
        ))}
      </div>
      <div className={cn("mt-1.5 flex justify-between text-xs font-medium tabular-nums", light ? "text-white/90" : "text-muted-foreground")}>
        {keys.map((m) => (
          <span key={m} className="inline-flex items-center gap-1">
            <span className={cn("size-2 rounded-full", MACRO_COLOR[m].bar)} />
            {macros[m]} g {t(`macro.${m}`)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Anillo de progreso de kcal del día (planificado vs. meta). */
export function KcalRing({ value, target, size = 64 }: { value: number; target: number; size?: number }) {
  const t = useTranslations("chef");
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = target ? value / target : 0;
  const over = pct > 1.1;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={6} className="fill-none stroke-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(pct, 1))}
          className={cn("fill-none transition-[stroke-dashoffset] duration-700 ease-out", over ? "stroke-orange-500" : "stroke-primary")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-sm font-bold tabular-nums">{value}</span>
        <span className="text-[10px] text-muted-foreground">{t("ofKcal", { target })}</span>
      </div>
    </div>
  );
}

/** Barras de cada macro del día frente a su meta. */
export function MacroTargets({ totals, targets }: { totals: { protein: number; carbs: number; fat: number }; targets: { protein: number; carbs: number; fat: number } }) {
  const t = useTranslations("chef");
  return (
    <div className="grid flex-1 gap-1.5">
      {(["protein", "carbs", "fat"] as const).map((m) => {
        const pct = targets[m] ? totals[m] / targets[m] : 0;
        return (
          <div key={m} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t(`macro.${m}Long`)}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span className={cn("block h-full rounded-full transition-[width] duration-700 ease-out", MACRO_COLOR[m].bar)} style={{ width: `${Math.min(pct, 1) * 100}%` }} />
            </span>
            <span className="tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{totals[m]}</span>/{targets[m]} g
            </span>
          </div>
        );
      })}
    </div>
  );
}
