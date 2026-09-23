"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MealDrawer, type MealDraft, type RecipeOption } from "@/components/meals/meal-drawer";
import type { MealSlot } from "@/lib/types";

export function AddRecipeToCalendar({
  recipeId, date, slot, slots, isParent, recipes,
}: {
  recipeId: string;
  date: string;
  slot: MealSlot;
  slots: MealSlot[];
  isParent: boolean;
  recipes: RecipeOption[];
}) {
  const t = useTranslations("recipes");
  const tc = useTranslations("calendar");
  const [draft, setDraft] = useState<MealDraft | null>(null);

  return (
    <>
      <Button size="lg" className="h-11 w-full text-base" onClick={() => setDraft({ date, slot, recipeId })}>
        <CalendarPlus className="size-5" /> {isParent ? t("addToCalendar") : tc("proposeMeal")}
      </Button>
      <MealDrawer draft={draft} onClose={() => setDraft(null)} recipes={recipes} slots={slots} isParent={isParent} />
    </>
  );
}
