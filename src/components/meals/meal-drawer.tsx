"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Search, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { ScopeDialog } from "@/components/meals/scope-dialog";
import { addMeal, updateMeal, type Scope } from "@/app/actions/meals";
import { mealTypeForSlot, RECURRENCES } from "@/lib/meals";
import { localName, type MealSlot, type Recurrence, type Recipe } from "@/lib/types";
import { cn } from "@/lib/utils";

export type RecipeOption = Pick<Recipe, "id" | "slug" | "name_es" | "name_en" | "emoji" | "meal_types" | "country">;

export type MealDraft = {
  id?: string;
  seriesId?: string | null;
  date: string;
  slot: MealSlot;
  recipeId?: string | null;
  title?: string | null;
  recurrence?: Recurrence | null;
};

export function MealDrawer({
  draft, onClose, recipes, slots, isParent,
}: {
  draft: MealDraft | null;
  onClose: () => void;
  recipes: RecipeOption[];
  slots: MealSlot[];
  isParent: boolean;
}) {
  return (
    <Drawer open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="h-[92dvh]">
        {draft && <MealForm key={draft.id ?? `${draft.date}-${draft.slot}-${draft.recipeId}`} draft={draft} onClose={onClose} recipes={recipes} slots={slots} isParent={isParent} />}
      </DrawerContent>
    </Drawer>
  );
}

function MealForm({
  draft, onClose, recipes, slots, isParent,
}: {
  draft: MealDraft;
  onClose: () => void;
  recipes: RecipeOption[];
  slots: MealSlot[];
  isParent: boolean;
}) {
  const t = useTranslations("calendar");
  const ts = useTranslations("slots");
  const tr = useTranslations("recurrence");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [pending, start] = useTransition();

  const [date, setDate] = useState(draft.date);
  const [slot, setSlot] = useState<MealSlot>(draft.slot);
  const [recipeId, setRecipeId] = useState<string | null>(draft.recipeId ?? null);
  const [title, setTitle] = useState(draft.title ?? "");
  const [recurrence, setRecurrence] = useState<Recurrence | "">(draft.recurrence ?? "");
  const [query, setQuery] = useState("");
  const [askScope, setAskScope] = useState(false);

  const isEdit = !!draft.id;
  const isSeries = !!draft.seriesId;
  const selected = recipes.find((r) => r.id === recipeId);

  const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const type = mealTypeForSlot(slot);
  const options = recipes
    .filter((r) => (query ? normalize(r.name_es + " " + r.name_en).includes(normalize(query)) : r.meal_types.includes(type)))
    .slice(0, 30);

  function save(scope: Scope = "one") {
    const input = { date, slot, recipe_id: recipeId, title: recipeId ? null : title, recurrence: recurrence || null };
    start(async () => {
      try {
        if (isEdit) await updateMeal(draft.id!, input, scope);
        else await addMeal(input);
        toast.success(isParent ? tc("saved") : t("proposalSent"));
        onClose();
      } catch {
        toast.error(tc("error"));
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isEdit && isSeries) setAskScope(true);
    else save();
  }

  // En una serie, la recurrencia solo se cambia al editar "toda la recurrencia".
  const showRecurrence = isParent && (!isEdit || isSeries);

  return (
    <>
      <DrawerHeader className="text-left">
        <DrawerTitle className="text-lg">{isEdit ? tc("edit") : isParent ? t("addMeal") : t("proposeMeal")}</DrawerTitle>
        {!isParent && <p className="text-sm text-muted-foreground">{t("childHint")}</p>}
      </DrawerHeader>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="mdate">{t("date")}</Label>
            <Input id="mdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mslot">{t("slot")}</Label>
            <NativeSelect id="mslot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
              {slots.map((s) => <option key={s} value={s}>{ts(s)}</option>)}
            </NativeSelect>
          </div>
        </div>

        {showRecurrence && (
          <div className="space-y-2">
            <Label htmlFor="mrec">{t("repeat")}</Label>
            <NativeSelect id="mrec" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence | "")}>
              {!isSeries && <option value="">{tr("none")}</option>}
              {RECURRENCES.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
            </NativeSelect>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <Label>{t("recipe")}</Label>
          {selected ? (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/50 p-2">
              <span className="text-2xl">{selected.emoji}</span>
              <span className="flex-1 font-medium">{localName(selected, locale)}</span>
              <Button type="button" variant="ghost" size="icon" onClick={() => setRecipeId(null)} aria-label={tc("close")}>
                <X />
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchRecipe")} className="h-10 pl-9" />
              </div>
              <ul className="min-h-24 flex-1 overflow-y-auto rounded-xl border">
                {options.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setRecipeId(r.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left active:bg-muted">
                      <span className="text-xl">{r.emoji}</span>
                      <span className="flex-1">{localName(r, locale)}</span>
                      <span className="text-sm">{r.country === "PE" ? "🇵🇪" : "🇺🇸"}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <Label htmlFor="mtitle">{t("customTitle")}</Label>
                <Input id="mtitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("customTitlePlaceholder")} maxLength={80} className="h-10" />
              </div>
            </>
          )}
        </div>

        <Button type="submit" size="lg" className={cn("h-11 w-full text-base")} disabled={pending || (!recipeId && !title.trim())}>
          {isParent ? tc("save") : t("proposeMeal")}
        </Button>
      </form>
      <ScopeDialog
        open={askScope}
        action="edit"
        onCancel={() => setAskScope(false)}
        onChoose={(scope) => {
          setAskScope(false);
          save(scope);
        }}
      />
    </>
  );
}
