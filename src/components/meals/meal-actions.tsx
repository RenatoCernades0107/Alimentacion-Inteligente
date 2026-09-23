"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { BookOpen, Check, Pencil, Trash2, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScopeDialog } from "@/components/meals/scope-dialog";
import { completeMeal, deleteMeal, reviewProposal, type Scope } from "@/app/actions/meals";
import { mealName, type Meal } from "@/lib/types";

export function MealActionsDrawer({
  meal, today, isParent, onClose, onEdit,
}: {
  meal: Meal | null;
  today: string;
  isParent: boolean;
  onClose: () => void;
  onEdit: (meal: Meal) => void;
}) {
  return (
    <Drawer open={!!meal} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>{meal && <MealActions meal={meal} today={today} isParent={isParent} onClose={onClose} onEdit={onEdit} />}</DrawerContent>
    </Drawer>
  );
}

function MealActions({ meal, today, isParent, onClose, onEdit }: { meal: Meal; today: string; isParent: boolean; onClose: () => void; onEdit: (m: Meal) => void }) {
  const t = useTranslations("calendar");
  const ts = useTranslations("slots");
  const tr = useTranslations("recurrence");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [askScope, setAskScope] = useState(false);

  const run = (fn: () => Promise<unknown>, success?: string) =>
    start(async () => {
      try {
        await fn();
        if (success) toast.success(success);
        onClose();
      } catch {
        toast.error(tc("error"));
      }
    });

  function complete() {
    start(async () => {
      try {
        const report = await completeMeal(meal.id, locale);
        const lines = [
          report.used.length ? t("usedIngredients", { list: report.used.map((u) => `${u.name} (${u.amount})`).join(", ") }) : null,
          report.missing.length ? t("missingIngredients", { list: report.missing.join(", ") }) : null,
        ].filter(Boolean);
        toast.success(t("completedToast"), { description: lines.join("\n"), duration: 6000 });
        onClose();
      } catch {
        toast.error(tc("error"));
      }
    });
  }

  function remove(scope: Scope) {
    setAskScope(false);
    run(() => deleteMeal(meal.id, scope));
  }

  return (
    <>
      <DrawerHeader className="items-center text-center">
        <div className="text-4xl">{meal.recipe?.emoji ?? "🍽️"}</div>
        <DrawerTitle className="text-lg">{mealName(meal, locale)}</DrawerTitle>
        <p className="text-sm text-muted-foreground">
          {ts(meal.slot)}
          {meal.series?.recurrence && ` · ${tr(meal.series.recurrence)}`}
        </p>
        {meal.status === "proposed" && meal.proposer?.full_name && (
          <p className="text-sm text-amber-700">{t("proposedBy", { name: meal.proposer.full_name })}</p>
        )}
      </DrawerHeader>

      <div className="flex flex-col gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {meal.recipe && (
          <Link href={`/recipes/${meal.recipe.slug}`} className={buttonVariants({ variant: "outline", size: "lg", className: "h-11" })}>
            <BookOpen /> {t("viewRecipe")}
          </Link>
        )}

        {isParent && meal.status === "proposed" && (
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="outline" className="h-11" disabled={pending} onClick={() => run(() => reviewProposal(meal.id, false))}>
              <X /> {t("reject")}
            </Button>
            <Button size="lg" className="h-11" disabled={pending} onClick={() => run(() => reviewProposal(meal.id, true), tc("saved"))}>
              <Check /> {t("accept")}
            </Button>
          </div>
        )}

        {isParent && meal.status === "planned" && meal.date <= today && (
          <Button size="lg" className="h-11" disabled={pending} onClick={complete}>
            <Check /> {t("complete")}
          </Button>
        )}

        {isParent && meal.status !== "completed" && (
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="outline" className="h-11" disabled={pending} onClick={() => onEdit(meal)}>
              <Pencil /> {tc("edit")}
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="h-11"
              disabled={pending}
              onClick={() => (meal.series_id ? setAskScope(true) : remove("one"))}
            >
              <Trash2 /> {tc("delete")}
            </Button>
          </div>
        )}
      </div>

      <ScopeDialog open={askScope} action="delete" onCancel={() => setAskScope(false)} onChoose={remove} />
    </>
  );
}
