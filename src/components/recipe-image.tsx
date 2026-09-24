"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Foto del plato recortada al contenedor, con el emoji como respaldo. */
export function RecipeImage({ src, emoji, alt = "", className }: { src?: string | null; emoji?: string | null; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-2xl", className)}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden>{emoji || "🍽️"}</span>
      )}
    </div>
  );
}
