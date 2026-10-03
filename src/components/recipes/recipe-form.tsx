"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Info, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { FoodImage } from "@/components/food-image";
import { IngredientPicker, type PickedFood } from "@/components/recipes/ingredient-picker";
import { saveRecipe } from "@/app/actions/recipes";
import { RECIPE_EMOJIS, RECIPE_MEAL_TYPES, type RecipeInput, type RecipeMealType } from "@/lib/recipe-form";
import { UNITS } from "@/lib/units";
import { localName, type Country, type Unit } from "@/lib/types";
import { cn } from "@/lib/utils";

export type IngredientRow = { food: PickedFood; quantity: string; unit: Unit; optional: boolean };

/** Valores iniciales del formulario (ya en el idioma de quien edita). */
export type RecipeFormValues = {
  name: string;
  description: string;
  emoji: string;
  mealTypes: RecipeMealType[];
  servings: string;
  timeMinutes: string;
  country: Country;
  sourceUrl: string;
  ingredients: IngredientRow[];
  steps: string[];
};

/** Aviso sobre lo que pasará al guardar. */
export type FormNotice = { kind: "catalog" } | { kind: "member"; name: string } | { kind: "myVersion" } | null;

const ERRORS = { invalid: "errorInvalid", kcal: "errorKcal", gone: "errorGone", limit: "errorLimit" } as const;

