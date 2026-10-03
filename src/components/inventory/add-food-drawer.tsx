"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Camera, Plus, ScanBarcode, Search } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FoodImage } from "@/components/food-image";
import { NativeSelect } from "@/components/native-select";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { createClient } from "@/lib/supabase/client";
import { addInventoryItem, createCustomFood } from "@/app/actions/inventory";
import { UNITS } from "@/lib/units";
import { localName, type Food, type Unit } from "@/lib/types";
import type { OffProduct } from "@/lib/off";
import { toProduct, type StoreProduct } from "@/lib/stores";
import { StoreBadges } from "@/components/store-badges";
import { GenericFoodLink, ResultRow, useDebounced } from "@/components/inventory/food-picker";
import { PhotoStep } from "@/components/inventory/photo-step";
import { ReviewStep } from "@/components/inventory/review-step";
import { EstimateHint, RipenessPicker, ShelfAdvice, StoragePicker } from "@/components/inventory/storage-fields";
import { predictExpiry, validRipeness, validStorage, type Ripeness, type Storage } from "@/lib/shelf-life";
import type { DetectedItem } from "@/lib/photo";

type Selection = { kind: "food"; food: Food } | { kind: "product"; product: OffProduct };
type Step = "search" | "scan" | "details" | "custom" | "photo" | "review";

