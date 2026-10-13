"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RotateCcw, Sparkles } from "lucide-react";
import { chefTurn } from "@/app/actions/chef";
import { SetupStep } from "@/components/chef/setup-step";
import { TasteStep } from "@/components/chef/taste-step";
import { PlanStep } from "@/components/chef/plan-step";
import { dayTargets, scopeDates, tasteDeck, type ChefPrefs, type ChefReply, type DishCard, type Plan, type SlotKey } from "@/lib/chef";
import type { MealSlot } from "@/lib/types";

export type UiMessage = { role: "user" | "model"; text: string; offline?: boolean };

type Phase = "setup" | "taste" | "plan";

type Draft = {
  v: 1;
  phase: Phase;
  prefs: ChefPrefs;
  liked: string[];
  disliked: string[];
  plan: Plan;
  messages: UiMessage[];
  quickReplies: string[];
};

export type ChefViewProps = {
  userId: string;
  firstName: string;
  today: string;
  /** Día pedido desde el calendario (?date=); si no, hoy. */
  start: string;
  cards: DishCard[];
  busy: [SlotKey, string][];
  slots: MealSlot[];
  mealsPerDay: number;
  myKcal: number | null;
  minor: boolean;
  isParent: boolean;
  initialGoal: ChefPrefs["goal"];
  /** Llegó desde "por vencer": se preselecciona aprovechar lo que vence. */
  useExpiring: boolean;
};

const storageKey = (userId: string) => `chef:v1:${userId}`;

function readDraft(userId: string, today: string): Draft | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (d?.v !== 1 || !d.prefs) return null;
    // Un borrador de días que ya pasaron no sirve.
    if (d.prefs.start < today) return null;
    return d;
  } catch {
    return null;
  }
}

/**
 * Chef IA: 1) eliges objetivo y preferencias, 2) deslizas platos para calibrar tu gusto, 3) la IA arma
 * el plan, lo ajustas conversando o cambiando platos y lo pasas al calendario. El borrador se guarda
 * en este dispositivo para no perderlo al salir.
 */
