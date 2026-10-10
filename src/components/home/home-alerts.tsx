"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BellRing, ChevronRight, Clock, Scale, TriangleAlert, type LucideIcon } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { FoodImage } from "@/components/food-image";
import { ExpiryBadge } from "@/components/inventory/expiry-badge";
import { PushCard } from "@/components/family/push-card";
import { HomeMeals } from "@/components/meals/home-meals";
import { itemName, type InventoryItem, type Meal, type MealSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

type Panel = "proposals" | "pending" | "expiring";

/**
 * Avisos del inicio en una fila de píldoras: lo que antes ocupaba toda la pantalla "Hoy" (propuestas
 * de los hijos, comidas sin marcar, alimentos por vencer) cabe sobre el calendario sin empujarlo.
 * Cada píldora abre su lista en una hoja inferior.
 */
export function HomeAlerts({
  today, isParent, slots, mealsPerDay, myKcal, needsBody, proposals, pending, expiring,
}: {
  today: string;
  isParent: boolean;
  slots: MealSlot[];
  mealsPerDay: number;
  myKcal: number | null;
  needsBody: boolean;
  proposals: Meal[];
  pending: Meal[];
  expiring: InventoryItem[];
}) {
  const t = useTranslations("home");
  const tw = useTranslations("weight");
  const locale = useLocale();
  const [open, setOpen] = useState<Panel | null>(null);
  const soon = expiring.filter((i) => i.expires_on && i.expires_on <= today).length;

  const pills: { key: Panel; icon: LucideIcon; label: string; tone: string; show: boolean }[] = [
    { key: "proposals", icon: BellRing, label: t("proposalsPill", { count: proposals.length }), tone: "bg-amber-100 text-amber-900 ring-amber-200", show: proposals.length > 0 },
    { key: "pending", icon: Clock, label: t("pendingPill", { count: pending.length }), tone: "bg-sky-100 text-sky-900 ring-sky-200", show: pending.length > 0 },
    {
      key: "expiring",
      icon: TriangleAlert,
      label: t("expiringPill", { count: expiring.length }),
      tone: soon > 0 ? "bg-red-100 text-red-800 ring-red-200" : "bg-orange-50 text-orange-900 ring-orange-200",
      show: expiring.length > 0,
    },
  ];
  const visible = pills.filter((p) => p.show);

  return (
    <>
      <PushCard compact />

      {(visible.length > 0 || needsBody) && (
        <div className="-mx-4 mt-1 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {visible.map(({ key, icon: Icon, label, tone }) => (
            <button
              key={key}
              onClick={() => setOpen(key)}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-transform active:scale-95", tone)}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
          {needsBody && (
            <Link href="/weight" className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary ring-1 ring-primary/20">
              <Scale className="size-4" />
              {tw("cardAction")}
            </Link>
          )}
        </div>
      )}

      <Drawer open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {open === "proposals" && (
              <>
                <DrawerHeader className="px-0">
                  <DrawerTitle>{t("proposals")}</DrawerTitle>
                </DrawerHeader>
                <HomeMeals meals={proposals} today={today} isParent={isParent} slots={slots} showDate mealsPerDay={mealsPerDay} myKcal={myKcal} />
              </>
            )}
            {open === "pending" && (
              <>
                <DrawerHeader className="px-0">
                  <DrawerTitle>{t("pendingCompletion")}</DrawerTitle>
                  <DrawerDescription>{t("pendingCompletionHint")}</DrawerDescription>
                </DrawerHeader>
                <HomeMeals meals={pending} today={today} isParent={isParent} slots={slots} showDate mealsPerDay={mealsPerDay} myKcal={myKcal} />
              </>
            )}
            {open === "expiring" && (
              <>
                <DrawerHeader className="px-0">
                  <DrawerTitle>{t("expiring")}</DrawerTitle>
                  <DrawerDescription>{t("expiringHint")}</DrawerDescription>
                </DrawerHeader>
                <ul className="divide-y rounded-2xl border bg-card">
                  {expiring.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 p-3">
                      <FoodImage src={item.image_url ?? item.food?.image_url} emoji={item.food?.emoji ?? "📦"} alt={itemName(item, locale)} className="size-10" />
                      <span className="min-w-0 flex-1 truncate font-medium">{itemName(item, locale)}</span>
                      <ExpiryBadge expiresOn={item.expires_on} estimated={item.expiry_estimated} today={today} />
                    </li>
                  ))}
                </ul>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link href="/inventory" className="flex items-center justify-center gap-1 rounded-xl border p-3 text-sm font-medium" onClick={() => setOpen(null)}>
                    {t("seeInventory")} <ChevronRight className="size-4" />
                  </Link>
                  <Link href="/chef?use=expiring" className="flex items-center justify-center gap-1 rounded-xl bg-primary p-3 text-sm font-medium text-primary-foreground" onClick={() => setOpen(null)}>
                    ✨ {t("cookWithChef")}
                  </Link>
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
