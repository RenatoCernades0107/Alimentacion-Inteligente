"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { enUS, es } from "react-day-picker/locale";
import { toast } from "sonner";
import { Check, FileDown, LoaderCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { addDays, fromLocal, startOfWeek, toLocal } from "@/lib/dates";
import { MAX_PLAN_DAYS } from "@/lib/plan-pdf/shared";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "ready"; file: File };

const week = (start: string) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

function saveFile(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * En el celular se ofrece la hoja de compartir (guardar en Archivos, WhatsApp, imprimir…), que solo se
 * puede abrir con un toque del usuario: por eso se pide después de generar el PDF. En computador se descarga directo.
 */
function canShareFile(file: File) {
  return window.matchMedia("(pointer: coarse)").matches && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

/** Botón del encabezado del calendario: elegir los días y descargar la lista de compras y el plan de comidas en PDF. */
export function DownloadPlan({ today, date, weekStart, mealDates }: { today: string; date: string; weekStart: string; mealDates: string[] }) {
  const t = useTranslations("planPdf");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [month, setMonth] = useState(() => toLocal(weekStart));
  const [withShopping, setWithShopping] = useState(true);
  const [withPlan, setWithPlan] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const request = useRef<AbortController | null>(null);

  const thisWeek = startOfWeek(today);
  const presets = [
    { key: "thisDay", days: [date] },
    { key: "thisWeek", days: week(thisWeek) },
    { key: "nextWeek", days: week(addDays(thisWeek, 7)) },
    { key: "next7", days: Array.from({ length: 7 }, (_, i) => addDays(today, i)) },
  ];
  const sameAsSelected = (days: string[]) => days.length === selected.length && days.every((d) => selected.includes(d));
  const busy = status.kind === "busy";

  function show() {
    // Por defecto, la semana que se está viendo en el calendario.
    setSelected(week(weekStart));
    setMonth(toLocal(weekStart));
    setStatus({ kind: "idle" });
    setOpen(true);
  }

  function choose(days: string[]) {
    setSelected(days);
    setMonth(toLocal(days[0]));
    setStatus({ kind: "idle" });
  }

  // Siempre queda algo que incluir en el PDF.
  const toggleShopping = (on: boolean) => {
    setWithShopping(on);
    if (!on && !withPlan) setWithPlan(true);
  };
  const togglePlan = (on: boolean) => {
    setWithPlan(on);
    if (!on && !withShopping) setWithShopping(true);
  };

  async function generate() {
    const controller = new AbortController();
    request.current = controller;
    setStatus({ kind: "busy" });
    try {
      const params = new URLSearchParams({ dates: selected.join(","), shopping: withShopping ? "1" : "0", plan: withPlan ? "1" : "0" });
      const res = await fetch(`/api/plan-pdf?${params}`, { signal: controller.signal });
      if (!res.ok || !res.headers.get("content-type")?.includes("application/pdf")) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "server");
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "plan.pdf";
      const file = new File([await res.blob()], name, { type: "application/pdf" });
      if (canShareFile(file)) {
        setStatus({ kind: "ready", file });
      } else {
        saveFile(file);
        toast.success(t("downloaded"));
        setStatus({ kind: "idle" });
        setOpen(false);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      toast.error(error instanceof Error && error.message === "no_meals" ? t("noMeals") : t("error"));
      setStatus({ kind: "idle" });
    }
  }

  async function share(file: File) {
    try {
      await navigator.share({ files: [file], title: file.name });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) toast.error(t("error"));
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="rounded-full" onClick={show} aria-label={t("open")}>
        <FileDown /> {t("openShort")}
      </Button>

      <Drawer
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          request.current?.abort();
          setOpen(false);
        }}
      >
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-lg">{t("title")}</DrawerTitle>
            <DrawerDescription className="text-left">{t("subtitle")}</DrawerDescription>
          </DrawerHeader>

          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t("days")}</h3>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <Button key={p.key} variant={sameAsSelected(p.days) ? "default" : "outline"} size="sm" className="rounded-full" disabled={busy} onClick={() => choose(p.days)}>
                    {t(p.key)}
                  </Button>
                ))}
              </div>
              <div className="flex justify-center rounded-2xl border bg-card">
                <Calendar
                  mode="multiple"
                  locale={locale === "en" ? enUS : es}
                  weekStartsOn={1}
                  max={MAX_PLAN_DAYS}
                  month={month}
                  onMonthChange={setMonth}
                  selected={selected.map(toLocal)}
                  onSelect={(days) => {
                    setSelected((days ?? []).map(fromLocal).sort());
                    setStatus({ kind: "idle" });
                  }}
                  disabled={busy}
                  modifiers={{ hasMeals: mealDates.map(toLocal) }}
                  modifiersClassNames={{
                    hasMeals: "after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
                  }}
                  className="[--cell-size:--spacing(10)]"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {t("daysSelected", { count: selected.length })}
                  {selected.length >= MAX_PLAN_DAYS && ` · ${t("maxDays", { count: MAX_PLAN_DAYS })}`}
                </p>
                <Button variant="ghost" size="sm" disabled={busy || selected.length === 0} onClick={() => setSelected([])}>
                  {t("clear")}
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t("include")}</h3>
              <div className="flex items-start gap-3 rounded-2xl border bg-card p-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="pdf-shopping" className="text-base">{t("shopping")}</Label>
                  <p className="text-sm text-muted-foreground">{t("shoppingHint")}</p>
                </div>
                <Switch id="pdf-shopping" checked={withShopping} onCheckedChange={toggleShopping} disabled={busy} />
              </div>
              <div className="flex items-start gap-3 rounded-2xl border bg-card p-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <Label htmlFor="pdf-plan" className="text-base">{t("plan")}</Label>
                  <p className="text-sm text-muted-foreground">{t("planHint")}</p>
                </div>
                <Switch id="pdf-plan" checked={withPlan} onCheckedChange={togglePlan} disabled={busy} />
              </div>
            </section>

            {status.kind === "ready" ? (
              <div className="space-y-3 rounded-2xl bg-primary/10 p-4 text-center">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-5" strokeWidth={3} />
                </div>
                <div>
                  <p className="font-semibold">{t("ready")}</p>
                  <p className="truncate text-xs text-muted-foreground">{status.file.name} · {Math.max(1, Math.round(status.file.size / 1024))} KB</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="lg" variant="outline" className="h-11" onClick={() => saveFile(status.file)}>
                    <FileDown /> {t("save")}
                  </Button>
                  <Button size="lg" className="h-11" onClick={() => share(status.file)}>
                    <Share2 /> {t("share")}
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStatus({ kind: "idle" })}>{t("another")}</Button>
              </div>
            ) : (
              <Button size="lg" className="h-11 text-base" disabled={busy || selected.length === 0} onClick={generate}>
                {busy ? <LoaderCircle className="animate-spin" /> : <FileDown />}
                {busy ? t("generating") : t("download")}
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
