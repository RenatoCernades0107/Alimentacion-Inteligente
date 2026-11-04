"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Clock, Link2, PencilLine, Sparkles } from "lucide-react";
import { Messages } from "@/components/chef/chat-panel";
import { MacroStack } from "@/components/chef/macros";
import { RecipeImage } from "@/components/recipe-image";
import { continueSharedPlan } from "@/app/actions/chef-share";
import { parseSlotKey, slotKey } from "@/lib/chef";
import { ALL_SLOTS } from "@/lib/meals";
import { parseDate } from "@/lib/dates";
import { localName } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { SharedPlan } from "@/lib/chef-share";

/**
 * Vista de un plan compartido por link (solo lectura): el plan por día y la conversación con el Chef.
 * "Seguir editando" lo copia como borrador propio (el dueño vuelve a su borrador original).
 */
export function SharedPlanView({ shared, signedIn }: { shared: SharedPlan; signedIn: boolean }) {
  const t = useTranslations("share");
  const tc = useTranslations("chef");
  const ts = useTranslations("slots");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { data, dishes } = shared;

  const dayLong = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  const updated = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(shared.updatedAt));

  // Días y franjas que de verdad tienen platos, en orden.
  const keys = Object.keys(data.plan).filter((k) => data.plan[k as keyof typeof data.plan] && dishes[data.plan[k as keyof typeof data.plan]!.recipeId]);
  const dates = [...new Set(keys.map((k) => parseSlotKey(k).date))].sort();
  const slots = ALL_SLOTS.filter((s) => keys.some((k) => parseSlotKey(k).slot === s));
  const [tab, setTab] = useState<"plan" | "chat">(dates.length ? "plan" : "chat");

  const cont = () =>
    startTransition(async () => {
      try {
        const id = await continueSharedPlan(shared.id);
        router.push(`/chef?draft=${id}`);
      } catch {
        toast.error(tc("error"));
      }
    });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t("linkCopied"));
    } catch {
      toast.error(tc("copyFailed"));
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pt-safe pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <header className="pt-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-fuchsia-600 uppercase">
          <span className="flex size-5 items-center justify-center rounded-md bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 text-white">
            <Sparkles className="size-3" />
          </span>
          {t("badge")}
        </p>
        <h1 className="mt-2 text-2xl leading-tight font-bold text-balance">{shared.title || t("untitled")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {shared.ownerName ? t("byOn", { name: shared.ownerName, date: updated }) : t("on", { date: updated })} ·{" "}
          {tc(`goal.${data.prefs.goal}`)}
        </p>
      </header>

      <div className="sticky top-0 z-10 -mx-4 mt-4 bg-background/95 px-4 py-2 backdrop-blur">
        <div className="flex rounded-xl bg-muted p-0.5 text-sm font-medium" role="tablist">
          {(["plan", "chat"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn("flex-1 rounded-[0.6rem] py-1.5 transition-all", tab === k ? "bg-background shadow-sm" : "text-muted-foreground")}
            >
              {k === "chat" ? tc("tabs.chat") : tc("tabs.plan", { count: keys.length })}
            </button>
          ))}
        </div>
      </div>

      {tab === "chat" ? (
        data.messages.length ? (
          <Messages messages={data.messages} pending={false} onShowPlan={() => setTab("plan")} />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("noChat")}</p>
        )
      ) : dates.length ? (
        <ol className="mt-2 space-y-6">
          {dates.map((date) => (
            <li key={date}>
              <h2 className="mb-2 text-sm font-semibold capitalize">{dayLong.format(parseDate(date))}</h2>
              <ul className="space-y-2">
                {slots.map((slot) => {
                  const entry = data.plan[slotKey(date, slot)];
                  const dish = entry && dishes[entry.recipeId];
                  if (!dish) return null;
                  return (
                    <li key={slot} className="rounded-2xl border bg-card p-2.5 shadow-sm">
                      <div className="flex gap-3">
                        <RecipeImage src={dish.image_url} emoji={dish.emoji} alt={localName(dish, locale)} className="size-16 rounded-xl text-2xl" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{ts(slot)}</p>
                          <p className="line-clamp-2 leading-tight font-semibold">{localName(dish, locale)}</p>
                          <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            {dish.kcal != null && <span>{t("kcalPerServing", { kcal: dish.kcal })}</span>}
                            {dish.time != null && (
                              <span className="inline-flex items-center gap-0.5">
                                <Clock className="size-3" /> {dish.time} min
                              </span>
                            )}
                          </p>
                          {dish.protein != null && <MacroStack macros={dish} className="mt-1.5" />}
                        </div>
                      </div>
                      {entry?.reason && (
                        <p className="mt-2 rounded-xl bg-fuchsia-50 px-3 py-1.5 text-xs text-fuchsia-900 dark:bg-fuchsia-950/40 dark:text-fuchsia-100">✨ {entry.reason}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("noPlan")}</p>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground">{tc("disclaimer")}</p>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-safe backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <button onClick={copyLink} aria-label={t("copyLink")} className="flex size-12 shrink-0 items-center justify-center rounded-2xl border bg-card active:scale-95">
            <Link2 className="size-5" />
          </button>
          {signedIn ? (
            <button
              onClick={shared.isMine && shared.draftId ? () => router.push(`/chef?draft=${shared.draftId}`) : cont}
              disabled={pending}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 font-semibold text-white shadow-md shadow-fuchsia-600/25 active:scale-[0.98] disabled:opacity-60"
            >
              <PencilLine className="size-5" /> {pending ? t("copying") : shared.isMine ? t("openMine") : t("continue")}
            </button>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(`/s/${shared.id}`)}`}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 font-semibold text-white shadow-md shadow-fuchsia-600/25 active:scale-[0.98]"
            >
              <PencilLine className="size-5" /> {t("loginToContinue")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
