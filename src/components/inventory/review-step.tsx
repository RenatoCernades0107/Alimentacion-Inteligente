"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FoodImage } from "@/components/food-image";
import { NativeSelect } from "@/components/native-select";
import { GenericFoodLink } from "@/components/inventory/food-picker";
import { ShelfAdvice, StorageSelects } from "@/components/inventory/storage-fields";
import { addInventoryItems } from "@/app/actions/inventory";
import { UNITS } from "@/lib/units";
import { predictExpiry, validRipeness, validStorage, type Ripeness, type ShelfFood, type Storage } from "@/lib/shelf-life";
import { localName, type Food, type Unit } from "@/lib/types";
import type { DetectedItem, DetectedMatch } from "@/lib/photo";
import { cn } from "@/lib/utils";

/** `expires` es lo que escribió el usuario (solo vale si tocó la fecha); si no, se estima. */
type Row = DetectedItem & { checked: boolean; expires: string; dateTouched: boolean; storage: Storage | null; ripeness: Ripeness | null };

/** El alimento del que se estima la vida útil: el genérico, el asociado al producto, o el nuevo (por su nombre). */
function shelfFoodOf(match: DetectedMatch): ShelfFood | null {
  if (match.kind === "food") return match.food;
  if (match.kind === "product") return match.linked;
  return { key: null, category: "custom", name_es: match.name, name_en: match.name };
}

/** Revisión de lo que se detectó en la foto: se corrige y se agrega todo de una vez. */
export function ReviewStep({ items, today, onDone }: { items: DetectedItem[]; today: string; onDone: () => void }) {
  const t = useTranslations("photo");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((i) => ({ ...i, checked: i.confidence !== "low", expires: "", dateTouched: false, storage: null, ripeness: null })),
  );

  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const selected = rows.filter((r) => r.checked);

  function submit() {
    start(async () => {
      try {
        await addInventoryItems(
          selected.map(({ match, quantity, unit, expires, dateTouched, storage, ripeness }) => {
            const food = shelfFoodOf(match);
            // Sin tocar la fecha va vacía: el servidor estima lo mismo que se mostraba.
            const base = {
              quantity,
              unit,
              expires_on: dateTouched ? expires || null : null,
              storage: validStorage(food, storage),
              ripeness: validRipeness(food, ripeness),
            };
            if (match.kind === "food") return { ...base, food_id: match.food.id };
            if (match.kind === "new") return { ...base, new_food: { name: match.name, emoji: match.emoji, default_unit: unit } };
            return {
              ...base,
              food_id: match.linked?.id ?? null,
              barcode: match.product.code,
              product_name: match.product.name,
              brand: match.product.brand,
              image_url: match.product.image,
            };
          }),
        );
        toast.success(t("added", { count: selected.length }));
        onDone();
      } catch {
        toast.error(tc("error"));
      }
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("reviewHint")}</p>
      {rows.map((row) => (
        <ReviewRow key={row.id} row={row} today={today} onChange={(patch) => update(row.id, patch)} />
      ))}
      <div className="sticky bottom-0 bg-background pt-2 pb-1">
        <Button size="lg" className="h-11 w-full text-base" disabled={pending || !selected.length} onClick={submit}>
          {t("addN", { count: selected.length })}
        </Button>
      </div>
    </div>
  );
}

function ReviewRow({ row, today, onChange }: { row: Row; today: string; onChange: (patch: Partial<Row>) => void }) {
  const t = useTranslations("photo");
  const ti = useTranslations("inventory");
  const tu = useTranslations("units");
  const ts = useTranslations("search");
  const locale = useLocale();
  const [picking, setPicking] = useState(false);
  const { match } = row;

  const view = matchView(match, locale);
  const shelfFood = shelfFoodOf(match);
  const storage = validStorage(shelfFood, row.storage);
  const ripeness = validRipeness(shelfFood, row.ripeness);
  const estimate = predictExpiry({ food: shelfFood, storage, ripeness, from: today });

  function pick(food: Food) {
    setPicking(false);
    onChange({ match: match.kind === "product" ? { ...match, linked: food } : { kind: "food", food } });
  }

  return (
    <div className={cn("space-y-3 rounded-2xl border p-3 transition-opacity", !row.checked && "opacity-50")}>
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={row.checked} onChange={(e) => onChange({ checked: e.target.checked })} className="size-5 shrink-0 accent-primary" />
        <FoodImage src={view.image} emoji={view.emoji} alt={view.title} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="line-clamp-2 font-medium leading-snug">{view.title}</span>
            {match.kind === "new" && <Badge variant="secondary">{t("new")}</Badge>}
          </div>
          <div className="truncate text-xs text-muted-foreground">{row.raw_text}</div>
          {row.confidence === "low" && <div className="text-xs text-amber-600">{t("lowConfidence")}</div>}
        </div>
      </label>

      {row.checked && (
        <>
          {match.kind === "new" && (
            <Input value={match.name} onChange={(e) => onChange({ match: { ...match, name: e.target.value } })} maxLength={80} className="h-10" aria-label={t("name")} />
          )}
          <div className="grid grid-cols-[0.75fr_0.95fr_1.7fr] gap-2">
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              value={row.quantity}
              onChange={(e) => onChange({ quantity: Number(e.target.value) })}
              className="h-10"
              aria-label={ti("quantity")}
            />
            <NativeSelect value={row.unit} onChange={(e) => onChange({ unit: e.target.value as Unit })} aria-label={ti("unit")}>
              {UNITS.map((u) => <option key={u} value={u}>{tu(u)}</option>)}
            </NativeSelect>
            <Input
              type="date"
              value={row.dateTouched ? row.expires : (estimate.expiresOn ?? "")}
              onChange={(e) => onChange({ expires: e.target.value, dateTouched: true })}
              className="h-10"
              aria-label={ti("expiresOn")}
            />
          </div>
          <StorageSelects
            food={shelfFood}
            storage={row.storage}
            ripeness={row.ripeness}
            onStorage={(s) => onChange({ storage: s })}
            onRipeness={(r) => onChange({ ripeness: r })}
          />
          <ShelfAdvice food={shelfFood} storage={storage} ripeness={ripeness} tips={false} />
          {picking ? (
            <GenericFoodLink food={null} guessing={false} picking onChange={() => {}} onPick={pick} />
          ) : (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-muted-foreground">
                {match.kind === "product" && (match.linked ? `${ts("countsAs")} ${localName(match.linked, locale)}` : ts("notRecognized"))}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(true)}>{ts("change")}</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function matchView(match: DetectedMatch, locale: string) {
  if (match.kind === "food") return { title: localName(match.food, locale), image: match.food.image_url, emoji: match.food.emoji };
  if (match.kind === "product") return { title: match.product.name, image: match.product.image, emoji: "📦" };
  return { title: match.name || "—", image: null, emoji: match.emoji };
}
