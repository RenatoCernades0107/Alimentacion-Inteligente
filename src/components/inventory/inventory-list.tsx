"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { FoodImage } from "@/components/food-image";
import { NativeSelect } from "@/components/native-select";
import { ExpiryBadge } from "@/components/inventory/expiry-badge";
import { AddFoodDrawer } from "@/components/inventory/add-food-drawer";
import { deleteInventoryItem, updateInventoryItem } from "@/app/actions/inventory";
import { formatQuantity, UNITS } from "@/lib/units";
import { itemName, type InventoryItem, type Unit } from "@/lib/types";

export function InventoryList({ items, today, canEdit }: { items: InventoryItem[]; today: string; canEdit: boolean }) {
  const t = useTranslations("inventory");
  const tu = useTranslations("units");
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
            <li key={item.id}>
              <button
                className="flex w-full items-center gap-3 p-3 text-left active:bg-muted disabled:active:bg-transparent"
                onClick={() => setEditing(item)}
                disabled={!canEdit}
              >
                <FoodImage src={item.image_url ?? item.food?.image_url} emoji={item.food?.emoji ?? "📦"} alt={itemName(item, locale)} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{itemName(item, locale)}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {formatQuantity(item.quantity)} {tu(item.unit)}
                    {item.brand && ` · ${item.brand}`}
                  </div>
                </div>
                <ExpiryBadge expiresOn={item.expires_on} estimated={item.expiry_estimated} today={today} />
              </button>
            </li>
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
          <AddFoodDrawer key={addKey} open={adding} onOpenChange={setAdding} />
          <EditItemDrawer item={editing} onClose={() => setEditing(null)} />
        </>
      )}
    </>
  );
}

function EditItemDrawer({ item, onClose }: { item: InventoryItem | null; onClose: () => void }) {
  return (
    <Drawer open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent>{item && <EditItemForm key={item.id} item={item} onClose={onClose} />}</DrawerContent>
    </Drawer>
  );
}

function EditItemForm({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const t = useTranslations("inventory");
  const tu = useTranslations("units");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [unit, setUnit] = useState<Unit>(item.unit);
  const [expires, setExpires] = useState(item.expires_on ?? "");

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        await updateInventoryItem(item.id, { quantity: Number(quantity), unit, expires_on: expires || null });
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
      <form onSubmit={save} className="space-y-4 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
        <div className="space-y-2">
          <Label htmlFor="eexp">{t("expiresOn")}</Label>
          <Input id="eexp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="h-10" />
        </div>
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