/** Número de un campo de texto ("1,5" también vale); null si está vacío o no es un número. */
function toNumber(v: string) {
  const n = Number(v.trim().replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
}

export function RecipeForm({
  initial, sourceId, notice,
}: {
  initial: RecipeFormValues;
  /** Receta que se está editando; null = receta nueva. */
  sourceId: string | null;
  notice: FormNotice;
}) {
  const t = useTranslations("myRecipes");
  const tm = useTranslations("mealTypes");
  const tc = useTranslations("countries");
  const tu = useTranslations("units");
  const tcm = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mealTypes, setMealTypes] = useState<RecipeMealType[]>(initial.mealTypes);
  const [servings, setServings] = useState(initial.servings);
  const [time, setTime] = useState(initial.timeMinutes);
  const [country, setCountry] = useState<Country>(initial.country);
  const [sourceUrl, setSourceUrl] = useState(initial.sourceUrl);
  const [ingredients, setIngredients] = useState<IngredientRow[]>(initial.ingredients);
  const [steps, setSteps] = useState<string[]>(initial.steps.length ? initial.steps : [""]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const servingsValue = toNumber(servings);
  const valid =
    name.trim().length > 0 &&
    mealTypes.length > 0 &&
    ingredients.length > 0 &&
    servingsValue !== null &&
    Number.isInteger(servingsValue) &&
    servingsValue >= 1;

  const emojiChoices = emoji && !(RECIPE_EMOJIS as readonly string[]).includes(emoji) ? [emoji, ...RECIPE_EMOJIS] : RECIPE_EMOJIS;

  const patchIngredient = (id: string, patch: Partial<IngredientRow>) =>
    setIngredients((rows) => rows.map((r) => (r.food.id === id ? { ...r, ...patch } : r)));
  const patchStep = (i: number, text: string) => setSteps((s) => s.map((x, j) => (j === i ? text : x)));
  const moveStep = (i: number, by: -1 | 1) =>
    setSteps((s) => {
      const j = i + by;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || pending) return;
    const input: RecipeInput = {
      sourceId,
      name,
      description,
      emoji,
      mealTypes,
      servings: servingsValue!,
      timeMinutes: toNumber(time),
      country,
      sourceUrl,
      // Sin cantidad = "al gusto": no lleva unidad.
      ingredients: ingredients.map((r) => {
        const quantity = toNumber(r.quantity);
        return { foodId: r.food.id, quantity, unit: quantity === null ? null : r.unit, optional: r.optional };
      }),
      steps,
    };
    start(async () => {
      try {
        const result = await saveRecipe(input);
        if (!result.ok) {
          toast.error(t(ERRORS[result.error]));
          return;
        }
        toast.success(result.copied ? t("savedAsCopy") : t("saved"));
        router.replace(`/recipes/${result.slug}`);
      } catch {
        toast.error(tcm("error"));
      }
    });
  }

  const noticeText =
    notice?.kind === "catalog" ? t("noticeCatalog")
    : notice?.kind === "member" ? t("noticeMember", { name: notice.name })
    : notice?.kind === "myVersion" ? t("noticeMyVersion")
    : null;

  return (
    <form onSubmit={submit} className="space-y-6 pb-6">
      {noticeText && (
        <div className="flex gap-2 rounded-xl bg-muted/70 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>{noticeText}</p>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="r-emoji">{t("fieldEmoji")}</Label>
            <button
              id="r-emoji"
              type="button"
              onClick={() => setEmojiOpen((o) => !o)}
              aria-expanded={emojiOpen}
              className="flex size-10 items-center justify-center rounded-lg border border-input bg-gradient-to-br from-amber-50 to-orange-100 text-2xl"
            >
              <span aria-hidden>{emoji || "🍽️"}</span>
            </button>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="r-name">{t("fieldName")}</Label>
            <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} maxLength={80} required className="h-10" />
          </div>
        </div>
        {emojiOpen && (
          <div className="grid grid-cols-8 gap-1 rounded-xl border bg-card p-2">
            {emojiChoices.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setEmoji(e);
                  setEmojiOpen(false);
                }}
                className={cn("flex aspect-square items-center justify-center rounded-lg text-2xl active:bg-muted", emoji === e && "bg-primary/10 ring-1 ring-primary")}
              >
                <span aria-hidden>{e}</span>
              </button>
            ))}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="r-desc">{t("fieldDescription")}</Label>
          <Textarea id="r-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} rows={2} />
        </div>
      </section>

      <section className="space-y-3">
        <Label>{t("fieldMealTypes")}</Label>
        <div className="flex flex-wrap gap-2">
          {RECIPE_MEAL_TYPES.map((m) => {
            const on = mealTypes.includes(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => setMealTypes((list) => (on ? list.filter((x) => x !== m) : [...list, m]))}
                className={cn("rounded-full border px-3 py-1.5 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}
              >
                {tm(m)}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="r-servings">{t("fieldServings")}</Label>
            <Input id="r-servings" type="number" inputMode="numeric" min={1} max={100} step={1} value={servings} onChange={(e) => setServings(e.target.value)} required className="h-10" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-time">{t("fieldTime")}</Label>
            <Input id="r-time" type="number" inputMode="numeric" min={1} max={1440} step={1} value={time} onChange={(e) => setTime(e.target.value)} className="h-10" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("fieldCountry")}</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["PE", "US"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={country === c}
                onClick={() => setCountry(c)}
                className={cn("h-10 rounded-lg border text-sm", country === c ? "border-primary bg-primary/10 font-medium" : "bg-background text-muted-foreground")}
              >
                {c === "PE" ? "🇵🇪" : "🇺🇸"} {tc(c)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("ingredientsTitle")}</h2>
        {ingredients.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">{t("ingredientsEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {ingredients.map((row) => {
              const fname = localName(row.food, locale);
              return (
                <li key={row.food.id} className="space-y-2 rounded-2xl border bg-card p-2.5">
                  <div className="flex items-center gap-3">
                    <FoodImage src={row.food.image_url} emoji={row.food.emoji} alt="" className="size-10" />
                    <span className="min-w-0 flex-1 truncate font-medium">{fname}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("remove", { name: fname })}
                      onClick={() => setIngredients((rows) => rows.filter((r) => r.food.id !== row.food.id))}
                    >
                      <X />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="decimal"
                      aria-label={t("quantity")}
                      placeholder={t("toTaste")}
                      value={row.quantity}
                      onChange={(e) => patchIngredient(row.food.id, { quantity: e.target.value })}
                      className="h-10 w-28"
                    />
                    <NativeSelect
                      aria-label={t("unit")}
                      value={row.unit}
                      disabled={toNumber(row.quantity) === null}
                      onChange={(e) => patchIngredient(row.food.id, { unit: e.target.value as Unit })}
                      className="w-28"
                    >
                      {UNITS.map((u) => <option key={u} value={u}>{tu(u)}</option>)}
                    </NativeSelect>
                    <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                      <Switch size="sm" checked={row.optional} onCheckedChange={(checked) => patchIngredient(row.food.id, { optional: checked })} />
                      {t("optionalSwitch")}
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Button type="button" variant="outline" className="h-10 w-full" onClick={() => setPickerOpen(true)}>
          <Plus /> {t("addIngredient")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("ingredientsHint")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("stepsTitle")}</h2>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{i + 1}</span>
              <Textarea
                value={step}
                onChange={(e) => patchStep(i, e.target.value)}
                placeholder={t("stepPlaceholder")}
                aria-label={t("stepLabel", { number: i + 1 })}
                maxLength={600}
                rows={2}
                className="min-w-0 flex-1"
              />
              <div className="flex flex-col">
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("moveUp")} disabled={i === 0} onClick={() => moveStep(i, -1)}>
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("moveDown")} disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}>
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("removeStep", { number: i + 1 })}
                  onClick={() => setSteps((s) => (s.length > 1 ? s.filter((_, j) => j !== i) : [""]))}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <Button type="button" variant="outline" className="h-10 w-full" onClick={() => setSteps((s) => [...s, ""])} disabled={steps.length >= 40}>
          <Plus /> {t("addStep")}
        </Button>
      </section>

      <section className="space-y-2">
        <Label htmlFor="r-source">{t("fieldSource")}</Label>
        <Input id="r-source" type="url" inputMode="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://" maxLength={500} className="h-10" />
      </section>

      <div className="space-y-2">
        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={!valid || pending}>
          {tcm("save")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t("kcalHint")}</p>
      </div>

      <IngredientPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        exclude={ingredients.map((r) => r.food.id)}
        onPick={(food) => {
          setIngredients((rows) => [...rows, { food, quantity: "", unit: food.default_unit, optional: false }]);
          setPickerOpen(false);
        }}
      />
    </form>
  );
}
