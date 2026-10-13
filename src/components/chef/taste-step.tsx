"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DishDeck } from "@/components/chef/dish-deck";
import { mealTypeForSlot } from "@/lib/meals";
import type { DishCard } from "@/lib/chef";
import type { MealSlot } from "@/lib/types";

/** Con estas decisiones ya se puede armar un plan con sentido. */
const MIN_DECISIONS = 4;

/** Paso 2: deslizar platos para que el Chef entienda qué te gusta. */
export function TasteStep({
  deck, liked, disliked, slots, onDecide, onDone, onBack,
}: {
  deck: DishCard[];
  liked: string[];
  disliked: string[];
  slots: MealSlot[];
  onDecide: (id: string, liked: boolean) => void;
  onDone: (liked: string[], disliked: string[]) => void;
  onBack: () => void;
}) {
  const t = useTranslations("chef");
  const ts = useTranslations("slots");
  const decided = useMemo(() => new Set([...liked, ...disliked]), [liked, disliked]);
  const left = deck.filter((c) => !decided.has(c.id));
  const done = deck.length - left.length;

  // Se terminó el mazo: se arma el plan solo.
  useEffect(() => {
    if (deck.length && !left.length) onDone(liked, disliked);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al vaciarse el mazo
  }, [left.length]);

  const top = left[0];
  const slotLabel = top ? slots.find((s) => top.meal_types.includes(mealTypeForSlot(s))) : undefined;

  return (
    <div className="pb-6">
      <div className="flex items-center gap-2">
        <button onClick={onBack} aria-label={t("back")} className="-ml-2 rounded-full p-2 text-muted-foreground active:bg-muted">
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex-1">
          <p className="font-semibold">{t("tasteTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("tasteHint")}</p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
          {Math.min(done + 1, deck.length)}/{deck.length}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 transition-[width] duration-300" style={{ width: `${(done / Math.max(1, deck.length)) * 100}%` }} />
      </div>

      {top && slotLabel && (
        <p className="mt-4 text-center text-xs font-semibold tracking-wide text-fuchsia-600 uppercase">{ts(slotLabel)}</p>
      )}
      <DishDeck
        className="mt-2"
        items={left.map((card) => ({ card }))}
        onDecide={(item, isLiked) => onDecide(item.card.id, isLiked)}
      />

      <div className="mt-6 flex flex-col items-center gap-2">
        {done >= MIN_DECISIONS ? (
          <Button onClick={() => onDone(liked, disliked)} size="lg" className="h-12 rounded-2xl px-6 font-semibold">
            <Wand2 className="size-4" /> {t("buildNow", { count: liked.length })}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t("tasteMore", { count: MIN_DECISIONS - done })}</p>
        )}
      </div>
    </div>
  );
}
