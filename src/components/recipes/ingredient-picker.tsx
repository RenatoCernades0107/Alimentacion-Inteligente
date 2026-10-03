"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { FoodImage } from "@/components/food-image";
import { createClient } from "@/lib/supabase/client";
import { localName, type Food } from "@/lib/types";

/** Lo que el formulario necesita saber de un alimento elegido como ingrediente. */
export type PickedFood = Pick<Food, "id" | "name_es" | "name_en" | "emoji" | "image_url" | "default_unit" | "family_id">;

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/**
 * Buscador de alimentos para agregar un ingrediente: el catálogo y los alimentos propios de la familia
 * (la función `search_foods` ya filtra por familia y tolera tildes y errores de tipeo).
 */
export function IngredientPicker({
  open, onOpenChange, onPick, exclude,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (food: PickedFood) => void;
  /** Alimentos que ya están en la receta (una receta no repite ingredientes). */
  exclude: string[];
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[92dvh]">{open && <PickerBody onPick={onPick} exclude={exclude} />}</DrawerContent>
    </Drawer>
  );
}

function PickerBody({ onPick, exclude }: { onPick: (food: PickedFood) => void; exclude: string[] }) {
  const t = useTranslations("myRecipes");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 250);
  const [results, setResults] = useState<{ q: string; foods: Food[] }>({ q: "", foods: [] });

  useEffect(() => {
    if (!debounced) return;
    let cancelled = false;
    createClient()
      .rpc("search_foods", { p_query: debounced, p_limit: 20 })
      .then(({ data }) => !cancelled && setResults({ q: debounced, foods: (data as Food[]) ?? [] }));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const loaded = !!debounced && results.q === debounced;
  const foods = loaded ? results.foods.filter((f) => !exclude.includes(f.id)) : [];

  return (
    <>
      <DrawerHeader className="text-left">
        <DrawerTitle className="text-lg">{t("pickerTitle")}</DrawerTitle>
      </DrawerHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pickerPlaceholder")}
            aria-label={t("pickerTitle")}
            className="h-10 pl-9"
          />
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {foods.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onPick(f)}
              className="flex w-full items-center gap-3 rounded-xl p-2 text-left active:bg-muted"
            >
              <FoodImage src={f.image_url} emoji={f.emoji} alt={localName(f, locale)} />
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 font-medium leading-snug">{localName(f, locale)}</div>
                {f.family_id && <div className="text-sm text-muted-foreground">{t("customFood")}</div>}
              </div>
            </button>
          ))}
          {!debounced && <p className="py-8 text-center text-sm text-muted-foreground">{t("pickerHint")}</p>}
          {loaded && foods.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("pickerNoResults", { query: debounced })}</p>
          )}
        </div>
      </div>
    </>
  );
}
