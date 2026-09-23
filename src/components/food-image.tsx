"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Imagen del alimento con el emoji como respaldo. */
export function FoodImage({ src, emoji, alt, className }: { src?: string | null; emoji?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-2xl", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="size-full object-contain p-1" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden>{emoji || "🍽️"}</span>
      )}
    </div>
  );
}
