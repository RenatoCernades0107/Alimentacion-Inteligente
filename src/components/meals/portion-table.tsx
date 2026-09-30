"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Minus, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberAvatar } from "@/components/family/member-avatar";
import { MAX_SCALE, MIN_SCALE, formatPortion, suggestedScale } from "@/lib/nutrition";
import { formatQuantity } from "@/lib/units";
import type { PortionsData } from "@/lib/portions";

type Loaded = { mealId: string; data: PortionsData | null };

/** Escalas que se ofrecen: múltiplos de ¼. */
const STEP = 0.25;

/**
 * Tabla de porciones de una comida: cuánto le toca a cada integrante según su meta diaria, y cuánto cocinar.
 * Los datos se piden al abrir la comida; solo llegan kcal y porciones derivadas, nunca pesos ni metas.
 */
export function PortionTable({
  mealId,
  scale,
  canAdjust,
  onScale,
  busy,
}: {
  mealId: string;
  /** Multiplicador actual de los ingredientes (1 = como rinde la receta). */
  scale: number;
  /** Un padre puede cambiar cuántas porciones se cocinan. */
  canAdjust: boolean;
  onScale: (scale: number) => void;
  busy: boolean;
}) {
  const t = useTranslations("portions");
  const locale = useLocale();
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/meals/${mealId}/portions`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<PortionsData>) : Promise.reject(new Error(String(res.status)))))
      .then((data) => !cancelled && setLoaded({ mealId, data }))
      .catch(() => !cancelled && setLoaded({ mealId, data: null }));
    return () => {
      cancelled = true;
    };
  }, [mealId]);

  const state = loaded?.mealId === mealId ? loaded : null;
  const nf = new Intl.NumberFormat(locale);

  if (!state) return <Skeleton className="h-36 w-full rounded-2xl" aria-label={t("loading")} />;
  if (!state.data) return <p className="rounded-2xl border bg-card p-3 text-sm text-muted-foreground">{t("error")}</p>;

  const data = state.data;
  const rows = data.rows;
  const withPortion = rows.filter((r) => r.portion !== null);
  const totalKcal = withPortion.reduce((sum, r) => sum + (r.kcal ?? 0), 0);
  const cooking = data.recipeServings ? data.recipeServings * scale : null;
  const wanted = data.recipeServings && data.totalPortions > 0 ? suggestedScale(data.totalPortions, data.recipeServings) : null;
  const showSuggestion = canAdjust && wanted !== null && Math.abs(wanted - scale) > 1e-9;

  return (
    <section className="rounded-2xl border bg-card" aria-label={t("title")}>
      <div className="flex items-start justify-between gap-2 px-3 pt-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{t("title")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("share", { percent: Math.round(data.share * 100) })}
            {data.siblings > 1 && ` · ${t("shared", { count: data.siblings - 1 })}`}
          </p>
        </div>
        {data.kcalPerServing !== null && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
            {data.complete ? "" : "~"}
            {t("perServing", { kcal: nf.format(data.kcalPerServing) })}
          </span>
        )}
      </div>

      {data.kcalPerServing === null ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{t("noKcal")}</p>
      ) : (
        <table className="mt-1 w-full text-sm">
          <thead>
            <tr className="text-[11px] tracking-wide text-muted-foreground uppercase">
              <th scope="col" className="sr-only">{t("person")}</th>
              <th scope="col" className="px-2 pb-0.5 text-right font-medium">{t("portion")}</th>
              <th scope="col" className="pr-3 pb-0.5 text-right font-medium">{t("kcal")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="py-2 pl-3 text-left font-normal">
                  <div className="flex items-center gap-2.5">
                    <MemberAvatar member={{ full_name: r.name, avatar_url: r.avatarSrc }} className="size-8" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.name}</div>
                      {r.shortBy > 0 && <div className="text-xs text-muted-foreground">{t("short", { kcal: nf.format(r.shortBy) })}</div>}
                    </div>
                  </div>
                </th>
                {r.portion !== null ? (
                  <>
                    <td className="px-2 py-2 text-right text-base font-semibold tabular-nums">
                      {r.stale && <TriangleAlert className="mr-1 inline size-3.5 text-amber-600" aria-label={t("stale")} />}
                      {formatPortion(r.portion)}
                    </td>
                    <td className="py-2 pr-3 text-right text-muted-foreground tabular-nums">{nf.format(r.kcal ?? 0)}</td>
                  </>
                ) : (
                  <td colSpan={2} className="py-2 pr-3 text-right text-xs text-muted-foreground">
                    {r.state === "infant" ? (
                      t("infant")
                    ) : r.href ? (
                      <Link href={r.href} className="font-medium text-primary underline-offset-2 hover:underline">
                        {t("incomplete")}
                      </Link>
                    ) : (
                      t("incomplete")
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {withPortion.length > 1 && (
            <tfoot>
              <tr className="border-t bg-muted/40 text-sm font-medium">
                <th scope="row" className="py-2 pl-3 text-left">{t("total")}</th>
                <td className="px-2 py-2 text-right tabular-nums">{formatPortion(data.totalPortions)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{nf.format(totalKcal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}

      {(!data.complete || data.optionalKcal > 0) && data.kcalPerServing !== null && (
        <div className="space-y-0.5 px-3 pt-1 pb-2 text-xs text-muted-foreground">
          {!data.complete && <p>{t("approx")}</p>}
          {data.optionalKcal > 0 && <p>{t("optional", { kcal: nf.format(data.optionalKcal) })}</p>}
        </div>
      )}

      {cooking !== null && data.recipeServings && (
        <div className="space-y-2 border-t p-3">
          {showSuggestion && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary/5 p-2.5">
              <p className="min-w-0 flex-1 text-sm">
                {t("need", { portions: formatPortion(data.totalPortions), servings: formatQuantity(+cooking.toFixed(2)) })}
              </p>
              <Button size="sm" className="h-8" disabled={busy} onClick={() => onScale(wanted!)}>
                {t("adjust", { servings: formatQuantity(+(data.recipeServings * wanted!).toFixed(2)) })}
              </Button>
            </div>
          )}
          {canAdjust && (
            <div className="flex items-center gap-2">
              <span className="flex-1 text-sm font-medium">{t("servingsControl")}</span>
              <Button type="button" variant="outline" size="icon" className="size-9 rounded-full" aria-label={t("less")} disabled={busy || scale <= MIN_SCALE} onClick={() => onScale(Math.max(MIN_SCALE, +(scale - STEP).toFixed(2)))}>
                <Minus />
              </Button>
              <span className="w-10 text-center text-base font-semibold tabular-nums" aria-live="polite">
                {formatQuantity(+cooking.toFixed(2))}
              </span>
              <Button type="button" variant="outline" size="icon" className="size-9 rounded-full" aria-label={t("more")} disabled={busy || scale >= MAX_SCALE} onClick={() => onScale(Math.min(MAX_SCALE, +(scale + STEP).toFixed(2)))}>
                <Plus />
              </Button>
            </div>
          )}
          {canAdjust && <p className="text-xs text-muted-foreground">{t("scaleHint")}</p>}
        </div>
      )}
    </section>
  );
}
