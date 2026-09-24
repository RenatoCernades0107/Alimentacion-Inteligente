"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Minus, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FoodImage } from "@/components/food-image";
import { NativeSelect } from "@/components/native-select";
import { ScopeDialog } from "@/components/meals/scope-dialog";
import { createClient } from "@/lib/supabase/client";
import { setMealItems, type MealItemInput, type Scope } from "@/app/actions/meals";
import { loadMealItems, stockFor, type MealItem, type MealItemsSource } from "@/lib/meal-items";
import { formatQuantity, UNITS } from "@/lib/units";
import { localName, mealName, type Food, type Meal, type Unit } from "@/lib/types";
import { cn } from "@/lib/utils";

type StockRow = { food_id: string | null; quantity: number; unit: Unit };
type Loaded = { mealId: string; source: MealItemsSource; items: MealItem[]; inventory: StockRow[] };

async function fetchStock(familyId: string, foodIds: string[]): Promise<StockRow[]> {
  if (!foodIds.length) return [];
  const { data } = await createClient()
    .from("inventory_items")
    .select("food_id, quantity, unit")
    .eq("family_id", familyId)
    .in("food_id", foodIds)
    .gt("quantity", 0);
  return (data ?? []) as StockRow[];
}

/** Ingredientes efectivos de la comida + el stock de cada uno (se recarga al cambiar de comida). */
function useMealItems(meal: Pick<Meal, "id" | "family_id" | "status">) {
  const [state, setState] = useState<Loaded | null>(null);
  const { id, family_id: familyId } = meal;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { source, items } = await loadMealItems(createClient(), id);
      const inventory = await fetchStock(familyId, items.map((i) => i.food_id));
      if (!cancelled) setState({ mealId: id, source, items, inventory });
    })().catch(() => !cancelled && setState({ mealId: id, source: "none", items: [], inventory: [] }));
    return () => {
      cancelled = true;
    };
  }, [id, familyId]);
  return state?.mealId === id ? state : null;
}

/** Etiqueta de stock: ✓, "no hay" o "solo hay X". */
function StockHint({ item, inventory }: { item: Pick<MealItem, "food_id" | "unit" | "quantity">; inventory: StockRow[] }) {
  const t = useTranslations("mealItems");
  const tu = useTranslations("units");
  const stock = stockFor(item, inventory);
  if (!stock.has) return <span className="shrink-0 text-xs font-medium text-orange-600">{t("notInStock")}</span>;
  if (item.quantity && item.unit && stock.amount !== null && stock.amount < item.quantity) {
    return (
      <span className="shrink-0 text-xs font-medium text-amber-700">
        {t("onlyHave", { amount: `${formatQuantity(+stock.amount.toFixed(2))} ${tu(item.unit)}` })}
      </span>
    );
  }
  return <Check className="size-4 shrink-0 text-primary" aria-label={t("inStock")} />;
}

