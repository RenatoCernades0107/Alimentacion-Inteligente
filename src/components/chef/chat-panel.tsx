"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowUp, Check, Copy, ExternalLink, Globe, Heart, LayoutList, SlidersHorizontal, Sparkles } from "lucide-react";
import { RichText } from "@/components/chef/rich-text";
import { GOAL_EMOJI } from "@/components/chef/prefs-panel";
import type { ChefPrefs, DayTargets, UiMessage } from "@/lib/chef";
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

/** Conversación: burbujas del usuario a la derecha y respuestas del Chef a todo el ancho. */
export function Messages({ messages, pending, onShowPlan }: { messages: UiMessage[]; pending: boolean; onShowPlan: () => void }) {
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
              <div
                className={cn(
                  "text-[15px] leading-relaxed break-words",
                  m.offline && "rounded-2xl bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
                )}
              >
                <RichText text={m.text} />
              </div>
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
      {pending && (
        <li className="flex items-center gap-2.5">
          <ChefAvatar />
          <span className="flex items-center gap-1" aria-label={t("thinking")}>
            {[0, 150, 300].map((d) => (
              <span key={d} className="size-2 animate-bounce rounded-full bg-fuchsia-500" style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
          <span className="text-sm text-muted-foreground">{t("thinkingShort")}</span>
        </li>
      )}
      <div ref={end} />
    </ul>
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
