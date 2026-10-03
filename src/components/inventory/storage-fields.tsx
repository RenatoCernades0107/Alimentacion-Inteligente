"use client";

import { useTranslations } from "next-intl";
import { Lightbulb, TriangleAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NativeSelect } from "@/components/native-select";
import {
  adviceFor,
  durationParts,
  hasRipeness,
  RIPENESSES,
  storageNote,
  storageOptions,
  validRipeness,
  validStorage,
  type Ripeness,
  type ShelfFood,
  type Storage,
} from "@/lib/shelf-life";
import { cn } from "@/lib/utils";

type FoodProp = ShelfFood | null | undefined;

/** Nombre de un lugar con su aclaración: "Refrigerador · ya abierto". */
export function useStorageLabel(food: FoodProp) {
  const t = useTranslations("shelf");
  return (storage: Storage, withNote = true) => {
    const note = withNote ? storageNote(food, storage) : null;
    return note ? `${t(`storage.${storage}`)} · ${t(`note.${note}`)}` : t(`storage.${storage}`);
  };
}

// Selector segmentado: el elegido se ve con el color de la app y el resto, en contorno.
const itemClass = "h-auto min-h-11 flex-1 flex-col gap-0 px-1.5 py-1.5 text-center leading-tight whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary";

/** "¿Dónde lo vas a guardar?" Solo aparece si hay más de un lugar sensato para el alimento. */
export function StoragePicker({
  food,
  value,
  onChange,
  label,
  id,
}: {
  food: FoodProp;
  /** Lugar elegido (null = el recomendado). */
  value: Storage | null;
  onChange: (storage: Storage) => void;
  label?: string;
  id?: string;
}) {
  const t = useTranslations("shelf");
  const options = storageOptions(food);
  if (options.length < 2) return null;
  const selected = validStorage(food, value);

  return (
    <div className="space-y-2">
      <Label id={id}>{label ?? t("where")}</Label>
      <ToggleGroup
        aria-labelledby={id}
        variant="outline"
        className="w-full"
        value={selected ? [selected] : []}
        // Tocar el que ya está elegido no lo apaga: siempre hay un lugar.
        onValueChange={(v) => v[0] && onChange(v[0] as Storage)}
      >
        {options.map((s) => {
          const note = storageNote(food, s);
          return (
            <ToggleGroupItem key={s} value={s} className={itemClass}>
              <span className="text-sm">{t(`storage.${s}`)}</span>
              {note && <span className="text-[11px] font-normal opacity-80">{t(`note.${note}`)}</span>}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}

/** "¿Qué tan maduro está?" Solo para fruta que madura después de cosechada. */
export function RipenessPicker({
  food,
  value,
  onChange,
  id,
}: {
  food: FoodProp;
  value: Ripeness | null;
  onChange: (ripeness: Ripeness) => void;
  id?: string;
}) {
  const t = useTranslations("shelf");
  if (!hasRipeness(food)) return null;
  const selected = validRipeness(food, value);

  return (
    <div className="space-y-2">
      <Label id={id}>{t("ripeness")}</Label>
      <ToggleGroup
        aria-labelledby={id}
        variant="outline"
        className="w-full"
        value={selected ? [selected] : []}
        onValueChange={(v) => v[0] && onChange(v[0] as Ripeness)}
      >
        {RIPENESSES.map((r) => (
          <ToggleGroupItem key={r} value={r} className={cn(itemClass, "min-h-10 flex-row")}>
            {t(`state.${r}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** Versión compacta (selectores nativos) para las filas de la revisión de fotos. */
export function StorageSelects({
  food,
  storage,
  ripeness,
  onStorage,
  onRipeness,
}: {
  food: FoodProp;
  storage: Storage | null;
  ripeness: Ripeness | null;
  onStorage: (storage: Storage) => void;
  onRipeness: (ripeness: Ripeness) => void;
}) {
  const t = useTranslations("shelf");
  const label = useStorageLabel(food);
  const options = storageOptions(food);
  const ripe = hasRipeness(food);
  if (options.length < 2 && !ripe) return null;

  return (
    <div className={cn("grid gap-2", options.length > 1 && ripe ? "grid-cols-[1.6fr_1fr]" : "grid-cols-1")}>
      {options.length > 1 && (
        <NativeSelect value={validStorage(food, storage) ?? ""} onChange={(e) => onStorage(e.target.value as Storage)} aria-label={t("where")}>
          {options.map((s) => (
            <option key={s} value={s}>{label(s)}</option>
          ))}
        </NativeSelect>
      )}
      {ripe && (
        <NativeSelect value={validRipeness(food, ripeness) ?? ""} onChange={(e) => onRipeness(e.target.value as Ripeness)} aria-label={t("ripeness")}>
          {RIPENESSES.map((r) => (
            <option key={r} value={r}>{t(`state.${r}`)}</option>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}

/** "Dura aprox. 5 días en el refrigerador." */
export function EstimateHint({ days, storage }: { days: number | null; storage: Storage | null }) {
  const t = useTranslations("shelf");
  if (!days || !storage) return null;
  const { unit, n } = durationParts(days);
  return <>{t("estimate", { duration: t(`duration.${unit}`, { n }), where: t(`at.${storage}`) })}</>;
}

/** Avisos (reaccionan al lugar y la madurez elegidos) y consejos de conservación del alimento. */
export function ShelfAdvice({
  food,
  storage,
  ripeness,
  tips = true,
  className,
}: {
  food: FoodProp;
  storage: Storage | null;
  ripeness: Ripeness | null;
  /** false: solo los avisos. */
  tips?: boolean;
  className?: string;
}) {
  const t = useTranslations("shelf");
  const advice = adviceFor(food, storage, ripeness);
  if (!advice.warnings.length && (!tips || !advice.tips.length)) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {advice.warnings.map((id) => (
        <div
          key={id}
          role="alert"
          className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>{t(`warns.${id}`)}</p>
        </div>
      ))}
      {tips && advice.tips.length > 0 && (
        <div className="space-y-1.5 rounded-xl bg-muted/60 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Lightbulb className="size-3.5" aria-hidden /> {t("tipsTitle")}
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {advice.tips.map((id) => (
              <li key={id}>{t(`tips.${id}`)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
