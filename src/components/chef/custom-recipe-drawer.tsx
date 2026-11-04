"use client";

import { useLocale, useTranslations } from "next-intl";
import { Clock, Flame, Users } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { RecipeImage } from "@/components/recipe-image";
import { MacroInline } from "@/components/chef/macros";
import { CustomBadge } from "@/components/chef/plan-panel";
import { formatQuantity } from "@/lib/units";
import type { CustomDish } from "@/lib/chef";

/** Receta nueva del Chef: ingredientes y pasos (todavía no está guardada en "Recetas"). */
export function CustomRecipeDrawer({ dish, onClose }: { dish: CustomDish | null; onClose: () => void }) {
  const t = useTranslations("chef");
  const tu = useTranslations("units");
  const locale = useLocale();
  const r = dish?.recipe;
  const card = dish?.card;
  const name = r ? (locale === "en" ? r.name_en : r.name_es) : "";

  return (
    <Drawer open={!!dish} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>
        {r && card && (
          <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-0">
              <div className="flex items-center gap-3">
                <RecipeImage emoji={r.emoji} className="size-16 rounded-2xl text-4xl" />
                <div className="min-w-0 text-left">
                  <CustomBadge />
                  <DrawerTitle className="mt-1 text-lg leading-tight">{name}</DrawerTitle>
                </div>
              </div>
              <DrawerDescription className="text-left">{r.description || t("custom.hint")}</DrawerDescription>
            </DrawerHeader>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="size-4" /> {t("custom.servings", { count: r.servings })}
              </span>
              {r.time_minutes != null && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-4" /> {r.time_minutes} min
                </span>
              )}
              {card.kcal != null && (
                <span className="inline-flex items-center gap-1">
                  <Flame className="size-4" /> {card.kcal} kcal
                </span>
              )}
            </div>
            {card.protein != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("custom.perServing")}: <MacroInline macros={card} />
              </p>
            )}

            <h3 className="mt-5 mb-2 font-semibold">{t("custom.ingredients")}</h3>
            <ul className="divide-y rounded-2xl border">
              {r.ingredients.map((i) => (
                <li key={i.foodId} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-6 text-center text-lg" aria-hidden>
                    {i.emoji || "•"}
                  </span>
                  <span className="min-w-0 flex-1">
                    {locale === "en" ? i.name_en : i.name_es}
                    {i.optional && <span className="text-muted-foreground"> ({t("custom.optional")})</span>}
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {i.quantity != null && i.unit ? `${formatQuantity(i.quantity)} ${tu(i.unit)}` : t("custom.toTaste")}
                  </span>
                </li>
              ))}
            </ul>

            <h3 className="mt-5 mb-2 font-semibold">{t("custom.steps")}</h3>
            <ol className="space-y-2">
              {r.steps.map((s, n) => (
                <li key={n} className="flex gap-3 text-sm leading-relaxed">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-xs font-bold text-fuchsia-800 dark:bg-fuchsia-950/60 dark:text-fuchsia-200">
                    {n + 1}
                  </span>
                  <span className="min-w-0 flex-1">{s}</span>
                </li>
              ))}
            </ol>

            <p className="mt-5 rounded-xl bg-fuchsia-50 px-3 py-2 text-xs text-fuchsia-900 dark:bg-fuchsia-950/40 dark:text-fuchsia-100">✨ {t("custom.hint")}</p>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
