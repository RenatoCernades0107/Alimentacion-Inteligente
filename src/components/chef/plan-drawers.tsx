"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarCheck, CalendarDays, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { RecipeImage } from "@/components/recipe-image";
import { DishDeck, type DeckItem } from "@/components/chef/dish-deck";
import { applyChefPlan } from "@/app/actions/chef";
import { myServing, parseSlotKey, type ChefReply, type DishCard, type DraftData, type SlotKey } from "@/lib/chef";
import { formatPortion } from "@/lib/nutrition";
import { parseDate } from "@/lib/dates";
import { localName } from "@/lib/types";

/** Alternativas para una franja: se desliza para elegir. */
export function AlternativesDrawer({
  alternatives, cardMap, myKcal, mealsPerDay, onClose, onPick, onAskChef,
}: {
  alternatives: ChefReply["alternatives"];
  cardMap: ReadonlyMap<string, DishCard>;
  myKcal: number | null;
  mealsPerDay: number;
  onClose: () => void;
  onPick: (key: SlotKey, recipeId: string) => void;
  onAskChef: (text: string) => void;
}) {
  const t = useTranslations("chef");
  const ts = useTranslations("slots");
  const locale = useLocale();
  const [passed, setPassed] = useState<Set<string>>(new Set());
  const dayLong = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

  // Al cambiar de alternativas se olvidan las que se pasaron.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio local del mazo
  useEffect(() => setPassed(new Set()), [alternatives?.key]);

  const key = alternatives?.key;
  const slot = key ? parseSlotKey(key) : null;
  const items: DeckItem[] = (alternatives?.options ?? [])
    .filter((o) => !passed.has(o.recipeId) && cardMap.has(o.recipeId))
    .map((o) => {
      const card = cardMap.get(o.recipeId)!;
      const s = slot ? myServing(card, slot.slot, myKcal, mealsPerDay) : null;
      return { card, reason: o.reason, serving: s ?? undefined, note: s ? t("servingNote", { portion: formatPortion(s.portion), kcal: s.kcal }) : undefined };
    });

  return (
    <Drawer open={!!alternatives} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {slot && (
            <DrawerHeader className="px-0 text-center">
              <DrawerTitle>{t("altTitle", { slot: ts(slot.slot).toLowerCase(), day: dayLong.format(parseDate(slot.date)) })}</DrawerTitle>
              <DrawerDescription>{t("altHint")}</DrawerDescription>
            </DrawerHeader>
          )}
          {items.length ? (
            <DishDeck
              items={items}
              likeLabel={t("pick")}
              onDecide={(item, liked) => {
                if (liked && key) {
                  onPick(key, item.card.id);
                  toast.success(t("picked", { name: localName(item.card, locale) }));
                } else setPassed((s) => new Set(s).add(item.card.id));
              }}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="text-4xl">🤔</span>
              <p className="text-sm text-muted-foreground">{t("altEmpty")}</p>
              {slot && (
                <Button
                  onClick={() => onAskChef(t("moreIdeas", { slot: ts(slot.slot).toLowerCase(), day: dayLong.format(parseDate(slot.date)) }))}
                  className="rounded-2xl"
                >
                  <Sparkles className="size-4" /> {t("askChef")}
                </Button>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
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
