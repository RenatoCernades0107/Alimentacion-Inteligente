"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FoodImage } from "@/components/food-image";
import { StoreBadges } from "@/components/store-badges";
import { createClient } from "@/lib/supabase/client";
import { localName, type Food } from "@/lib/types";
import type { StoreId } from "@/lib/stores";

export function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function ResultRow({
  image, emoji, title, subtitle, stores, onClick,
}: {
  image: string | null;
  emoji: string | null;
  title: string;
  subtitle?: string;
  stores?: StoreId[];
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl p-2 text-left active:bg-muted">
      <FoodImage src={image} emoji={emoji} alt={title} />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 font-medium leading-snug">{title}</div>
        {subtitle && <div className="truncate text-sm text-muted-foreground">{subtitle}</div>}
        {stores && stores.length > 0 && <StoreBadges stores={stores} className="mt-1" />}
      </div>
    </button>
  );
}

/** "Se cuenta como 🥛 Leche · Cambiar"; si no se reconoce, un buscador de alimentos genéricos. */
export function GenericFoodLink({
  food, guessing, picking, onChange, onPick,
}: {
  food: Food | null;
  guessing: boolean;
  picking: boolean;
  onChange: () => void;
  onPick: (f: Food) => void;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 250);
  const [results, setResults] = useState<{ q: string; foods: Food[] }>({ q: "", foods: [] });

  useEffect(() => {
    if (!debounced) return;
    let cancelled = false;
    createClient()
      .rpc("search_foods", { p_query: debounced, p_limit: 6 })
      .then(({ data }) => !cancelled && setResults({ q: debounced, foods: (data as Food[]) ?? [] }));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  if (guessing) return <p className="text-sm text-muted-foreground">{t("recognizing")}</p>;

  if (!picking && food) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-2.5">
        <FoodImage src={food.image_url} emoji={food.emoji} alt={localName(food, locale)} className="size-10" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="text-muted-foreground">{t("countsAs")}</div>
          <div className="truncate font-medium">{localName(food, locale)}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onChange}>{t("change")}</Button>
      </div>
    );
  }

  const foods = results.q === debounced ? results.foods : [];
  return (
    <div className="space-y-2">
      <Label htmlFor="generic-food">{food ? t("changeTitle") : t("notRecognized")}</Label>
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="generic-food" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("placeholder")} className="h-10 pl-9" />
      </div>
      {foods.length > 0 && (
        <div className="space-y-0.5">
          {foods.map((f) => (
            <ResultRow key={f.id} image={f.image_url} emoji={f.emoji} title={localName(f, locale)} onClick={() => onPick(f)} />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("linkHint")}</p>
    </div>
  );
}
