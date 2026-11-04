"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { goalsFor, PREFS, type ChefPrefs, type DayTargets, type Goal, type Pref, type Scope } from "@/lib/chef";
import { addDays, parseDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const GOAL_EMOJI: Record<Goal, string> = { lose: "🔥", muscle: "💪", maintain: "⚖️", healthy: "🥗", energy: "⚡" };
const PREF_EMOJI: Record<Pref, string> = { pantry: "🏠", expiring: "⏳", quick: "⏱️", peruvian: "🇵🇪", american: "🇺🇸", veggie: "🌱" };

/** Ajustes del plan: meta del día, objetivo, cuántos días y preferencias. */
export function PrefsPanel({
  today, minor, myKcal, prefs, targets, onChange,
}: {
  today: string;
  minor: boolean;
  myKcal: number | null;
  prefs: ChefPrefs;
  targets: DayTargets;
  onChange: (prefs: ChefPrefs) => void;
}) {
  const t = useTranslations("chef");
  const locale = useLocale();
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", timeZone: "UTC" });
  const startsToday = prefs.start === today;
  const scopes: { key: Scope; label: string }[] = startsToday
    ? [
        { key: "today", label: t("scope.today") },
        { key: "tomorrow", label: t("scope.tomorrow") },
        { key: "week", label: t("scope.week") },
      ]
    : [
        { key: "today", label: dayFmt.format(parseDate(prefs.start)) },
        { key: "week", label: t("scope.weekFrom", { day: dayFmt.format(parseDate(prefs.start)) }) },
      ];

  const togglePref = (p: Pref) => {
    let next = prefs.prefs.includes(p) ? prefs.prefs.filter((x) => x !== p) : [...prefs.prefs, p];
    // Perú y USA juntos es lo mismo que ninguno.
    if (next.includes("peruvian") && next.includes("american")) next = next.filter((x) => x !== "peruvian" && x !== "american");
    onChange({ ...prefs, prefs: next });
  };

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 p-3 text-white">
        <span className="text-2xl">🎯</span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{t("targetLine", { kcal: targets.kcal })}</p>
          <p className="text-white/85">{t("targetMacros", { protein: targets.protein, carbs: targets.carbs, fat: targets.fat })}</p>
        </div>
        {myKcal == null && (
          <Link href="/weight" className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-fuchsia-700">
            {t("completeData")}
          </Link>
        )}
      </div>

      <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("goalQuestion")}</h3>
      <div className="grid grid-cols-2 gap-2">
        {goalsFor(minor).map((g, i, all) => {
          const active = prefs.goal === g;
          return (
            <button
              key={g}
              onClick={() => onChange({ ...prefs, goal: g })}
              aria-pressed={active}
              className={cn(
                "relative flex items-center gap-2 rounded-2xl border bg-card p-2.5 text-left transition-all active:scale-[0.97]",
                active ? "border-fuchsia-500 bg-fuchsia-50 ring-2 ring-fuchsia-500/30 dark:bg-fuchsia-950/30" : "",
                i === all.length - 1 && all.length % 2 === 1 && "col-span-2",
              )}
            >
              <span className="text-xl">{GOAL_EMOJI[g]}</span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{t(`goal.${g}`)}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{t(`goalHint.${g}`)}</span>
              </span>
              {active && (
                <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-fuchsia-600 text-white">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("scopeQuestion")}</h3>
      <div className="flex rounded-2xl bg-muted p-1">
        {scopes.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onChange({ ...prefs, scope: key, start: key === "tomorrow" ? today : prefs.start })}
            aria-pressed={prefs.scope === key}
            className={cn(
              "flex-1 rounded-xl px-2 py-2 text-sm font-medium capitalize transition-all",
              prefs.scope === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {prefs.scope === "week" && <p className="mt-1.5 text-xs text-muted-foreground">{t("weekRange", { to: dayFmt.format(parseDate(addDays(prefs.start, 6))) })}</p>}

      <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("prefsQuestion")}</h3>
      <div className="flex flex-wrap gap-2">
        {PREFS.map((p) => {
          const active = prefs.prefs.includes(p);
          return (
            <button
              key={p}
              onClick={() => togglePref(p)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all active:scale-95",
                active ? "border-transparent bg-foreground text-background" : "bg-card",
              )}
            >
              <span>{PREF_EMOJI[p]}</span>
              {t(`pref.${p}`)}
            </button>
          );
        })}
      </div>
      <p className="mt-5 text-center text-xs text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}
