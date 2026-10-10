"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Clock, Flame, Heart, Home, Leaf, Timer, X } from "lucide-react";
import { RecipeImage } from "@/components/recipe-image";
import { MacroStack } from "@/components/chef/macros";
import { localName } from "@/lib/types";
import type { DishCard } from "@/lib/chef";
import { cn } from "@/lib/utils";

/** Distancia (px) a partir de la cual soltar la tarjeta cuenta como decisión. */
const THRESHOLD = 90;

export type DeckItem = {
  card: DishCard;
  reason?: string;
  /** Texto extra bajo el nombre (ej. "1½ porciones · 620 kcal"). */
  note?: string;
  /** Lo que aporta la porción de quien mira; sin esto se muestra una porción de la receta. */
  serving?: { kcal: number; protein: number; carbs: number; fat: number };
};

/**
 * Mazo de platos para elegir deslizando: → me gusta, ← paso. También con los botones o las flechas
 * del teclado. Muestra la tarjeta de arriba y asoma la siguiente.
 */
export function DishDeck({
  items, onDecide, likeLabel, passLabel, className,
}: {
  items: DeckItem[];
  onDecide: (item: DeckItem, liked: boolean) => void;
  likeLabel?: string;
  passLabel?: string;
  className?: string;
}) {
  const t = useTranslations("chef");
  const locale = useLocale();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<null | "left" | "right">(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const top = items[0];

  const decide = useCallback(
    (liked: boolean) => {
      if (!top || leaving) return;
      setLeaving(liked ? "right" : "left");
      // Deja terminar la animación de salida antes de avisar.
      window.setTimeout(() => {
        onDecide(top, liked);
        setLeaving(null);
        setDx(0);
      }, 220);
    },
    [top, leaving, onDecide],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "ArrowRight") decide(true);
      if (e.key === "ArrowLeft") decide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide]);

  if (!top) return null;

  const offset = leaving === "right" ? 600 : leaving === "left" ? -600 : dx;
  const intent = offset > 30 ? "like" : offset < -30 ? "pass" : null;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative h-[min(52dvh,30rem)] w-full max-w-sm">
        {/* La que sigue asoma detrás */}
        {items[1] && (
          <div className="absolute inset-0 translate-y-3 scale-[0.94] opacity-70 transition-transform" aria-hidden>
            <CardFace item={items[1]} />
          </div>
        )}
        <div
          role="group"
          aria-roledescription={t("deckRole")}
          aria-label={localName(top.card, locale)}
          className={cn("absolute inset-0 touch-pan-y select-none", !dragging && "transition-transform duration-200 ease-out")}
          style={{ transform: `translateX(${offset}px) rotate(${offset / 18}deg)` }}
          onPointerDown={(e) => {
            if (leaving) return;
            start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!start.current || start.current.id !== e.pointerId) return;
            setDx(e.clientX - start.current.x);
          }}
          onPointerUp={() => {
            if (!start.current) return;
            start.current = null;
            setDragging(false);
            if (Math.abs(dx) > THRESHOLD) decide(dx > 0);
            else setDx(0);
          }}
          onPointerCancel={() => {
            start.current = null;
            setDragging(false);
            setDx(0);
          }}
        >
          <CardFace item={top} />
          {/* Sellos de la decisión mientras se arrastra */}
          <span
            className={cn(
              "pointer-events-none absolute top-6 left-5 -rotate-12 rounded-xl border-4 border-emerald-400 px-3 py-1 text-2xl font-black tracking-wide text-emerald-400 uppercase transition-opacity",
              intent === "like" ? "opacity-100" : "opacity-0",
            )}
          >
            {likeLabel ?? t("like")}
          </span>
          <span
            className={cn(
              "pointer-events-none absolute top-6 right-5 rotate-12 rounded-xl border-4 border-rose-400 px-3 py-1 text-2xl font-black tracking-wide text-rose-400 uppercase transition-opacity",
              intent === "pass" ? "opacity-100" : "opacity-0",
            )}
          >
            {passLabel ?? t("pass")}
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-6">
        <button
          onClick={() => decide(false)}
          aria-label={passLabel ?? t("pass")}
          className="flex size-16 items-center justify-center rounded-full bg-card text-rose-500 shadow-lg ring-1 ring-border transition-transform active:scale-90"
        >
          <X className="size-8" strokeWidth={2.5} />
        </button>
        <button
          onClick={() => decide(true)}
          aria-label={likeLabel ?? t("like")}
          className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 transition-transform active:scale-90"
        >
          <Heart className="size-8 fill-current" />
        </button>
      </div>
    </div>
  );
}

/** Cara de la tarjeta: foto a sangre con el nombre, datos clave y macros encima. */
function CardFace({ item }: { item: DeckItem }) {
  const t = useTranslations("chef");
  const locale = useLocale();
  const { card } = item;
  const kcal = item.serving?.kcal ?? card.kcal;
  const macros = card.protein != null && item.serving ? item.serving : card;
  return (
    <div className="relative size-full overflow-hidden rounded-[2rem] bg-card shadow-xl ring-1 ring-black/5">
      <RecipeImage src={card.image_url} emoji={card.emoji} recipeId={card.id} alt={localName(card, locale)} className="size-full rounded-none text-8xl" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-5 pt-24 pb-5 text-white">
        <div className="mb-2 flex flex-wrap gap-1.5 text-xs font-medium">
          {kcal != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 backdrop-blur">
              <Flame className="size-3" /> {kcal} kcal
            </span>
          )}
          {card.time != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 backdrop-blur">
              {card.time <= 30 ? <Timer className="size-3" /> : <Clock className="size-3" />} {card.time} min
            </span>
          )}
          {card.total > 0 && (
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 backdrop-blur", card.have === card.total ? "bg-emerald-500/80" : "bg-white/20")}>
              <Home className="size-3" /> {t("haveCount", { have: card.have, total: card.total })}
            </span>
          )}
          {card.expiring && <span className="rounded-full bg-orange-500/90 px-2 py-0.5">{t("usesExpiring")}</span>}
          {!card.meat && (
            <span className="inline-flex items-center gap-1 rounded-full bg-lime-500/80 px-2 py-0.5">
              <Leaf className="size-3" /> {t("noMeat")}
            </span>
          )}
        </div>
        <h3 className="text-2xl leading-tight font-bold text-balance">{localName(card, locale)}</h3>
        {item.note && <p className="mt-0.5 text-sm text-white/80">{item.note}</p>}
        {item.reason && <p className="mt-2 rounded-xl bg-white/15 px-3 py-2 text-sm leading-snug backdrop-blur">✨ {item.reason}</p>}
        <MacroStack macros={macros} light className="mt-3" />
      </div>
    </div>
  );
}
