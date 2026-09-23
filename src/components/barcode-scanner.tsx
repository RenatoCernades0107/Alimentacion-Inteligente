"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { IScannerControls } from "@zxing/browser";

/** Lector de código de barras con la cámara trasera (funciona en Safari de iPhone). */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const t = useTranslations("search");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let done = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current!,
          (result) => {
            if (result && !done) {
              done = true;
              controls?.stop();
              navigator.vibrate?.(50);
              onDetectedRef.current(result.getText());
            }
          },
        );
      } catch {
        setError(true);
      }
    })();

    return () => controls?.stop();
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className="size-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/80" />
      </div>
      <p className="text-center text-sm text-muted-foreground">{error ? t("cameraError") : t("scanning")}</p>
    </div>
  );
}
