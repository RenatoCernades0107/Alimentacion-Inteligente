"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarCheck, CalendarDays, Check, Clock, Home, Leaf, Sparkles, Target, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { RecipeImage } from "@/components/recipe-image";
import { MACRO_COLOR, MacroSplit } from "@/components/chef/macros";
import { applyChefPlan } from "@/app/actions/chef";
import { myServing, parseSlotKey, type ChefReply, type DayTargets, type DishCard, type DraftData, type SlotKey } from "@/lib/chef";
import { formatPortion, slotShare } from "@/lib/nutrition";
import { parseDate } from "@/lib/dates";
import { localName } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "best" | "protein" | "light" | "quick";
const SORTS: SortKey[] = ["best", "protein", "light", "quick"];

/**
 * Alternativas para una franja: todas a la vista, cada una con lo que aporta una porción de la receta y
 * la porción de quien mira (kcal y macros), frente a la meta de esa comida, para comparar y elegir.
 */
export function AlternativesDrawer({
  alternatives, cardMap, current, targets, myKcal, mealsPerDay, onClose, onPick, onAskChef,
}: {
  alternatives: ChefReply["alternatives"];
  cardMap: ReadonlyMap<string, DishCard>;
  /** Plato que ya está en la franja (para compararlo). */
  current?: string;
  /** Metas del día de quien mira. */
  targets: DayTargets;
  myKcal: number | null;
  mealsPerDay: number;
  onClose: () => void;
  onPick: (key: SlotKey, recipeId: string) => void;
  onAskChef: (text: string) => void;
}) {
  const t = useTranslations("chef");
  const ts = useTranslations("slots");
  const locale = useLocale();
  const [sort, setSort] = useState<SortKey>("best");
  const dayLong = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

  // Cada vez que se abren alternativas nuevas se vuelve al orden sugerido.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio local del orden
  useEffect(() => setSort("best"), [alternatives?.key]);

  const key = alternatives?.key;
  const slot = key ? parseSlotKey(key) : null;
  const share = slot ? slotShare(slot.slot, mealsPerDay) : 0;
  const goal = slot
    ? {
        kcal: Math.round(targets.kcal * share),
        protein: Math.round(targets.protein * share),
        carbs: Math.round(targets.carbs * share),
        fat: Math.round(targets.fat * share),
      }
    : null;

  const options: Option[] = (alternatives?.options ?? [])
    .filter((o) => cardMap.has(o.recipeId))
    .map((o, i) => {
      const card = cardMap.get(o.recipeId)!;
      const mine = slot && card.kcal ? myServing(card, slot.slot, myKcal, mealsPerDay) : null;
      return { card, reason: o.reason, mine, rank: i };
    });
  const currentCard = current && !options.some((o) => o.card.id === current) ? cardMap.get(current) : undefined;

  const sorted = [...options].sort((a, b) => {
    if (sort === "protein") return proteinRatio(b.card) - proteinRatio(a.card) || a.rank - b.rank;
    if (sort === "light") return (a.mine?.kcal ?? Infinity) - (b.mine?.kcal ?? Infinity) || a.rank - b.rank;
    if (sort === "quick") return (a.card.time ?? Infinity) - (b.card.time ?? Infinity) || a.rank - b.rank;
    return a.rank - b.rank;
  });

  const pick = (card: DishCard) => {
    if (!key) return;
    onPick(key, card.id);
    toast.success(t("picked", { name: localName(card, locale) }));
  };

  return (
    <Drawer open={!!alternatives} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] select-text">
          {slot && (
            <DrawerHeader className="px-0 text-center">
              <DrawerTitle>{t("altTitle", { slot: ts(slot.slot).toLowerCase(), day: dayLong.format(parseDate(slot.date)) })}</DrawerTitle>
              <DrawerDescription>{t("altHint")}</DrawerDescription>
            </DrawerHeader>
          )}

          {goal && options.length > 0 && (
            <div className="mb-3 rounded-2xl bg-muted/60 px-3 py-2.5">
              <p className="text-xs font-semibold">
                <Target className="mr-1 inline size-3.5 align-[-2px]" />
                {t("alt.goal", { slot: ts(slot!.slot).toLowerCase() })}
              </p>
              <NutritionRow label={null} values={goal} className="mt-1" />
              {targets.estimated && <p className="mt-1 text-[11px] text-muted-foreground">{t("estimatedTarget")}</p>}
            </div>
          )}

          {options.length > 1 && (
            <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
              {SORTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  aria-pressed={sort === s}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors",
                    sort === s ? "bg-foreground text-background ring-foreground" : "bg-card text-muted-foreground ring-border",
                  )}
                >
                  {t(`alt.sort.${s}`)}
                </button>
              ))}
            </div>
          )}

          {options.length ? (
            <ul className="space-y-3">
              {currentCard && slot && (
                <li>
                  <OptionCard
                    option={{ card: currentCard, mine: currentCard.kcal ? myServing(currentCard, slot.slot, myKcal, mealsPerDay) : null, rank: -1 }}
                    goal={goal}
                    current
                  />
                </li>
              )}
              {sorted.map((o) => (
                <li key={o.card.id}>
                  <OptionCard option={o} goal={goal} current={o.card.id === current} onPick={() => pick(o.card)} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="text-4xl">🤔</span>
              <p className="text-sm text-muted-foreground">{t("altEmpty")}</p>
            </div>
          )}

          {slot && (
            <Button
              variant={options.length ? "outline" : "default"}
              onClick={() => onAskChef(t("moreIdeas", { slot: ts(slot.slot).toLowerCase(), day: dayLong.format(parseDate(slot.date)) }))}
              className="mt-4 h-11 w-full rounded-2xl"
            >
              <Sparkles className="size-4" /> {t("askChef")}
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

type Nutrition = { kcal: number; protein: number; carbs: number; fat: number };
type Option = { card: DishCard; reason?: string; mine: (Nutrition & { portion: number }) | null; rank: number };

/** Gramos de proteína por cada 100 kcal: sirve para ordenar sin que gane siempre el plato más grande. */
function proteinRatio(c: DishCard) {
  return c.kcal && c.protein != null ? (c.protein / c.kcal) * 100 : -1;
}

/** Una alternativa: foto, datos clave, el porqué del Chef y su tabla de kcal y macros por porción. */
function OptionCard({ option, goal, current, onPick }: { option: Option; goal: Nutrition | null; current?: boolean; onPick?: () => void }) {
  const t = useTranslations("chef");
  const locale = useLocale();
  const { card, reason, mine } = option;
  const perServing =
    card.kcal != null && card.protein != null && card.carbs != null && card.fat != null
      ? { kcal: card.kcal, protein: card.protein, carbs: card.carbs, fat: card.fat }
      : null;

  return (
    <div className={cn("rounded-3xl bg-card p-3 ring-1", current ? "ring-2 ring-primary/40" : "ring-border")}>
      <div className="flex gap-3">
        <RecipeImage
          src={card.image_url}
          emoji={card.emoji}
          recipeId={card.custom ? undefined : card.id}
          alt={localName(card, locale)}
          className="size-20 shrink-0 rounded-2xl text-4xl"
        />
        <div className="min-w-0 flex-1">
          {current && <p className="text-[11px] font-semibold tracking-wide text-primary uppercase">{t("alt.current")}</p>}
          <p className="leading-tight font-semibold text-balance">{localName(card, locale)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1 text-[11px] font-medium text-muted-foreground">
            {card.time != null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                {card.time <= 30 ? <Timer className="size-3" /> : <Clock className="size-3" />} {card.time} min
              </span>
            )}
            {card.total > 0 && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", card.have === card.total ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" : "bg-muted")}>
                <Home className="size-3" /> {t("haveCount", { have: card.have, total: card.total })}
              </span>
            )}
            {card.custom && <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300">✨ {t("custom.badge")}</span>}
            {card.expiring && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">{t("usesExpiring")}</span>}
            {!card.meat && (
              <span className="inline-flex items-center gap-1 rounded-full bg-lime-100 px-2 py-0.5 text-lime-700 dark:bg-lime-950/50 dark:text-lime-300">
                <Leaf className="size-3" /> {t("noMeat")}
              </span>
            )}
          </div>
        </div>
      </div>

      {reason && <p className="mt-2.5 rounded-xl bg-fuchsia-50 px-3 py-2 text-sm leading-snug dark:bg-fuchsia-950/30">✨ {reason}</p>}

      {perServing ? (
        <div className="mt-3 space-y-2">
          <MacroSplit macros={perServing} />
          <div className="divide-y divide-border/60 rounded-xl bg-muted/50 px-2.5">
            <NutritionHeader />
            <NutritionRow label={t("alt.perServing")} values={perServing} />
            {mine && <NutritionRow label={t("alt.yours", { portion: formatPortion(mine.portion) })} values={mine} goal={goal} strong />}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t("alt.noData")}</p>
      )}

      {onPick && !current && (
        <Button onClick={onPick} className="mt-3 h-10 w-full rounded-2xl font-semibold">
          <Check className="size-4" /> {t("alt.choose")}
        </Button>
      )}
    </div>
  );
}

const ROW = "grid grid-cols-[minmax(0,1fr)_repeat(4,3.25rem)] items-center gap-1 py-1.5 text-xs tabular-nums";

function NutritionHeader() {
  const t = useTranslations("chef");
  return (
    <div className={cn(ROW, "text-[11px] text-muted-foreground")}>
      <span />
      <span className="text-right">kcal</span>
      {(["protein", "carbs", "fat"] as const).map((m) => (
        <span key={m} className="inline-flex items-center justify-end gap-1">
          <span className={cn("size-1.5 rounded-full", MACRO_COLOR[m].bar)} />
          {t(`macro.${m}Long`)}
        </span>
      ))}
    </div>
  );
}

/** Fila de kcal y gramos; con `goal`, lo que se aleja más de ±20 % de la meta se marca. */
function NutritionRow({ label, values, goal, strong, className }: { label: string | null; values: Nutrition; goal?: Nutrition | null; strong?: boolean; className?: string }) {
  const t = useTranslations("chef");
  const cols = ["kcal", "protein", "carbs", "fat"] as const;
  if (label === null) {
    // Fila suelta (la meta): etiqueta de cada valor al lado.
    return (
      <div className={cn("flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground", className)}>
        <span>
          <span className="font-semibold text-foreground">{values.kcal}</span> kcal
        </span>
        {(["protein", "carbs", "fat"] as const).map((m) => (
          <span key={m} className="inline-flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", MACRO_COLOR[m].bar)} />
            <span className="font-semibold text-foreground">{values[m]} g</span> {t(`macro.${m}Long`).toLowerCase()}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className={cn(ROW, className)}>
      <span className={cn("truncate", strong ? "font-semibold" : "text-muted-foreground")}>{label}</span>
      {cols.map((c) => {
        const off = goal && goal[c] > 0 ? values[c] / goal[c] - 1 : 0;
        const flag = Math.abs(off) > 0.2;
        return (
          <span
            key={c}
            className={cn("text-right", strong && "font-semibold", flag && "text-orange-600 dark:text-orange-400")}
            title={goal ? t("alt.vsGoal", { goal: goal[c] }) : undefined}
          >
            {values[c]}
            {c === "kcal" ? "" : " g"}
            {flag && (off > 0 ? " ↑" : " ↓")}
          </span>
        );
      })}
    </div>
  );
}

/** Confirmar y pasar el plan al calendario (padres: comidas planificadas; hijos: propuestas). */
export function ApplyDrawer({
  open, onOpenChange, entries, dates, cardMap, isParent, custom, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: { key: SlotKey; recipeId: string }[];
  dates: string[];
  cardMap: ReadonlyMap<string, DishCard>;
  isParent: boolean;
  /** Recetas nuevas del Chef en el borrador. */
  custom: DraftData["custom"];
  /** Las recetas nuevas ya se guardaron en "Recetas": id temporal → id real. */
  onSaved: (saved: Record<string, string>) => void;
}) {
  const t = useTranslations("chef");
  const locale = useLocale();
  const router = useRouter();
  const [applied, setApplied] = useState<{ added: number; skipped: number; saved: number } | null>(null);
  const newIds = [...new Set(entries.map((e) => e.recipeId).filter((id) => custom[id]))];
  const [applying, startApply] = useTransition();
  const dayLong = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

  // Al cerrarse vuelve a la confirmación para la próxima vez.
  const close = () => {
    onOpenChange(false);
    window.setTimeout(() => setApplied(null), 300);
  };

  const apply = () =>
    startApply(async () => {
      try {
        const res = await applyChefPlan(entries, Object.fromEntries(newIds.map((id) => [id, custom[id].recipe])));
        const savedCount = Object.keys(res.saved).length;
        if (savedCount) {
          onSaved(res.saved);
          router.refresh();
        }
        setApplied({ added: res.added, skipped: res.skipped, saved: savedCount });
      } catch {
        toast.error(t("error"));
      }
    });

  return (
    <Drawer open={open} onOpenChange={(o) => !o && !applying && close()}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {applied ? (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="text-6xl motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500">🎉</span>
              <DrawerTitle className="mt-3 text-xl">{isParent ? t("appliedTitle", { count: applied.added }) : t("proposedTitle", { count: applied.added })}</DrawerTitle>
              <DrawerDescription className="mt-1">
                {isParent ? t("appliedBody") : t("proposedBody")}
                {applied.skipped > 0 && ` ${t("skipped", { count: applied.skipped })}`}
              </DrawerDescription>
              {applied.saved > 0 && <p className="mt-2 text-sm font-medium">✨ {t("custom.saved", { count: applied.saved })}</p>}
              <p className="mt-2 text-xs text-muted-foreground">{t("draftKept")}</p>
              <Button
                className="mt-6 h-12 w-full rounded-2xl font-semibold"
                onClick={() => {
                  close();
                  router.push(`/?date=${dates[0]}`);
                }}
              >
                <CalendarDays className="size-4" /> {t("seeCalendar")}
              </Button>
            </div>
          ) : (
            <>
              <DrawerHeader className="px-0">
                <DrawerTitle>{isParent ? t("applyTitle") : t("proposeTitle")}</DrawerTitle>
                <DrawerDescription>
                  {isParent ? t("applyBody", { count: entries.length }) : t("proposeBody", { count: entries.length })}
                  {newIds.length > 0 && ` ${t("custom.willSave", { count: newIds.length })}`}
                </DrawerDescription>
              </DrawerHeader>
              <ul className="space-y-3">
                {dates
                  .filter((d) => entries.some((e) => e.key.startsWith(`${d}|`)))
                  .map((d) => (
                    <li key={d}>
                      <p className="mb-1 text-xs font-semibold text-muted-foreground capitalize">{dayLong.format(parseDate(d))}</p>
                      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
                        {entries
                          .filter((e) => e.key.startsWith(`${d}|`))
                          .map((e) => {
                            const c = cardMap.get(e.recipeId)!;
                            return (
                              <div key={e.key} className="w-20 shrink-0">
                                <RecipeImage src={c.image_url} emoji={c.emoji} recipeId={c.custom ? undefined : c.id} className="size-20 rounded-xl text-3xl" />
                                <p className="mt-1 line-clamp-2 text-[11px] leading-tight">{localName(c, locale)}</p>
                              </div>
                            );
                          })}
                      </div>
                    </li>
                  ))}
              </ul>
              <Button onClick={apply} disabled={applying} className="mt-5 h-12 w-full rounded-2xl text-base font-semibold">
                <CalendarCheck className="size-5" /> {applying ? t("applying") : isParent ? t("applyConfirm") : t("proposeConfirm")}
              </Button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
