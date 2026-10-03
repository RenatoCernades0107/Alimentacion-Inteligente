"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Lightbulb, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { FoodImage } from "@/components/food-image";
import { NativeSelect } from "@/components/native-select";
import { ExpiryBadge } from "@/components/inventory/expiry-badge";
import { AddFoodDrawer } from "@/components/inventory/add-food-drawer";
import { RipenessPicker, ShelfAdvice, StoragePicker, useStorageLabel } from "@/components/inventory/storage-fields";
import { deleteInventoryItem, updateInventoryItem } from "@/app/actions/inventory";
import { adviceFor, moveExpiry, predictExpiry, storageOptions, validRipeness, validStorage, type Ripeness, type Storage } from "@/lib/shelf-life";
import { formatQuantity, UNITS } from "@/lib/units";
import { itemName, type InventoryItem, type Unit } from "@/lib/types";
import { cn } from "@/lib/utils";

export function InventoryList({ items, today, canEdit }: { items: InventoryItem[]; today: string; canEdit: boolean }) {
  const t = useTranslations("inventory");
  const locale = useLocale();
  const [filter, setFilter] = useState("");
  const [adding, setAdding] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [editing, setEditing] = useState<InventoryItem | null>(null);

  const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const visible = filter ? items.filter((i) => normalize(itemName(i, locale) + " " + (i.brand ?? "")).includes(normalize(filter))) : items;

  return (
    <>
      {items.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("filter")} className="h-10 pl-9" />
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <div className="text-5xl">🧺</div>
          <p>{t("empty")}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {visible.map((item) => (
            <InventoryRow key={item.id} item={item} today={today} canEdit={canEdit} onEdit={() => setEditing(item)} />
          ))}
        </ul>
      )}

      {!canEdit && <p className="mt-4 text-center text-sm text-muted-foreground">{t("readOnly")}</p>}

      {canEdit && (
        <>
          <Button
            size="lg"
            className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 h-14 rounded-full px-5 text-base shadow-lg"
            onClick={() => {
              setAddKey((k) => k + 1);
              setAdding(true);
            }}
          >
            <Plus className="size-5" /> {t("add")}
          </Button>
          <AddFoodDrawer key={addKey} open={adding} onOpenChange={setAdding} today={today} />
          <EditItemDrawer item={editing} today={today} onClose={() => setEditing(null)} />
        </>
      )}
    </>
  );
}

function InventoryRow({ item, today, canEdit, onEdit }: { item: InventoryItem; today: string; canEdit: boolean; onEdit: () => void }) {
  const t = useTranslations("shelf");
  const tu = useTranslations("units");
  const locale = useLocale();
  const [showTips, setShowTips] = useState(false);
  const label = useStorageLabel(item.food);

  // Lo guardado en filas antiguas o sin dato cuenta como el lugar recomendado.
  const storage = validStorage(item.food, item.storage);
  const ripeness = validRipeness(item.food, item.ripeness);
  const advice = adviceFor(item.food, storage, ripeness);
  // Solo se muestra dónde está cuando el alimento tiene más de un lugar posible.
  const where = item.storage && storageOptions(item.food).length > 1 ? label(item.storage, false) : null;

  return (
    <li>
      <div className="flex items-center gap-3 pr-3">
        <button
          className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left active:bg-muted disabled:active:bg-transparent"
          onClick={onEdit}
          disabled={!canEdit}
        >
          <FoodImage src={item.image_url ?? item.food?.image_url} emoji={item.food?.emoji ?? "📦"} alt={itemName(item, locale)} />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 leading-snug font-medium">{itemName(item, locale)}</div>
            <div className="line-clamp-2 text-sm leading-snug text-muted-foreground">
              {formatQuantity(item.quantity)} {tu(item.unit)}
              {item.brand && ` · ${item.brand}`}
              {where && ` · ${where}`}
              {item.ripeness && ripeness && ` · ${t(`state.${ripeness}`)}`}
            </div>
          </div>
        </button>
        {/* El vencimiento y, debajo, el botón de consejos (así el nombre no pierde ancho). */}
        <div className="flex shrink-0 flex-col items-end gap-1 py-2">
          <ExpiryBadge expiresOn={item.expires_on} estimated={item.expiry_estimated} today={today} stacked />
          {advice.tips.length > 0 && (
            <button
              type="button"
              onClick={() => setShowTips((v) => !v)}
              aria-expanded={showTips}
              aria-label={showTips ? t("hideTips") : t("showTips")}
              className={cn(
                "flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground active:bg-muted",
                showTips && "bg-muted text-foreground",
              )}
            >
              <Lightbulb className="size-3.5" />
              {t("tipsTitle")}
            </button>
          )}
        </div>
      </div>
      {(advice.warnings.length > 0 || showTips) && (
        <div className="px-3 pb-3">
          <ShelfAdvice food={item.food} storage={storage} ripeness={ripeness} tips={showTips} />
        </div>
      )}
    </li>
  );
}