/** Lista compacta (solo lectura) para el drawer de acciones de la comida. */
export function MealItemsSummary({ meal, canEdit, onEdit }: { meal: Meal; canEdit: boolean; onEdit: () => void }) {
  const t = useTranslations("mealItems");
  const tu = useTranslations("units");
  const tc = useTranslations("common");
  const locale = useLocale();
  const data = useMealItems(meal);

  // Una comida sin receta ni ingredientes solo muestra la sección si se puede editar.
  if (data && !data.items.length && !canEdit) return null;

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{t("title")}</h3>
          {data && data.source !== "recipe" && data.source !== "none" && meal.status !== "completed" && (
            <p className="text-xs text-muted-foreground">{data.source === "series" ? t("editedSeries") : t("edited")}</p>
          )}
        </div>
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={onEdit} disabled={!data}>
            {t("edit")}
          </Button>
        )}
      </div>
      {!data ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{tc("loading")}</p>
      ) : data.items.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="max-h-52 divide-y overflow-y-auto px-1 pb-1">
          {data.items.map((it) => (
            <li key={it.food_id} className="flex items-center gap-2.5 px-2 py-2">
              <FoodImage src={it.food.image_url} emoji={it.food.emoji} alt="" className="size-8 rounded-lg text-lg" />
              <span className="min-w-0 flex-1 truncate">
                {localName(it.food, locale)}
                {it.optional && <span className="ml-1 text-xs text-muted-foreground">({t("optional")})</span>}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground">
                {it.quantity && it.unit ? `${formatQuantity(it.quantity)} ${tu(it.unit)}` : t("toTaste")}
              </span>
              {meal.status !== "completed" && <StockHint item={it} inventory={data.inventory} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Drawer para quitar ingredientes, cambiar porciones y agregar alimentos. */
export function MealItemsDrawer({ meal, onClose }: { meal: Meal | null; onClose: () => void }) {
  return (
    <Drawer open={!!meal} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="h-[92dvh]">{meal && <EditorLoader key={meal.id} meal={meal} onClose={onClose} />}</DrawerContent>
    </Drawer>
  );
}

function EditorLoader({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const t = useTranslations("mealItems");
  const tc = useTranslations("common");
  const locale = useLocale();
  const data = useMealItems(meal);
  return (
    <>
      <DrawerHeader className="text-left">
        <DrawerTitle className="text-lg">{t("editTitle")}</DrawerTitle>
        <p className="truncate text-sm text-muted-foreground">
          {meal.recipe?.emoji ?? "🍽️"} {mealName(meal, locale)}
        </p>
      </DrawerHeader>
      {data ? <Editor meal={meal} initial={data} onClose={onClose} /> : <p className="p-4 text-muted-foreground">{tc("loading")}</p>}
    </>
  );
}

type Row = { food_id: string; food: MealItem["food"]; quantity: string; unit: Unit; optional: boolean };

function toRow(it: MealItem): Row {
  return {
    food_id: it.food_id,
    food: it.food,
    quantity: it.quantity ? String(+it.quantity.toFixed(3)) : "",
    unit: it.unit ?? it.food.default_unit ?? "unit",
    optional: it.optional,
  };
}

function Editor({ meal, initial, onClose }: { meal: Meal; initial: Loaded; onClose: () => void }) {
  const t = useTranslations("mealItems");
  const tu = useTranslations("units");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => initial.items.map(toRow));
  const [inventory, setInventory] = useState<StockRow[]>(initial.inventory);
  const [adding, setAdding] = useState(false);
  const [askScope, setAskScope] = useState<null | "save" | "reset">(null);

  const update = (foodId: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.food_id === foodId ? { ...r, ...patch } : r)));
  const remove = (foodId: string) => setRows((rs) => rs.filter((r) => r.food_id !== foodId));

  function scale(factor: number) {
    setRows((rs) =>
      rs.map((r) => {
        const q = Number(r.quantity);
        return r.quantity && q > 0 ? { ...r, quantity: String(+(q * factor).toFixed(2)) } : r;
      }),
    );
  }

  function add(food: Food) {
    if (rows.some((r) => r.food_id === food.id)) {
      toast(t("alreadyAdded", { name: localName(food, locale) }));
    } else {
      setRows((rs) => [...rs, { food_id: food.id, food, quantity: "1", unit: food.default_unit ?? "unit", optional: false }]);
      fetchStock(meal.family_id, [food.id]).then((s) => setInventory((inv) => [...inv, ...s])).catch(() => {});
    }
    setAdding(false);
  }

  function persist(items: MealItemInput[] | null, scope: Scope) {
    start(async () => {
      try {
        await setMealItems(meal.id, items, scope);
        toast.success(tc("saved"));
        onClose();
      } catch {
        toast.error(tc("error"));
      }
    });
  }

  const payload = (): MealItemInput[] =>
    rows.map((r) => {
      const q = Number(r.quantity.replace(",", "."));
      return { food_id: r.food_id, quantity: r.quantity.trim() && q > 0 ? q : null, unit: r.unit, optional: r.optional };
    });

  function request(kind: "save" | "reset") {
    if (meal.series_id) setAskScope(kind);
    else persist(kind === "save" ? payload() : null, "one");
  }

  if (adding) return <FoodPicker onPick={add} onCancel={() => setAdding(false)} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <p className="text-sm text-muted-foreground">{t("hint")}</p>

      {rows.some((r) => r.quantity) && (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm font-medium">{t("portions")}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => scale(0.5)} aria-label={t("halve")}>
            <Minus /> ½
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => scale(2)} aria-label={t("double")}>
            <Plus /> 2×
          </Button>
        </div>
      )}

      <ul className="min-h-0 flex-1 divide-y overflow-y-auto rounded-xl border">
        {rows.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">{t("emptyEditor")}</li>}
        {rows.map((r) => {
          const name = localName(r.food, locale);
          const q = Number(r.quantity.replace(",", "."));
          const qty = r.quantity.trim() && q > 0 ? q : null;
          return (
            <li key={r.food_id} className="space-y-2 p-2.5">
              <div className="flex items-center gap-2.5">
                <FoodImage src={r.food.image_url} emoji={r.food.emoji} alt="" className="size-9 rounded-lg text-xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{name}</div>
                  {r.optional && <div className="text-xs text-muted-foreground">{t("optional")}</div>}
                </div>
                <StockHint item={{ food_id: r.food_id, unit: qty ? r.unit : null, quantity: qty }} inventory={inventory} />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(r.food_id)} aria-label={t("remove", { name })}>
                  <Trash2 className="text-destructive" />
                </Button>
              </div>
              <div className="grid grid-cols-[1fr_7rem] gap-2 pl-11">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  value={r.quantity}
                  onChange={(e) => update(r.food_id, { quantity: e.target.value })}
                  placeholder={t("toTaste")}
                  aria-label={t("quantity", { name })}
                  className="h-10"
                />
                <NativeSelect value={r.unit} onChange={(e) => update(r.food_id, { unit: e.target.value as Unit })} aria-label={t("unit", { name })}>
                  {UNITS.map((u) => <option key={u} value={u}>{tu(u)}</option>)}
                </NativeSelect>
              </div>
            </li>
          );
        })}
      </ul>

      <Button type="button" variant="outline" size="lg" className="h-11" onClick={() => setAdding(true)}>
        <Plus /> {t("add")}
      </Button>

      <div className={cn("grid gap-2", initial.source === "meal" || initial.source === "series" ? "grid-cols-[auto_1fr]" : "grid-cols-1")}>
        {(initial.source === "meal" || initial.source === "series") && (
          <Button type="button" variant="ghost" size="lg" className="h-11" disabled={pending} onClick={() => request("reset")} aria-label={t("reset")}>
            <RotateCcw /> <span className="hidden min-[380px]:inline">{t("reset")}</span>
          </Button>
        )}
        <Button type="button" size="lg" className="h-11 text-base" disabled={pending} onClick={() => request("save")}>
          {tc("save")}
        </Button>
      </div>

      <ScopeDialog
        open={askScope !== null}
        action="edit"
        onCancel={() => setAskScope(null)}
        onChoose={(scope) => {
          const kind = askScope;
          setAskScope(null);
          persist(kind === "reset" ? null : payload(), scope);
        }}
      />
    </div>
  );
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Buscador del catálogo de alimentos (genéricos + propios de la familia). */
function FoodPicker({ onPick, onCancel }: { onPick: (f: Food) => void; onCancel: () => void }) {
  const t = useTranslations("mealItems");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 250);
  const [results, setResults] = useState<{ q: string; foods: Food[] }>({ q: "", foods: [] });

  useEffect(() => {
    if (!debounced) return;
    let cancelled = false;
    createClient()
      .rpc("search_foods", { p_query: debounced, p_limit: 15 })
      .then(({ data }) => !cancelled && setResults({ q: debounced, foods: (data as Food[]) ?? [] }));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const foods = results.q === debounced ? results.foods : [];
  const searching = !!debounced && results.q !== debounced;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchFood")}
          className="h-11 pl-9"
          enterKeyHint="search"
        />
      </div>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {searching && <li className="p-2 text-sm text-muted-foreground">{tc("loading")}</li>}
        {!searching && debounced && foods.length === 0 && <li className="p-2 text-sm text-muted-foreground">{t("noResults")}</li>}
        {foods.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => onPick(f)} className="flex w-full items-center gap-3 rounded-xl p-2 text-left active:bg-muted">
              <FoodImage src={f.image_url} emoji={f.emoji} alt="" className="size-10" />
              <span className="min-w-0 flex-1 truncate font-medium">{localName(f, locale)}</span>
              <Plus className="size-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="ghost" size="lg" className="h-11" onClick={onCancel}>
        {tc("back")}
      </Button>
    </div>
  );
}
