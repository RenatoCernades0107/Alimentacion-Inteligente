"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { BookOpen, ClipboardCopy, ClipboardPaste, Copy, FileText, Lock, Plus, Repeat2, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RecipeImage } from "@/components/recipe-image";
import { KcalRing, MacroStack, MacroTargets } from "@/components/chef/macros";
import { copyDay, dayTotals, myServing, planToText, slotKey, type DayTargets, type DishCard, type MealClip, type Plan, type SlotKey } from "@/lib/chef";
import { formatPortion } from "@/lib/nutrition";
import { parseDate } from "@/lib/dates";
import { localName, type MealSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

type Serving = ReturnType<typeof myServing>;

/**
 * El plan del borrador: días, resumen del día frente a la meta y cada franja con su plato. Los platos
 * y los días se pueden copiar y pegar (también entre borradores: lo copiado queda guardado en el dispositivo).
 */
export function PlanPanel({
  plan, dates, targets, cardMap, busy, slots, mealsPerDay, myKcal, pending, highlight, clip,
  onSwap, onSet, onClip, onPaste, onBuild, onOpenCustom,
}: {
  plan: Plan;
  dates: string[];
  targets: DayTargets;
  cardMap: ReadonlyMap<string, DishCard>;
  busy: ReadonlyMap<string, string>;
  slots: MealSlot[];
  mealsPerDay: number;
  myKcal: number | null;
  pending: boolean;
  highlight: ReadonlySet<string>;
  clip: MealClip | null;
  onSwap: (key: SlotKey) => void;
  onSet: (key: SlotKey, recipeId: string | null) => void;
  onClip: (clip: MealClip | null) => void;
  /** Pega lo copiado: en franjas (plato) o en días (día). */
  onPaste: (targets: string[]) => void;
  onBuild: () => void;
  /** Abre una receta nueva del Chef (ingredientes y pasos). */
  onOpenCustom: (recipeId: string) => void;
}) {
  const t = useTranslations("chef");
  const ts = useTranslations("slots");
  const locale = useLocale();
  const [day, setDay] = useState(dates[0]);

  const dayShort = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const dayLong = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  const selectedDay = dates.includes(day) ? day : dates[0];
  const totals = dayTotals(plan, selectedDay, slots, cardMap, myKcal, mealsPerDay);
  const hasPlan = dates.some((d) => slots.some((s) => plan[slotKey(d, s)]));
  const firstBuild = pending && !hasPlan;
  const dayClip = copyDay(plan, selectedDay, slots);
  const clipName = clip?.kind === "meal" ? cardMap.get(clip.recipeId) : undefined;
  const clipCount = clip?.kind === "day" ? Object.keys(clip.meals).length : 0;

  const copyAsText = async () => {
    const text = planToText(plan, dates, slots, {
      day: (d) => dayLong.format(parseDate(d)),
      slot: (s) => ts(s),
      dish: (id) => (cardMap.get(id) ? localName(cardMap.get(id)!, locale) : null),
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("clip.textCopied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <div>
      {/* Días */}
      {dates.length > 1 && (
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {dates.map((d) => {
            const filled = slots.filter((s) => plan[slotKey(d, s)] || busy.has(slotKey(d, s))).length;
            const active = d === selectedDay;
            return (
              <button
                key={d}
                onClick={() => setDay(d)}
                className={cn(
                  "flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-2xl py-2 transition-all",
                  active ? "bg-foreground text-background shadow-md" : "bg-card ring-1 ring-border",
                )}
              >
                <span className={cn("text-[11px] font-medium capitalize", !active && "text-muted-foreground")}>{dayShort.format(parseDate(d)).replace(".", "").slice(0, 3)}</span>
                <span className="text-base font-bold">{parseDate(d).getUTCDate()}</span>
                <span className="flex gap-0.5">
                  {slots.map((s, i) => (
                    <span key={s} className={cn("size-1 rounded-full", i < filled ? (active ? "bg-background" : "bg-fuchsia-500") : active ? "bg-background/30" : "bg-muted")} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Lo copiado */}
      {clip && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-dashed border-fuchsia-400 bg-fuchsia-50 p-2 pl-3 text-sm dark:bg-fuchsia-950/30">
          <ClipboardCopy className="size-4 shrink-0 text-fuchsia-600" />
          <span className="min-w-0 flex-1 truncate">
            {clip.kind === "meal" ? t("clip.meal", { name: clipName ? localName(clipName, locale) : "—" }) : t("clip.day", { count: clipCount })}
          </span>
          {clip.kind === "day" && (
            <>
              <button onClick={() => onPaste([selectedDay])} className="shrink-0 rounded-full bg-fuchsia-600 px-3 py-1 text-xs font-semibold text-white active:scale-95">
                {t("clip.pasteHere")}
              </button>
              {dates.length > 1 && (
                <button onClick={() => onPaste(dates)} className="shrink-0 rounded-full border border-fuchsia-300 bg-card px-3 py-1 text-xs font-semibold active:scale-95">
                  {t("clip.pasteAll")}
                </button>
              )}
            </>
          )}
          <button onClick={() => onClip(null)} aria-label={t("clip.clear")} className="shrink-0 rounded-full p-1 text-muted-foreground active:bg-muted">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Resumen del día frente a la meta */}
      <section className="rounded-3xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold capitalize">{dayLong.format(parseDate(selectedDay))}</p>
          <button
            onClick={() => {
              if (!dayClip) return;
              onClip(dayClip);
              toast.success(t("clip.dayCopied"));
            }}
            disabled={!dayClip}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium active:scale-95 disabled:opacity-40"
          >
            <Copy className="size-3.5" /> {t("clip.copyDay")}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <KcalRing value={totals.kcal} target={targets.kcal} />
          <MacroTargets totals={totals} targets={targets} />
        </div>
        {targets.estimated && <p className="mt-3 text-xs text-muted-foreground">{t("estimatedTarget")}</p>}
      </section>

      {/* Franjas del día */}
      <ol className="mt-4 space-y-3">
        {slots.map((slot) => {
          const key = slotKey(selectedDay, slot);
          const busyName = busy.get(key);
          const entry = plan[key];
          const card = entry ? cardMap.get(entry.recipeId) : undefined;
          const canPaste = clip?.kind === "meal" && !!clipName && entry?.recipeId !== clip.recipeId;
          return (
            <li key={key}>
              <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{ts(slot)}</p>
              {busyName ? (
                <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground">
                  <Lock className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{t("busy", { name: busyName })}</span>
                </div>
              ) : card ? (
                <SlotCard
                  card={card}
                  reason={entry?.reason}
                  serving={myServing(card, slot, myKcal, mealsPerDay)}
                  fresh={highlight.has(key)}
                  canPaste={canPaste}
                  onSwap={() => onSwap(key)}
                  onRemove={() => onSet(key, null)}
                  onCopy={() => {
                    onClip({ kind: "meal", recipeId: card.id });
                    toast.success(t("clip.mealCopied", { name: localName(card, locale) }));
                  }}
                  onPaste={() => onPaste([key])}
                  onOpen={card.custom ? () => onOpenCustom(card.id) : undefined}
                />
              ) : firstBuild ? (
                <div className="h-24 animate-pulse rounded-2xl bg-gradient-to-r from-muted via-muted/50 to-muted" />
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => onSwap(key)}
                    className="flex flex-1 items-center gap-2 rounded-2xl border-2 border-dashed border-muted-foreground/20 px-3 py-4 text-sm text-muted-foreground active:border-fuchsia-400 active:bg-fuchsia-50"
                  >
                    <Plus className="size-4" /> {t("pickDish")}
                  </button>
                  {canPaste && (
                    <button
                      onClick={() => onPaste([key])}
                      className="flex min-w-0 max-w-[50%] items-center gap-1.5 rounded-2xl border-2 border-dashed border-fuchsia-400 px-3 py-4 text-sm font-medium text-fuchsia-700 active:bg-fuchsia-50 dark:text-fuchsia-300"
                    >
                      <ClipboardPaste className="size-4 shrink-0" />
                      <span className="truncate">{t("clip.paste")}</span>
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 flex flex-col gap-2">
        {!pending && !hasPlan && (
          <Button onClick={onBuild} className="h-11 w-full rounded-2xl">
            <Wand2 className="size-4" /> {t("rebuild")}
          </Button>
        )}
        {hasPlan && (
          <button onClick={copyAsText} className="mx-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground active:bg-muted">
            <FileText className="size-4" /> {t("clip.copyText")}
          </button>
        )}
      </div>
    </div>
  );
}

/** Plato elegido para una franja, con su porción, la razón del Chef y acciones (cambiar, copiar, pegar, quitar). */
function SlotCard({
  card, reason, serving, fresh, canPaste, onSwap, onRemove, onCopy, onPaste, onOpen,
}: {
  card: DishCard;
  reason?: string;
  /** Porción de quien mira y lo que aporta. */
  serving: Serving;
  fresh: boolean;
  canPaste: boolean;
  onSwap: () => void;
  onRemove: () => void;
  onCopy: () => void;
  onPaste: () => void;
  /** Solo en recetas nuevas del Chef: ver ingredientes y pasos. */
  onOpen?: () => void;
}) {
  const t = useTranslations("chef");
  const locale = useLocale();
  const image = <RecipeImage src={card.image_url} emoji={card.emoji} recipeId={card.custom ? undefined : card.id} alt={localName(card, locale)} className="size-20 rounded-xl text-3xl" />;
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-2.5 shadow-sm transition-all duration-500",
        fresh && "ring-2 ring-fuchsia-500 shadow-fuchsia-500/20 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4",
      )}
    >
      <div className="flex gap-3">
        {onOpen ? (
          <button onClick={onOpen} aria-label={t("custom.view")} className="shrink-0 rounded-xl">
            {image}
          </button>
        ) : (
          image
        )}
        <div className="min-w-0 flex-1">
          {card.custom && <CustomBadge className="mb-1" />}
          <div className="flex items-start gap-1">
            <p className="line-clamp-2 flex-1 leading-tight font-semibold">{localName(card, locale)}</p>
            <button onClick={onRemove} aria-label={t("remove")} className="-mt-1 -mr-1 rounded-full p-1.5 text-muted-foreground active:bg-muted">
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("servingNote", { portion: formatPortion(serving.portion), kcal: serving.kcal })}
            {card.time != null && ` · ${card.time} min`}
            {card.total > 0 && ` · ${t("haveCount", { have: card.have, total: card.total })}`}
          </p>
          {card.protein != null && <MacroStack macros={serving} className="mt-2" />}
        </div>
      </div>
      {reason && <p className="mt-2 rounded-xl bg-fuchsia-50 px-3 py-1.5 text-xs text-fuchsia-900 dark:bg-fuchsia-950/40 dark:text-fuchsia-100">✨ {reason}</p>}
      <div className="mt-2 flex gap-1.5">
        <button onClick={onSwap} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-muted/70 py-2 text-xs font-semibold active:bg-muted">
          <Repeat2 className="size-4" /> {t("swap")}
        </button>
        {onOpen && (
          <button onClick={onOpen} className="flex items-center justify-center gap-1.5 rounded-xl bg-muted/70 px-3 py-2 text-xs font-semibold active:bg-muted">
            <BookOpen className="size-4" /> {t("custom.view")}
          </button>
        )}
        <button onClick={onCopy} aria-label={t("clip.copy")} className="flex items-center justify-center gap-1.5 rounded-xl bg-muted/70 px-3 py-2 text-xs font-semibold active:bg-muted">
          <Copy className="size-4" /> {t("clip.copy")}
        </button>
        {canPaste && (
          <button
            onClick={onPaste}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-fuchsia-600 px-3 py-2 text-xs font-semibold text-white active:bg-fuchsia-700"
          >
            <ClipboardPaste className="size-4" /> {t("clip.paste")}
          </button>
        )}
      </div>
    </div>
  );
}

/** Insignia de una receta nueva inventada por el Chef. */
export function CustomBadge({ className }: { className?: string }) {
  const t = useTranslations("chef");
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-fuchsia-800 uppercase dark:bg-fuchsia-950/60 dark:text-fuchsia-200", className)}>
      ✨ {t("custom.badge")}
    </span>
  );
}
