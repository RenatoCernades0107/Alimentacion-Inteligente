"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowUp, CalendarCheck, CalendarDays, Lock, Plus, Repeat2, SlidersHorizontal, Sparkles, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { RecipeImage } from "@/components/recipe-image";
import { DishDeck, type DeckItem } from "@/components/chef/dish-deck";
import { KcalRing, MacroStack, MacroTargets } from "@/components/chef/macros";
import { applyChefPlan } from "@/app/actions/chef";
import { dayTotals, fallbackAlternatives, myServing, parseSlotKey, slotKey, type ChefReply, type DayTargets, type DishCard, type SlotKey } from "@/lib/chef";
import { formatPortion } from "@/lib/nutrition";
import { parseDate } from "@/lib/dates";
import { localName } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ChefViewProps, UiMessage } from "@/components/chef/chef-view";
import type { Goal, Plan, Pref } from "@/lib/chef";

type DraftLike = { plan: Plan; messages: UiMessage[]; quickReplies: string[]; liked: string[]; disliked: string[]; prefs: { goal: Goal; prefs: Pref[] } };
type Serving = ReturnType<typeof myServing>;

/** Paso 3: el plan (por día, con macros frente a la meta), la conversación con el Chef y pasar al calendario. */
export function PlanStep({
  draft, dates, targets, cardMap, cards, busy, slots, mealsPerDay, myKcal, isParent, pending, highlight, alternatives,
  onAlternatives, onSend, onRebuild, onEditPrefs, onSet, onApplied,
}: ChefViewProps & {
  draft: DraftLike;
  dates: string[];
  targets: DayTargets;
  cardMap: ReadonlyMap<string, DishCard>;
  pending: boolean;
  highlight: ReadonlySet<string>;
  alternatives: ChefReply["alternatives"];
  onAlternatives: (a: ChefReply["alternatives"]) => void;
  onSend: (text: string) => void;
  onRebuild: () => void;
  onEditPrefs: () => void;
  onSet: (key: SlotKey, recipeId: string | null) => void;
  onApplied: () => void;
}) {
  const t = useTranslations("chef");
  const ts = useTranslations("slots");
  const locale = useLocale();
  const router = useRouter();
  const [day, setDay] = useState(dates[0]);
  const [text, setText] = useState("");
  const [applyOpen, setApplyOpen] = useState(false);
  const [applied, setApplied] = useState<{ added: number; skipped: number } | null>(null);
  const [applying, startApply] = useTransition();
  const [deckPassed, setDeckPassed] = useState<Set<string>>(new Set());
  const chatEnd = useRef<HTMLDivElement>(null);
  const busyMap = new Map(busy);

  const dayShort = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const dayLong = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  const selectedDay = dates.includes(day) ? day : dates[0];

  const entries = dates.flatMap((d) =>
    slots
      .map((s) => slotKey(d, s))
      .filter((k) => draft.plan[k] && !busyMap.has(k) && cardMap.has(draft.plan[k]!.recipeId))
      .map((k) => ({ key: k, recipeId: draft.plan[k]!.recipeId })),
  );
  const emptyCount = dates.length * slots.length - entries.length - [...busyMap.keys()].filter((k) => dates.includes(parseSlotKey(k).date)).length;
  const totals = dayTotals(draft.plan, selectedDay, slots, cardMap, myKcal, mealsPerDay);
  const firstBuild = pending && entries.length === 0;

  // Baja al último mensaje solo cuando llega uno nuevo (no al abrir la pantalla con un borrador).
  const seenMessages = useRef(draft.messages.length);
  useEffect(() => {
    if (draft.messages.length === seenMessages.current && !pending) return;
    seenMessages.current = draft.messages.length;
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [draft.messages.length, pending]);

  // Al cambiar de alternativas se olvidan las que se pasaron.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio local del mazo
  useEffect(() => setDeckPassed(new Set()), [alternatives?.key]);

  const openAlternatives = (key: SlotKey) =>
    onAlternatives({ key, options: fallbackAlternatives(cards, draft.plan, key, draft.prefs.goal, draft.prefs.prefs, draft.disliked, 8) });

  const submit = (value: string) => {
    const v = value.trim();
    if (!v || pending) return;
    setText("");
    onSend(v);
  };

  const quick = draft.quickReplies.length ? draft.quickReplies : [t("qr.moreProtein"), t("qr.lighter"), t("qr.quicker"), t("qr.moreVeggies")];

  const altKey = alternatives?.key;
  const altSlot = altKey ? parseSlotKey(altKey) : null;
  const deckItems: DeckItem[] = (alternatives?.options ?? [])
    .filter((o) => !deckPassed.has(o.recipeId) && cardMap.has(o.recipeId))
    .map((o) => {
      const card = cardMap.get(o.recipeId)!;
      const s = altSlot ? myServing(card, altSlot.slot, myKcal, mealsPerDay) : null;
      return { card, reason: o.reason, serving: s ?? undefined, note: s ? t("servingNote", { portion: formatPortion(s.portion), kcal: s.kcal }) : undefined };
    });

  const apply = () =>
    startApply(async () => {
      try {
        const result = await applyChefPlan(entries);
        setApplied(result);
      } catch {
        toast.error(t("error"));
      }
    });

  return (
    <div className="pb-[calc(9.5rem+env(safe-area-inset-bottom))]">
      {/* Objetivo actual (tocar para cambiarlo) */}
      <button onClick={onEditPrefs} className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        <SlidersHorizontal className="size-3.5" /> {t(`goal.${draft.prefs.goal}`)} · {t("targetLine", { kcal: targets.kcal })}
      </button>

      {/* Días */}
      {dates.length > 1 && (
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {dates.map((d) => {
            const filled = slots.filter((s) => draft.plan[slotKey(d, s)] || busyMap.has(slotKey(d, s))).length;
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

      {/* Resumen del día frente a la meta */}
      <section className="rounded-3xl border bg-card p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold capitalize">{dayLong.format(parseDate(selectedDay))}</p>
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
          const busyName = busyMap.get(key);
          const entry = draft.plan[key];
          const card = entry ? cardMap.get(entry.recipeId) : undefined;
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
                  onSwap={() => openAlternatives(key)}
                  onRemove={() => onSet(key, null)}
                />
              ) : firstBuild ? (
                <div className="h-24 animate-pulse rounded-2xl bg-gradient-to-r from-muted via-muted/50 to-muted" />
              ) : (
                <button
                  onClick={() => openAlternatives(key)}
                  className="flex w-full items-center gap-2 rounded-2xl border-2 border-dashed border-muted-foreground/20 px-3 py-4 text-sm text-muted-foreground active:border-fuchsia-400 active:bg-fuchsia-50"
                >
                  <Plus className="size-4" /> {t("pickDish")}
                </button>
              )}
            </li>
          );
        })}
      </ol>

      {!pending && entries.length === 0 && (
        <Button onClick={onRebuild} variant="outline" className="mt-4 w-full rounded-2xl">
          <Wand2 className="size-4" /> {t("rebuild")}
        </Button>
      )}

      {/* Conversación */}
      {(draft.messages.length > 0 || pending) && (
        <section className="mt-8">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">{t("chatTitle")}</h3>
          <ul className="space-y-3">
            {draft.messages.map((m, i) => (
              <li key={i} className={cn("flex gap-2", m.role === "user" && "justify-end")}>
                {m.role === "model" && <ChefAvatar />}
                <p
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line",
                    m.role === "user" ? "rounded-br-md bg-foreground text-background" : "rounded-bl-md bg-card ring-1 ring-border",
                    m.offline && "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100",
                  )}
                >
                  {m.text}
                </p>
              </li>
            ))}
            {pending && (
              <li className="flex gap-2">
                <ChefAvatar />
                <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-card px-4 py-3 ring-1 ring-border" aria-label={t("thinking")}>
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="size-2 animate-bounce rounded-full bg-fuchsia-500" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
              </li>
            )}
          </ul>
          <div ref={chatEnd} />
        </section>
      )}

      {/* Barra fija: agregar al calendario + respuestas rápidas + mensaje */}
      <div className="fixed inset-x-0 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-lg px-4 pt-2 pb-2">
          {entries.length > 0 && (
            <button
              onClick={() => {
                setApplied(null);
                setApplyOpen(true);
              }}
              disabled={pending}
              className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-2.5 text-left text-primary-foreground shadow-md shadow-primary/25 transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <CalendarCheck className="size-5 shrink-0" />
              <span className="min-w-0 flex-1 text-sm font-semibold">{t("applyCta", { count: entries.length })}</span>
              {emptyCount > 0 && <span className="shrink-0 text-xs text-primary-foreground/80">{t("emptyLeft", { count: emptyCount })}</span>}
            </button>
          )}
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {quick.map((q) => (
              <button
                key={q}
                onClick={() => submit(q)}
                disabled={pending}
                className="shrink-0 rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition-transform active:scale-95 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(text);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={600}
              placeholder={t("placeholder")}
              aria-label={t("placeholder")}
              enterKeyHint="send"
              className="h-11 min-w-0 flex-1 rounded-full border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-fuchsia-500/40"
            />
            <button
              type="submit"
              disabled={pending || !text.trim()}
              aria-label={t("send")}
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 text-white transition-opacity disabled:opacity-40"
            >
              <ArrowUp className="size-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Alternativas para una franja: deslizar para elegir */}
      <Drawer open={!!alternatives} onOpenChange={(o) => !o && onAlternatives(null)}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {altSlot && (
              <DrawerHeader className="px-0 text-center">
                <DrawerTitle>{t("altTitle", { slot: ts(altSlot.slot).toLowerCase(), day: dayLong.format(parseDate(altSlot.date)) })}</DrawerTitle>
                <DrawerDescription>{t("altHint")}</DrawerDescription>
              </DrawerHeader>
            )}
            {deckItems.length ? (
              <DishDeck
                items={deckItems}
                likeLabel={t("pick")}
                onDecide={(item, liked) => {
                  if (liked && altKey) {
                    onSet(altKey, item.card.id);
                    onAlternatives(null);
                    toast.success(t("picked", { name: localName(item.card, locale) }));
                  } else setDeckPassed((s) => new Set(s).add(item.card.id));
                }}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="text-4xl">🤔</span>
                <p className="text-sm text-muted-foreground">{t("altEmpty")}</p>
                {altSlot && (
                  <Button
                    onClick={() => {
                      onAlternatives(null);
                      submit(t("moreIdeas", { slot: ts(altSlot.slot).toLowerCase(), day: dayLong.format(parseDate(altSlot.date)) }));
                    }}
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

      {/* Confirmar y pasar al calendario */}
      <Drawer open={applyOpen} onOpenChange={(o) => !o && !applying && setApplyOpen(false)}>
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
                <Button
                  className="mt-6 h-12 w-full rounded-2xl font-semibold"
                  onClick={() => {
                    setApplyOpen(false);
                    onApplied();
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
                  <DrawerDescription>{isParent ? t("applyBody", { count: entries.length }) : t("proposeBody", { count: entries.length })}</DrawerDescription>
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
                                  <RecipeImage src={c.image_url} emoji={c.emoji} recipeId={c.id} className="size-20 rounded-xl text-3xl" />
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
    </div>
  );
}

function ChefAvatar() {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 text-xs text-white">
      <Sparkles className="size-3.5" />
    </span>
  );
}

/** Plato elegido para una franja, con su porción, la razón del Chef y acciones para cambiarlo. */
function SlotCard({
  card, reason, serving, fresh, onSwap, onRemove,
}: {
  card: DishCard;
  reason?: string;
  /** Porción de quien mira y lo que aporta. */
  serving: Serving;
  fresh: boolean;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("chef");
  const locale = useLocale();
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-2.5 shadow-sm transition-all duration-500",
        fresh && "ring-2 ring-fuchsia-500 shadow-fuchsia-500/20 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4",
      )}
    >
      <div className="flex gap-3">
        <RecipeImage src={card.image_url} emoji={card.emoji} recipeId={card.id} alt={localName(card, locale)} className="size-20 rounded-xl text-3xl" />
        <div className="min-w-0 flex-1">
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
      <button onClick={onSwap} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-muted/70 py-2 text-xs font-semibold active:bg-muted">
        <Repeat2 className="size-4" /> {t("swap")}
      </button>
    </div>
  );
}