function EditItemDrawer({ item, today, onClose }: { item: InventoryItem | null; today: string; onClose: () => void }) {
  return (
    <Drawer open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>{item && <EditItemForm key={item.id} item={item} today={today} onClose={onClose} />}</DrawerContent>
    </Drawer>
  );
}

function EditItemForm({ item, today, onClose }: { item: InventoryItem; today: string; onClose: () => void }) {
  const t = useTranslations("inventory");
  const ts = useTranslations("shelf");
  const tu = useTranslations("units");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState<Unit>(item.unit);

  // Lo que pasa con la fecha al cambiar de lugar o de madurez ("lo pasé al congelador"):
  // se recalcula salvo que el usuario ya la haya escrito o sea la impresa en el empaque.
  const food = item.food ?? null;
  const [pickedStorage, setPickedStorage] = useState<Storage | null>(item.storage);
  const [pickedRipeness, setPickedRipeness] = useState<Ripeness | null>(item.ripeness);
  const storage = validStorage(food, pickedStorage);
  const ripeness = validRipeness(food, pickedRipeness);
  const [expires, setExpires] = useState(item.expires_on ?? "");
  const [estimated, setEstimated] = useState(item.expiry_estimated);
  const [dateTouched, setDateTouched] = useState(false);
  const [note, setNote] = useState<"recalculated" | "keptPrinted" | null>(null);
  const printed = !!item.expires_on && !item.expiry_estimated && !!(item.barcode || item.product_name);

  function applyDate(date: string | null) {
    if (dateTouched) return;
    if (printed) return setNote("keptPrinted");
    if (!date) return;
    setExpires(date);
    setEstimated(true);
    setNote("recalculated");
  }

  function changeStorage(next: Storage) {
    setPickedStorage(next);
    applyDate(moveExpiry({ food, from: storage, to: next, ripeness, today, current: expires || null }));
  }

  function changeRipeness(next: Ripeness) {
    setPickedRipeness(next);
    applyDate(predictExpiry({ food, storage, ripeness: next, from: today }).expiresOn);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        await updateInventoryItem(item.id, {
          quantity: Number(quantity),
          unit,
          expires_on: expires || null,
          expiry_estimated: !!expires && estimated,
          // Solo se tocan si cambiaron: una fila antigua sin lugar sigue sin él.
          storage: pickedStorage !== item.storage ? storage : undefined,
          ripeness: pickedRipeness !== item.ripeness ? ripeness : undefined,
        });
        toast.success(tc("saved"));
        onClose();
      } catch {
        toast.error(tc("error"));
      }
    });
  }

  function remove() {
    start(async () => {
      await deleteInventoryItem(item.id);
      toast.success(t("deleted"));
      onClose();
    });
  }

  return (
    <>
      <DrawerHeader className="flex-row items-center gap-3 text-left">
        <FoodImage src={item.image_url ?? item.food?.image_url} emoji={item.food?.emoji ?? "📦"} alt={itemName(item, locale)} />
        <DrawerTitle className="text-lg">{itemName(item, locale)}</DrawerTitle>
      </DrawerHeader>
      <form onSubmit={save} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="eqty">{t("quantity")}</Label>
            <Input id="eqty" type="number" inputMode="decimal" step="any" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eunit">{t("unit")}</Label>
            <NativeSelect id="eunit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              {UNITS.map((u) => <option key={u} value={u}>{tu(u)}</option>)}
            </NativeSelect>
          </div>
        </div>
        <StoragePicker food={food} value={pickedStorage} onChange={changeStorage} label={ts("whereEdit")} id="edit-storage" />
        <RipenessPicker food={food} value={pickedRipeness} onChange={changeRipeness} id="edit-ripeness" />
        <div className="space-y-2">
          <Label htmlFor="eexp">{t("expiresOn")}</Label>
          <Input
            id="eexp"
            type="date"
            value={expires}
            onChange={(e) => {
              setExpires(e.target.value);
              setDateTouched(true);
              setEstimated(false);
              setNote(null);
            }}
            className="h-10"
          />
          {note && <p className="text-xs text-muted-foreground">{ts(note)}</p>}
        </div>
        <ShelfAdvice food={food} storage={storage} ripeness={ripeness} />
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="destructive" size="lg" className="h-11" onClick={remove} disabled={pending} aria-label={tc("delete")}>
            <Trash2 />
          </Button>
          <Button type="submit" size="lg" className="h-11 flex-1" disabled={pending}>{tc("save")}</Button>
        </div>
      </form>
    </>
  );
}