export function ChefView(props: ChefViewProps) {
  const { userId, today, start, cards, slots, myKcal, initialGoal, useExpiring } = props;
  const t = useTranslations("chef");
  const fresh = (): Draft => ({
    v: 1,
    phase: "setup",
    prefs: { goal: initialGoal, scope: useExpiring ? "today" : start === today ? "week" : "today", prefs: useExpiring ? ["expiring", "pantry"] : [], start },
    liked: [],
    disliked: [],
    plan: {},
    messages: [],
    quickReplies: [],
  });
  const [draft, setDraft] = useState<Draft>(fresh);
  const [hydrated, setHydrated] = useState(false);
  const [pending, startTransition] = useTransition();
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [alternatives, setAlternatives] = useState<ChefReply["alternatives"]>(null);
  const highlightTimer = useRef<number | null>(null);

  // El borrador se lee después de montar (localStorage no existe en el servidor). Si se llegó con un
  // día o desde "por vencer", se empieza de cero con esos datos.
  useEffect(() => {
    const saved = readDraft(userId, today);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación única desde localStorage
    if (saved && start === today && !useExpiring) setDraft(saved);
    setHydrated(true);
  }, [userId, today, start, useExpiring]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(draft));
    } catch {
      // Sin almacenamiento (modo privado): el borrador vive solo en esta pestaña.
    }
  }, [draft, hydrated, userId]);

  // Cada paso empieza arriba (el botón para avanzar queda al final del anterior).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [draft.phase]);

  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const targets = dayTargets(myKcal, draft.prefs.goal);
  const dates = scopeDates(draft.prefs.scope, today, draft.prefs.start);
  const deck = useMemo(() => tasteDeck(cards, draft.prefs.goal, draft.prefs.prefs, slots), [cards, draft.prefs.goal, draft.prefs.prefs, slots]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  /** Aplica la respuesta del Chef: cambios al plan (resaltados un momento), mensaje y alternativas. */
  const receive = (reply: ChefReply) => {
    setDraft((d) => {
      const plan: Plan = { ...d.plan };
      for (const c of reply.changes) {
        if (c.recipeId) plan[c.key] = { recipeId: c.recipeId, reason: c.reason };
        else delete plan[c.key];
      }
      const messages = reply.message ? [...d.messages, { role: "model" as const, text: reply.message, offline: reply.offline }] : d.messages;
      return { ...d, plan, messages, quickReplies: reply.quickReplies };
    });
    if (reply.changes.length) {
      setHighlight(new Set(reply.changes.map((c) => c.key)));
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
      highlightTimer.current = window.setTimeout(() => setHighlight(new Set()), 2600);
    }
    if (reply.alternatives) setAlternatives(reply.alternatives);
    return reply;
  };

  const send = (intent: "build" | "message", text: string, base: Draft = draft) => {
    const userMsg: UiMessage = { role: "user", text };
    const history = intent === "message" ? [...base.messages, userMsg] : base.messages;
    setDraft({ ...base, phase: "plan", messages: [...base.messages, userMsg] });
    startTransition(async () => {
      try {
        const reply = await chefTurn({
          intent,
          prefs: base.prefs,
          history: history.map(({ role, text }) => ({ role, text })),
          plan: base.plan as Record<string, { recipeId: string; reason?: string }>,
          liked: base.liked,
          disliked: base.disliked,
        });
        receive(reply);
        if (intent === "message" && reply.changes.length) toast.success(t("updatedCount", { count: reply.changes.length }));
      } catch {
        toast.error(t("error"));
        setDraft((d) => ({ ...d, messages: [...d.messages, { role: "model", text: t("error"), offline: true }] }));
      }
    });
  };

  const build = (base: Draft = draft) => send("build", t("buildPrompt"), { ...base, plan: {} });

  const reset = () => {
    setAlternatives(null);
    setDraft(fresh());
  };

  if (!hydrated) return <div className="mt-24 flex justify-center text-4xl motion-safe:animate-pulse">✨</div>;

  return (
    <>
      <header className="flex items-center justify-between gap-2 pt-4 pb-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 text-white">
            <Sparkles className="size-4" />
          </span>
          {t("title")}
        </h1>
        {draft.phase !== "setup" && (
          <button onClick={reset} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground active:bg-muted">
            <RotateCcw className="size-4" /> {t("restart")}
          </button>
        )}
      </header>

      {draft.phase === "setup" && (
        <SetupStep
          {...props}
          prefs={draft.prefs}
          targets={targets}
          onChange={(prefs) => update({ prefs })}
          onTaste={() => update({ phase: "taste", liked: [], disliked: [] })}
          onBuild={() => build({ ...draft, liked: [], disliked: [] })}
        />
      )}

      {draft.phase === "taste" && (
        <TasteStep
          deck={deck}
          liked={draft.liked}
          disliked={draft.disliked}
          slots={slots}
          onDecide={(id, liked) =>
            setDraft((d) => (liked ? { ...d, liked: [...d.liked, id] } : { ...d, disliked: [...d.disliked, id] }))
          }
          onDone={(liked, disliked) => build({ ...draft, liked, disliked })}
          onBack={() => update({ phase: "setup" })}
        />
      )}

      {draft.phase === "plan" && (
        <PlanStep
          {...props}
          draft={draft}
          dates={dates}
          targets={targets}
          cardMap={cardMap}
          pending={pending}
          highlight={highlight}
          alternatives={alternatives}
          onAlternatives={setAlternatives}
          onSend={(text) => send("message", text)}
          onRebuild={() => build()}
          onEditPrefs={() => update({ phase: "setup" })}
          onSet={(key, recipeId) =>
            setDraft((d) => {
              const plan = { ...d.plan };
              if (recipeId) plan[key] = { recipeId };
              else delete plan[key];
              return { ...d, plan };
            })
          }
          onApplied={reset}
        />
      )}
    </>
  );
}
