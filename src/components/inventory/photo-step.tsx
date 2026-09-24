"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Receipt, ShoppingBasket } from "lucide-react";
import { analyzeFoodPhoto } from "@/app/actions/vision";
import type { DetectedItem, PhotoMode } from "@/lib/photo";

const MAX_SIDE = 1600;

/** Reduce la foto a JPEG de máx. 1600 px para que viaje rápido al servidor. */
async function compress(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoStep({ onDetected }: { onDetected: (items: DetectedItem[]) => void }) {
  const t = useTranslations("photo");
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<PhotoMode>("food");

  function analyze(m: PhotoMode, file: File | undefined) {
    if (!file) return;
    setMode(m);
    start(async () => {
      try {
        const items = await analyzeFoodPhoto({ mode: m, dataUrl: await compress(file) });
        if (items.length) onDetected(items);
        else toast.error(t("noneFound"));
      } catch {
        toast.error(t("error"));
      }
    });
  }

  if (pending) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p>{mode === "receipt" ? t("analyzingReceipt") : t("analyzingFood")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <PhotoOption icon={<ShoppingBasket className="size-6" />} title={t("foodPhoto")} hint={t("foodPhotoHint")} onFile={(f) => analyze("food", f)} />
      <PhotoOption icon={<Receipt className="size-6" />} title={t("receiptPhoto")} hint={t("receiptPhotoHint")} onFile={(f) => analyze("receipt", f)} />
    </div>
  );
}

function PhotoOption({ icon, title, hint, onFile }: { icon: React.ReactNode; title: string; hint: string; onFile: (f: File | undefined) => void }) {
  // Sin `capture`: el iPhone ofrece tomar la foto o elegirla de la galería.
  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-2xl border p-4 active:bg-muted">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-sm text-muted-foreground">{hint}</div>
      </div>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}
