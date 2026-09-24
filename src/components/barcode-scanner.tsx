"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Lector de código de barras con la cámara trasera.
 * Usa zxing-cpp (WASM) vía `barcode-detector`, que funciona en Safari de iPhone.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const t = useTranslations("search");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    let frame = 0;

    const stop = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };

    (async () => {
      try {
        const { BarcodeDetector } = await import("barcode-detector/ponyfill");
        const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });

        // Resolución alta: a 640×480 (lo que da iOS por defecto) las barras salen borrosas.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) return stop();
        const [track] = stream.getVideoTracks();
        await track
          .applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] })
          .catch(() => {});

        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        const scan = async () => {
          if (cancelled) return;
          if (video.readyState >= video.HAVE_CURRENT_DATA) {
            const [barcode] = await detector.detect(video).catch(() => []);
            if (cancelled) return;
            if (barcode) {
              stop();
              navigator.vibrate?.(50);
              onDetectedRef.current(barcode.rawValue);
              return;
            }
          }
          frame = requestAnimationFrame(scan);
        };
        scan();
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return stop;
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
