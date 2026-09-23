"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Plus, ScanBarcode, Search } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FoodImage } from "@/components/food-image";
import { NativeSelect } from "@/components/native-select";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { createClient } from "@/lib/supabase/client";
import { addInventoryItem, createCustomFood } from "@/app/actions/inventory";
import { UNITS } from "@/lib/units";
import { localName, type Food, type Unit } from "@/lib/types";
import type { OffProduct } from "@/lib/off";

type Selection = { kind: "food"; food: Food } | { kind: "product"; product: OffProduct };
type Step = "search" | "scan" | "details" | "custom";

export function AddFoodDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("search");
  const ti = useTranslations("inventory");
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);

  // El estado se reinicia porque el padre vuelve a montar este componente (key) al abrirlo.
  function select(s: Selection) {
    setSelection(s);
    setStep("details");
  }

  const title =
    step === "details" ? ti("add") : step === "custom" ? t("createCustom", { query }) : step === "scan" ? t("scan") : ti("add");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[92dvh]">
        <DrawerHeader className="flex-row items-center gap-2 pb-2 text-left">
          {step !== "search" && (
            <Button variant="ghost" size="icon" onClick={() => setStep("search")} aria-label="back">
              <ArrowLeft />
            </Button>
          )}
          <DrawerTitle className="truncate text-lg">{title}</DrawerTitle>
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {step === "search" && (
            <SearchStep
              query={query}
              setQuery={setQuery}
              onSelect={select}
              onScan={() => setStep("scan")}
              onCreate={() => setStep("custom")}
            />
          )}
          {step === "scan" && <ScanStep onFound={(product) => select({ kind: "product", product })} onNotFound={() => setStep("search")} />}
          {step === "custom" && <CustomStep initialName={query} onCreated={(food) => select({ kind: "food", food })} />}
          {step === "details" && selection && <DetailsStep selection={selection} onDone={() => onOpenChange(false)} />}
        </div>
      </DrawerContent>
    </Drawer>
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

