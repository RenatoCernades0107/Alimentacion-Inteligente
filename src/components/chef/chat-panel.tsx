"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight, ArrowUp, Brain, CalendarClock, Check, ChevronRight, Copy, ExternalLink, Globe, Heart, LayoutList, Loader2, SlidersHorizontal, Sparkles } from "lucide-react";
import { RichText } from "@/components/chef/rich-text";
import { GOAL_EMOJI } from "@/components/chef/prefs-panel";
import { parseSlotKey, type CalendarProposal, type ChefPrefs, type DayTargets, type Thinking, type UiMessage } from "@/lib/chef";
import { parseDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Sugerencia de la pantalla vacía: el texto que se envía y, si aplica, cómo deja los ajustes. */
export type Starter = { emoji: string; label: string; text: string; prefs?: Partial<ChefPrefs> };

export function ChefAvatar({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 text-white", className)}>
      <Sparkles className="size-3.5" />
    </span>
  );
}

/** Pantalla de un borrador nuevo: saludo, ajustes actuales y sugerencias para empezar (como ChatGPT). */
export function Welcome({
  firstName, prefs, targets, starters, onStarter, onTaste, onSettings,
}: {
  firstName: string;
  prefs: ChefPrefs;
  targets: DayTargets;
  starters: Starter[];
  onStarter: (s: Starter) => void;
  onTaste: () => void;
  onSettings: () => void;
}) {
  const t = useTranslations("chef");
  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 text-white shadow-lg shadow-fuchsia-600/25">
        <Sparkles className="size-7" />
      </span>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-balance">{t("welcomeTitle", { name: firstName })}</h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{t("welcomeBody")}</p>

      <button
        onClick={onSettings}
        className="mt-4 inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-sm active:scale-95"
      >
        <span>{GOAL_EMOJI[prefs.goal]}</span>
        <span className="truncate">
          {t(`goal.${prefs.goal}`)} · {t(`scope.${prefs.scope}`)} · {t("targetLine", { kcal: targets.kcal })}
        </span>
        <SlidersHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      <div className="mt-6 grid w-full grid-cols-2 gap-2">
        {starters.map((s) => (
          <button
            key={s.label}
            onClick={() => onStarter(s)}
            className="flex flex-col items-start gap-1 rounded-2xl border bg-card p-3 text-left text-sm shadow-sm transition-transform active:scale-[0.97]"
          >
            <span className="text-lg">{s.emoji}</span>
            <span className="font-medium leading-snug">{s.label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onTaste}
        className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 p-3 text-left text-white shadow-md shadow-fuchsia-600/20 active:scale-[0.98]"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/20">
          <Heart className="size-5 fill-current" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t("startTaste")}</span>
          <span className="block text-xs text-white/85">{t("tasteHint")}</span>
        </span>
      </button>
      <p className="mt-6 text-xs text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}

/** Lo que el Chef va pensando mientras responde (pasos y razonamiento del modelo, en vivo). */
export type LiveThinking = { steps: string[]; text: string; startedAt: number };

/** Conversación: burbujas del usuario a la derecha y respuestas del Chef a todo el ancho. */
export function Messages({
  messages, live, onShowPlan, calendar,
}: {
  messages: UiMessage[];
  live: LiveThinking | null;
  onShowPlan: () => void;
  /** Para los cambios propuestos al calendario (sin esto, la tarjeta solo se muestra). */
  calendar?: CalendarActions;
}) {
  const pending = !!live;
  const t = useTranslations("chef");
  const end = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState<number | null>(null);

  // Al abrir un borrador se empieza por el final de la conversación.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, []);

  // Baja al último mensaje cuando llega uno nuevo o empieza a pensar.
  const seen = useRef(messages.length);
  useEffect(() => {
    if (messages.length === seen.current && !pending) return;
    seen.current = messages.length;
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  const copy = async (i: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      window.setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500);
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <ul className="space-y-5 pt-2">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <li key={i} className="flex justify-end">
            <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-muted px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words">{m.text}</p>
          </li>
        ) : (
          <li key={i} className="flex gap-2.5">
            <ChefAvatar className="mt-0.5" />
            <div className="min-w-0 flex-1">
              {m.thinking && <ThoughtToggle thinking={m.thinking} />}
              <div
                className={cn(
                  "text-[15px] leading-relaxed break-words",
                  m.offline && "rounded-2xl bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
                )}
              >
                <RichText text={m.text} />
              </div>
              {!!m.dropped && <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">⚠️ {t("dropped", { count: m.dropped })}</p>}
              {m.calendar && m.calendar.changes.length > 0 && <CalendarCard index={i} proposal={m.calendar} actions={calendar} />}
              {!!m.changes && (
                <button
                  onClick={onShowPlan}
                  className="mt-2.5 flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left shadow-sm active:scale-[0.99]"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300">
                    <LayoutList className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t("updatedCount", { count: m.changes })}</span>
                    <span className="block text-xs text-muted-foreground">{t("seePlan")}</span>
                  </span>
                </button>
              )}
              {!!m.sources?.length && (
                <div className="mt-2.5">
                  <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Globe className="size-3.5" /> {t("sources")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.sources.map((s) => (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        title={s.title}
                        className="inline-flex max-w-full items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs"
                      >
                        <span className="truncate font-medium">{hostOf(s.url)}</span>
                        <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => copy(i, m.text)}
                aria-label={t("copyMessage")}
                className="mt-1 -ml-1.5 rounded-lg p-1.5 text-muted-foreground active:bg-muted"
              >
                {copied === i ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </div>
          </li>
        ),
      )}
      {live && (
        <li className="flex gap-2.5">
          <ChefAvatar className="mt-0.5" />
          <ThinkingLive live={live} onGrow={() => end.current?.scrollIntoView({ block: "end" })} />
        </li>
      )}
      <div ref={end} />
    </ul>
  );
}

export type CalendarActions = {
  /** Nombre del plato (null si ya no existe). */
  dishName: (recipeId: string) => string | null;
  /** Índice del mensaje cuyos cambios se están aplicando. */
  applying: number | null;
  /** Solo se puede aplicar si no hay otra cosa en curso. */
  disabled: boolean;
  isParent: boolean;
  onApply: (index: number) => void;
  onDismiss: (index: number) => void;
};

/** Cambios que el Chef propone a comidas que ya están en el calendario: se aplican al confirmar. */
function CalendarCard({ index, proposal, actions }: { index: number; proposal: CalendarProposal; actions?: CalendarActions }) {
  const t = useTranslations("chef");
  const ts = useTranslations("slots");
  const locale = useLocale();
  const day = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const applying = actions?.applying === index;
  const done = proposal.status !== "pending";
  return (
    <div className={cn("mt-2.5 rounded-2xl border bg-card p-3 shadow-sm", done && "opacity-70")}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-7 items-center justify-center rounded-lg bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/50 dark:text-fuchsia-300">
          <CalendarClock className="size-4" />
        </span>
        {t("calendar.title", { count: proposal.changes.length })}
      </p>
      <ul className="mt-2 space-y-2">
        {proposal.changes.map((c) => {
          const { date, slot } = parseSlotKey(c.key);
          const after = c.recipeId ? actions?.dishName(c.recipeId) : null;
          return (
            <li key={c.key} className="text-sm">
              <p className="text-xs font-medium text-muted-foreground capitalize">
                {day.format(parseDate(date))} · {ts(slot)}
              </p>
              <p className="flex flex-wrap items-center gap-x-1.5 leading-snug">
                <span className="text-muted-foreground line-through decoration-muted-foreground/50">{c.before}</span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="font-medium">{c.recipeId ? (after ?? t("calendar.unknownDish")) : t("calendar.remove")}</span>
              </p>
              {c.reason && <p className="text-xs text-muted-foreground">✨ {c.reason}</p>}
            </li>
          );
        })}
      </ul>
      {proposal.status === "pending" && actions ? (
        <>
          {!actions.isParent && <p className="mt-2 text-xs text-muted-foreground">{t("calendar.kidNote")}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => actions.onApply(index)}
              disabled={actions.disabled || applying}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
            >
              {applying ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {applying ? t("applying") : actions.isParent ? t("calendar.apply") : t("calendar.propose")}
            </button>
            <button
              onClick={() => actions.onDismiss(index)}
              disabled={applying}
              className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold active:bg-muted/70 disabled:opacity-60"
            >
              {t("calendar.dismiss")}
            </button>
          </div>
        </>
      ) : (
        done && <p className="mt-2 text-xs font-medium text-muted-foreground">{proposal.status === "applied" ? `✓ ${t("calendar.applied")}` : t("calendar.dismissed")}</p>
      )}
    </div>
  );
}

/** Segundos desde que empezó a pensar (se actualiza cada segundo). */
function useElapsed(since: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return Math.max(0, Math.round((now - since) / 1000));
}

/** Mientras responde: los pasos que va dando y su razonamiento, que se va escribiendo. */
function ThinkingLive({ live, onGrow }: { live: LiveThinking; onGrow: () => void }) {
  const t = useTranslations("chef");
  const seconds = useElapsed(live.startedAt);
  const box = useRef<HTMLDivElement>(null);
  const steps = live.steps.length ? live.steps : [t("steps.sending")];

  // El razonamiento se sigue desde el final (como si se leyera mientras escribe).
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [live.text]);
  // Cada paso nuevo baja la conversación para que se vea.
  const grow = useRef(onGrow);
  useEffect(() => {
    grow.current = onGrow;
  });
  const hasText = live.text.length > 0;
  useEffect(() => {
    grow.current();
  }, [steps.length, hasText]);

  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-fuchsia-200/70 bg-fuchsia-50/40 p-3 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/20" aria-live="polite" aria-label={t("thinking")}>
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Brain className="size-4 text-fuchsia-600 motion-safe:animate-pulse" />
        <span className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 bg-clip-text text-transparent">{t("thinkingShort")}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{seconds} s</span>
      </p>
      <StepList steps={steps} running className="mt-2" />
      {live.text && (
        <div
          ref={box}
          className="mt-2 max-h-40 overflow-y-auto border-l-2 border-fuchsia-300 pl-3 text-[13px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground dark:border-fuchsia-800"
        >
          {live.text}
        </div>
      )}
    </div>
  );
}

function StepList({ steps, running, className }: { steps: string[]; running?: boolean; className?: string }) {
  return (
    <ol className={cn("space-y-1", className)}>
      {steps.map((s, i) => {
        const current = running && i === steps.length - 1;
        return (
          <li key={i} className={cn("flex items-start gap-2 text-xs", current ? "text-foreground" : "text-muted-foreground")}>
            {current ? (
              <Loader2 className="mt-px size-3.5 shrink-0 animate-spin text-fuchsia-600" />
            ) : (
              <Check className="mt-px size-3.5 shrink-0 text-emerald-600" />
            )}
            <span className="min-w-0 break-words">{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Bajo una respuesta: "Pensó 8 s", que se abre para ver los pasos y el razonamiento. */
function ThoughtToggle({ thinking }: { thinking: Thinking }) {
  const t = useTranslations("chef");
  const [open, setOpen] = useState(false);
  const seconds = Math.max(1, Math.round(thinking.ms / 1000));
  if (!thinking.steps.length && !thinking.text) return null;
  return (
    <div className="mb-1.5">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t("hideThinking") : t("showThinking")}
        className="-ml-1 inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-xs font-medium text-muted-foreground active:bg-muted"
      >
        <Brain className="size-3.5" />
        {t("thoughtFor", { seconds })}
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="mt-1.5 mb-2 border-l-2 border-muted pl-3">
          <StepList steps={thinking.steps} />
          {thinking.text && <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">{thinking.text}</p>}
        </div>
      )}
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Caja para escribir: crece con el texto; Enter envía y Shift+Enter hace salto de línea. */
export function Composer({ pending, onSend, quickReplies }: { pending: boolean; onSend: (text: string) => void; quickReplies: string[] }) {
  const t = useTranslations("chef");
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v || pending) return;
    setText("");
    onSend(v);
  };

  return (
    <div>
      {quickReplies.length > 0 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {quickReplies.map((q) => (
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
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex items-end gap-2 rounded-[1.6rem] border bg-card p-1.5 pl-4 shadow-sm focus-within:ring-2 focus-within:ring-fuchsia-500/30"
      >
        <textarea
          ref={ref}
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit(text);
            }
          }}
          maxLength={2000}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          enterKeyHint="send"
          className="max-h-40 min-w-0 flex-1 resize-none bg-transparent py-2 text-base leading-6 outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={pending || !text.trim()}
          aria-label={t("send")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-30"
        >
          <ArrowUp className="size-5" />
        </button>
      </form>
    </div>
  );
}