/** `today` (YYYY-MM-DD, en la zona horaria de la familia) es la fecha desde la que se estima el vencimiento. */
export function AddFoodDrawer({ open, onOpenChange, today }: { open: boolean; onOpenChange: (open: boolean) => void; today: string }) {
  const t = useTranslations("search");
  const ti = useTranslations("inventory");
  const tp = useTranslations("photo");
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);

  // El estado se reinicia porque el padre vuelve a montar este componente (key) al abrirlo.
  function select(s: Selection) {
    setSelection(s);
    setStep("details");
  }

  const title =
    step === "custom" ? t("createCustom", { query }) : step === "scan" ? t("scan") : step === "photo" ? tp("title") : step === "review" ? tp("review") : ti("add");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[92dvh]">
        <DrawerHeader className="flex-row items-center gap-2 pb-2 text-left">
          {step !== "search" && (
            <Button variant="ghost" size="icon" onClick={() => setStep(step === "review" ? "photo" : "search")} aria-label="back">
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
              onPhoto={() => setStep("photo")}
              onCreate={() => setStep("custom")}
            />
          )}
          {step === "scan" && <ScanStep onFound={(product) => select({ kind: "product", product })} onNotFound={() => setStep("search")} />}
          {step === "photo" && (
            <PhotoStep
              onDetected={(items) => {
                setDetected(items);
                setStep("review");
              }}
            />
          )}
          {step === "review" && <ReviewStep items={detected} today={today} onDone={() => onOpenChange(false)} />}
          {step === "custom" && <CustomStep initialName={query} onCreated={(food) => select({ kind: "food", food })} />}
          {step === "details" && selection && <DetailsStep selection={selection} today={today} onDone={() => onOpenChange(false)} />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function SearchStep({
  query, setQuery, onSelect, onScan, onPhoto, onCreate,
}: {
  query: string;
  setQuery: (q: string) => void;
  onSelect: (s: Selection) => void;
  onScan: () => void;
  onPhoto: () => void;
  onCreate: () => void;
}) {
  const t = useTranslations("search");
  const locale = useLocale();
  const debounced = useDebounced(query.trim(), 250);
  // Cada resultado recuerda para qué búsqueda es, así no se muestran resultados viejos.
  const [foodResults, setFoodResults] = useState<{ q: string; foods: Food[] }>({ q: "", foods: [] });
  const [productResults, setProductResults] = useState<{ q: string; products: OffProduct[] }>({ q: "", products: [] });
  const [storeResults, setStoreResults] = useState<{ q: string; products: OffProduct[] }>({ q: "", products: [] });

  useEffect(() => {
    if (!debounced) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .rpc("search_foods", { p_query: debounced, p_limit: 10 })
      .then(({ data }) => !cancelled && setFoodResults({ q: debounced, foods: (data as Food[]) ?? [] }));
    supabase
      .rpc("search_store_products", { p_query: debounced, p_limit: 15 })
      .then(({ data }) => !cancelled && setStoreResults({ q: debounced, products: ((data as StoreProduct[]) ?? []).map(toProduct) }));

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
  const storeProducts = storeResults.q === debounced ? storeResults.products : [];
  // Los de Open Food Facts que ya salen como producto de supermercado no se repiten.
  const storeCodes = new Set(storeProducts.map((p) => p.code).filter(Boolean));
  // Open Food Facts solo completa cuando los supermercados traen pocos resultados.
  const showOff = storeResults.q === debounced && storeProducts.length < 5;
  const products = showOff && productResults.q === debounced ? productResults.products.filter((p) => !storeCodes.has(p.code)) : [];
  const loadingProducts = showOff && debounced.length >= 3 && productResults.q !== debounced;
  // Los genéricos no se listan: solo los alimentos que creó la familia.
  const custom = foods.filter((f) => f.family_id);

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
        <Button variant="outline" size="icon-lg" className="size-11" onClick={onPhoto} aria-label={t("photo")}>
          <Camera className="size-5" />
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

          {storeProducts.length > 0 && (
            <ResultGroup title={t("storesSection")}>
              {storeProducts.map((p) => (
                <ResultRow
                  key={p.id}
                  image={p.image}
                  emoji="🛒"
                  title={p.name}
                  subtitle={p.brand ?? undefined}
                  stores={p.stores}
                  onClick={() => onSelect({ kind: "product", product: p })}
                />
              ))}
            </ResultGroup>
          )}

          {(products.length > 0 || loadingProducts) && (
            <ResultGroup title={t("productsSection")}>
              {loadingProducts && products.length === 0 && <p className="p-2 text-sm text-muted-foreground">{t("searchingProducts")}</p>}
              {products.map((p) => (
                <ResultRow
                  key={p.code ?? p.name}
                  image={p.image}
                  emoji="📦"
                  title={p.name}
                  subtitle={[p.brand, p.quantity && p.unit ? `${p.quantity} ${p.unit}` : null].filter(Boolean).join(" · ")}
                  onClick={() => onSelect({ kind: "product", product: p })}
                />
              ))}
            </ResultGroup>
          )}

          {/* Si no está en ningún catálogo, se crea. */}
          <button onClick={onCreate} className="flex w-full items-center gap-3 rounded-xl p-2 text-left active:bg-muted">
            <div className="flex size-12 items-center justify-center rounded-xl border border-dashed">
              <Plus className="size-5 text-muted-foreground" />
            </div>
            <span className="font-medium">{t("createCustom", { query })}</span>
          </button>
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

function ScanStep({ onFound, onNotFound }: { onFound: (p: OffProduct) => void; onNotFound: () => void }) {
  const t = useTranslations("search");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState("");

  async function lookup(code: string) {
    setLoading(true);
    try {
      // UPC-A (12 dígitos) es el mismo código que el EAN-13 con un 0 adelante.
      const codes = [code];
      if (code.length === 12) codes.push(`0${code}`);
      if (code.length === 13 && code.startsWith("0")) codes.push(code.slice(1));
      // Primero en los supermercados peruanos, luego en Open Food Facts.
      const { data } = await createClient().from("store_products").select("*").overlaps("barcodes", codes).limit(1);
      const store = (data as StoreProduct[] | null)?.[0];
      if (store) return onFound(toProduct(store));
      const res = await fetch(`/api/off/product/${code}?lang=${locale}`).then((r) => r.json()).catch(() => ({}));
      if (res.product) return onFound(res.product);
    } catch {}
    setLoading(false);
    toast.error(t("scanNotFound", { code }));
    onNotFound();
  }

  if (loading) return <p className="py-10 text-center text-muted-foreground">{t("searchingProducts")}</p>;

  return (
    <div className="space-y-4">
      <BarcodeScanner onDetected={lookup} />
      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(manual);
        }}
      >
        <Label htmlFor="manual-barcode">{t("manualCode")}</Label>
        <div className="flex gap-2">
          <Input
            id="manual-barcode"
            inputMode="numeric"
            autoComplete="off"
            placeholder="7750243067997"
            value={manual}
            onChange={(e) => setManual(e.target.value.replace(/\D/g, "").slice(0, 14))}
          />
          <Button type="submit" disabled={manual.length < 8}>
            {t("manualSearch")}
          </Button>
        </div>
      </form>
    </div>
  );
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
  const [kcal, setKcal] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        const food = await createCustomFood({
          name, emoji, default_unit: unit, shelf_life_days: days ? Number(days) : null, kcal: kcal.trim() ? Number(kcal.replace(",", ".")) : null,
        });
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
      <div className="space-y-2">
        <Label htmlFor="ckcal">{unit === "unit" ? t("kcalPerUnit") : t("kcalPer100", { unit: unit === "ml" || unit === "l" ? "ml" : "g" })}</Label>
        <Input id="ckcal" type="number" inputMode="decimal" min={0} max={1000} step="any" value={kcal} onChange={(e) => setKcal(e.target.value)} className="h-10" />
        <p className="text-xs text-muted-foreground">{t("kcalHint")}</p>
      </div>
      <Button type="submit" size="lg" className="h-11 w-full" disabled={pending || !name.trim()}>{tc("save")}</Button>
    </form>
  );
}

function DetailsStep({ selection, today, onDone }: { selection: Selection; today: string; onDone: () => void }) {
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
  // Lo que escribió el usuario; mientras no toque la fecha se muestra (y se guarda) la estimada.
  const [expires, setExpires] = useState("");
  const [dateTouched, setDateTouched] = useState(false);

  // Para productos de marca: a qué alimento genérico corresponde (recetas, sugerencias, stock).
  const [linked, setLinked] = useState<Food | null>(null);
  const [guessing, setGuessing] = useState(isProduct);
  const [picking, setPicking] = useState(false);
  const guessed = useRef(false);
  useEffect(() => {
    if (selection.kind !== "product" || guessed.current) return;
    guessed.current = true;
    guessGenericFood(selection.product).then((food) => {
      setLinked(food);
      setGuessing(false);
    });
  }, [selection]);

  // Dónde se guarda y qué tan madura está: solo se pregunta cuando el alimento lo necesita (src/lib/shelf-life.ts).
  const shelfFood = selection.kind === "food" ? selection.food : linked;
  const [pickedStorage, setPickedStorage] = useState<Storage | null>(null);
  const [pickedRipeness, setPickedRipeness] = useState<Ripeness | null>(null);
  const storage = validStorage(shelfFood, pickedStorage);
  const ripeness = validRipeness(shelfFood, pickedRipeness);
  const estimate = predictExpiry({ food: shelfFood, storage, ripeness, from: today });
  // El empaque trae su fecha: no se estima, pero igual se anota dónde se guarda.
  const shownDate = dateTouched ? expires : isProduct ? "" : (estimate.expiresOn ?? "");

  const name = selection.kind === "food" ? localName(selection.food, locale) : selection.product.name;
  const image = selection.kind === "food" ? selection.food.image_url : selection.product.image;
  const emoji = selection.kind === "food" ? selection.food.emoji : "📦";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Sin tocar la fecha va vacía: el servidor estima lo mismo que se está mostrando.
    const expires_on = dateTouched ? expires || null : null;
    start(async () => {
      try {
        await addInventoryItem(
          selection.kind === "food"
            ? { food_id: selection.food.id, quantity: Number(quantity), unit, expires_on, storage, ripeness }
            : {
                food_id: linked?.id ?? null,
                barcode: selection.product.code,
                product_name: selection.product.name,
                brand: selection.product.brand,
                image_url: selection.product.image,
                quantity: Number(quantity),
                unit,
                expires_on,
                storage,
                ripeness,
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
          {isProduct && selection.product.stores?.length ? (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              {ts("soldAt")} <StoreBadges stores={selection.product.stores} />
            </div>
          ) : null}
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

      <StoragePicker food={shelfFood} value={pickedStorage} onChange={setPickedStorage} id="add-storage" />
      <RipenessPicker food={shelfFood} value={pickedRipeness} onChange={setPickedRipeness} id="add-ripeness" />

      <div className="space-y-2">
        <Label htmlFor="exp">{t("expiresOn")}</Label>
        <Input
          id="exp"
          type="date"
          value={shownDate}
          onChange={(e) => {
            setExpires(e.target.value);
            setDateTouched(true);
          }}
          required={isProduct}
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">
          {!dateTouched && !isProduct && estimate.expiresOn ? (
            <EstimateHint days={estimate.days} storage={estimate.storage} />
          ) : isProduct ? (
            t("expiresOnHintPackaged")
          ) : (
            t("expiresOnHintGeneric")
          )}
        </p>
      </div>

      <ShelfAdvice food={shelfFood} storage={storage} ripeness={ripeness} />

      {isProduct && (
        <GenericFoodLink
          food={linked}
          guessing={guessing}
          picking={picking || (!guessing && !linked)}
          onChange={() => setPicking(true)}
          onPick={(f) => {
            setLinked(f);
            setPicking(false);
          }}
        />
      )}

      <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending}>{tc("add")}</Button>
    </form>
  );
}

const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "en", "con", "sin", "y", "x", "al", "para",
  "caja", "bolsa", "lata", "botella", "paquete", "pack", "doypack", "sachet", "frasco", "tarro", "un", "und", "unid",
  "uht", "light", "entera", "entero", "natural", "premium", "clasica", "clasico", "original", "tradicional",
  "lactosa", "deslactosada", "descremada", "semidescremada", "fortificada", "familiar", "grande", "mediano",
]);

/** Adivina el alimento genérico de un producto de marca ("Leche GLORIA Sin Lactosa 1L" → Leche). */
async function guessGenericFood(product: OffProduct): Promise<Food | null> {
  const supabase = createClient();
  // Los productos de supermercado ya vienen asociados a su alimento genérico.
  if (product.foodId) {
    const { data } = await supabase.from("foods").select("*").eq("id", product.foodId).single();
    if (data) return data as Food;
  }
  const brand = new Set((product.brand ?? "").toLowerCase().split(/[\s,]+/));
  const words = product.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length > 2 && !/\d/.test(w) && !STOPWORDS.has(w) && !brand.has(w));
  // Primero el nombre limpio completo, luego las primeras palabras ("leche", …).
  const queries = [words.join(" "), ...words.slice(0, 3)].filter(Boolean);
  for (const q of queries) {
    const { data } = await supabase.rpc("search_foods", { p_query: q, p_limit: 1 });
    const food = (data as Food[] | null)?.[0];
    if (food) return food;
  }
  return null;
}