function SearchStep({
  query, setQuery, onSelect, onScan, onCreate,
}: {
  query: string;
  setQuery: (q: string) => void;
  onSelect: (s: Selection) => void;
  onScan: () => void;
  onCreate: () => void;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const debounced = useDebounced(query.trim(), 250);
  // Cada resultado recuerda para qué búsqueda es, así no se muestran resultados viejos.
  const [foodResults, setFoodResults] = useState<{ q: string; foods: Food[] }>({ q: "", foods: [] });
  const [productResults, setProductResults] = useState<{ q: string; products: OffProduct[] }>({ q: "", products: [] });

  useEffect(() => {
    if (!debounced) return;
    let cancelled = false;
    createClient()
      .rpc("search_foods", { p_query: debounced, p_limit: 10 })
      .then(({ data }) => !cancelled && setFoodResults({ q: debounced, foods: (data as Food[]) ?? [] }));

    if (debounced.length >= 3) {
      fetch(`/api/off/search?q=${encodeURIComponent(debounced)}&lang=${locale}`)
        .then((r) => r.json())
        .catch(() => ({}))
        .then((d) => !cancelled && setProductResults({ q: debounced, products: d.products ?? [] }));
    }
    return () => {
      cancelled = true;
    };
  }, [debounced, locale]);

  const foods = foodResults.q === debounced ? foodResults.foods : [];
  const products = productResults.q === debounced ? productResults.products : [];
  const loadingProducts = debounced.length >= 3 && productResults.q !== debounced;
  const custom = foods.filter((f) => f.family_id);
  const generic = foods.filter((f) => !f.family_id);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
            className="h-11 pl-9"
            enterKeyHint="search"
          />
        </div>
        <Button variant="outline" size="icon-lg" className="size-11" onClick={onScan} aria-label={t("scan")}>
          <ScanBarcode className="size-5" />
        </Button>
      </div>

      {debounced && (
        <>
          {custom.length > 0 && (
            <ResultGroup title={t("customSection")}>
              {custom.map((f) => (
                <ResultRow key={f.id} image={f.image_url} emoji={f.emoji} title={localName(f, locale)} onClick={() => onSelect({ kind: "food", food: f })} />
              ))}
            </ResultGroup>
          )}

          <ResultGroup title={t("genericSection")}>
            {generic.map((f) => (
              <ResultRow
                key={f.id}
                image={f.image_url}
                emoji={f.emoji}
                title={localName(f, locale)}
                badge={t("generic")}
                onClick={() => onSelect({ kind: "food", food: f })}
              />
            ))}
            {/* Siempre hay una opción genérica: si no existe en el catálogo, se crea. */}
            <button onClick={onCreate} className="flex w-full items-center gap-3 rounded-xl p-2 text-left active:bg-muted">
              <div className="flex size-12 items-center justify-center rounded-xl border border-dashed">
                <Plus className="size-5 text-muted-foreground" />
              </div>
              <span className="font-medium">{t("createCustom", { query })}</span>
            </button>
          </ResultGroup>

          {(products.length > 0 || loadingProducts) && (
            <ResultGroup title={t("productsSection")}>
              {loadingProducts && products.length === 0 && <p className="p-2 text-sm text-muted-foreground">{t("searchingProducts")}</p>}
              {products.map((p) => (
                <ResultRow
                  key={p.code}
                  image={p.image}
                  emoji="📦"
                  title={p.name}
                  subtitle={[p.brand, p.quantity && p.unit ? `${p.quantity} ${p.unit}` : null].filter(Boolean).join(" · ")}
                  onClick={() => onSelect({ kind: "product", product: p })}
                />
              ))}
            </ResultGroup>
          )}
        </>
      )}
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ResultRow({
  image, emoji, title, subtitle, badge, onClick,
}: {
  image: string | null;
  emoji: string | null;
  title: string;
  subtitle?: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl p-2 text-left active:bg-muted">
      <FoodImage src={image} emoji={emoji} alt={title} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{title}</div>
        {subtitle && <div className="truncate text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {badge && <Badge variant="secondary">{badge}</Badge>}
    </button>
  );
}

function ScanStep({ onFound, onNotFound }: { onFound: (p: OffProduct) => void; onNotFound: () => void }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  async function lookup(code: string) {
    setLoading(true);
    const res = await fetch(`/api/off/product/${code}?lang=${locale}`).then((r) => r.json()).catch(() => ({}));
    setLoading(false);
    if (res.product) onFound(res.product);
    else {
      toast.error(t("scanNotFound", { code }));
      onNotFound();
    }
  }

  return loading ? <p className="py-10 text-center text-muted-foreground">{t("searchingProducts")}</p> : <BarcodeScanner onDetected={lookup} />;
}

function CustomStep({ initialName, onCreated }: { initialName: string; onCreated: (f: Food) => void }) {
  const t = useTranslations("custom");
  const tu = useTranslations("units");
  const ti = useTranslations("inventory");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState("🍽️");
  const [unit, setUnit] = useState<Unit>("unit");
  const [days, setDays] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        const food = await createCustomFood({ name, emoji, default_unit: unit, shelf_life_days: days ? Number(days) : null });
        toast.success(t("created"));
        onCreated(food as Food);
      } catch {
        toast.error(tc("error"));
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-[4.5rem_1fr] gap-3">
        <div className="space-y-2">
          <Label htmlFor="emoji">{t("emoji")}</Label>
          <Input id="emoji" value={emoji} onChange={(e) => setEmoji(e.target.value)} className="h-10 text-center text-xl" maxLength={8} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cname">{t("name")}</Label>
          <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className="h-10" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cunit">{ti("unit")}</Label>
          <NativeSelect id="cunit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {UNITS.map((u) => <option key={u} value={u}>{tu(u)}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cdays">{t("shelfLife")}</Label>
          <Input id="cdays" type="number" inputMode="numeric" min={1} value={days} onChange={(e) => setDays(e.target.value)} className="h-10" />
        </div>
      </div>
      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending || !name.trim()}>{tc("save")}</Button>
    </form>
  );
}

function DetailsStep({ selection, onDone }: { selection: Selection; onDone: () => void }) {
  const t = useTranslations("inventory");
  const ts = useTranslations("search");
  const tu = useTranslations("units");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [pending, start] = useTransition();

  const isProduct = selection.kind === "product";
  const initial = useMemo(() => {
    if (selection.kind === "food") return { quantity: 1, unit: selection.food.default_unit };
    return { quantity: selection.product.quantity ?? 1, unit: selection.product.unit ?? ("unit" as Unit) };
  }, [selection]);

  const [quantity, setQuantity] = useState(String(initial.quantity));
  const [unit, setUnit] = useState<Unit>(initial.unit);
  const [expires, setExpires] = useState("");

  // Para productos de marca: a qué alimento genérico corresponde (para sugerir recetas).
  const [guesses, setGuesses] = useState<Food[]>([]);
  const [foodId, setFoodId] = useState<string>("");
  const guessed = useRef(false);
  useEffect(() => {
    if (selection.kind !== "product" || guessed.current) return;
    guessed.current = true;
    const words = selection.product.name.split(/\s+/).filter((w) => w.length > 2);
    const queries = [selection.product.name, ...words].slice(0, 4);
    (async () => {
      const supabase = createClient();
      const seen = new Map<string, Food>();
      for (const q of queries) {
        const { data } = await supabase.rpc("search_foods", { p_query: q, p_limit: 4 });
        for (const f of (data as Food[]) ?? []) if (!seen.has(f.id)) seen.set(f.id, f);
        if (seen.size >= 5) break;
      }
      const list = [...seen.values()].slice(0, 6);
      setGuesses(list);
      if (list[0]) setFoodId(list[0].id);
    })();
  }, [selection]);

  const name = selection.kind === "food" ? localName(selection.food, locale) : selection.product.name;
  const image = selection.kind === "food" ? selection.food.image_url : selection.product.image;
  const emoji = selection.kind === "food" ? selection.food.emoji : "📦";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        await addInventoryItem(
          selection.kind === "food"
            ? { food_id: selection.food.id, quantity: Number(quantity), unit, expires_on: expires || null }
            : {
                food_id: foodId || null,
                barcode: selection.product.code,
                product_name: selection.product.name,
                brand: selection.product.brand,
                image_url: selection.product.image,
                quantity: Number(quantity),
                unit,
                expires_on: expires || null,
              },
        );
        toast.success(t("added"));
        onDone();
      } catch {
        toast.error(tc("error"));
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-3">
        <FoodImage src={image} emoji={emoji} alt={name} className="size-16" />
        <div className="min-w-0">
          <div className="font-semibold">{name}</div>
          {isProduct && selection.product.brand && <div className="text-sm text-muted-foreground">{selection.product.brand}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="qty">{t("quantity")}</Label>
          <Input id="qty" type="number" inputMode="decimal" step="any" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} required className="h-10" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">{t("unit")}</Label>
          <NativeSelect id="unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {UNITS.map((u) => <option key={u} value={u}>{tu(u)}</option>)}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="exp">{t("expiresOn")}</Label>
        <Input id="exp" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} required={isProduct} className="h-10" />
        <p className="text-xs text-muted-foreground">{isProduct ? t("expiresOnHintPackaged") : t("expiresOnHintGeneric")}</p>
      </div>

      {isProduct && (
        <div className="space-y-2">
          <Label htmlFor="food">{ts("whatIsIt")}</Label>
          <NativeSelect id="food" value={foodId} onChange={(e) => setFoodId(e.target.value)}>
            <option value="">{ts("none")}</option>
            {guesses.map((f) => <option key={f.id} value={f.id}>{f.emoji} {localName(f, locale)}</option>)}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">{ts("whatIsItHint")}</p>
        </div>
      )}

      <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending}>{tc("add")}</Button>
    </form>
  );
}
