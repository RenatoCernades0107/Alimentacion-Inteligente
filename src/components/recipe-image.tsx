"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Pedidos de fotos generadas en curso o resueltos, compartidos por todas las tarjetas de la página. */
const generated = new Map<string, Promise<string | null>>();

function requestImage(recipeId: string) {
  let p = generated.get(recipeId);
  if (!p) {
    p = fetch(`/api/recipes/${recipeId}/image`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : { url: null }))
      .then((j: { url: string | null }) => j.url)
      .catch(() => null);
    generated.set(recipeId, p);
  }
  return p;
}

/**
 * Foto del plato recortada al contenedor, con el emoji como respaldo. Con `recipeId`, si la receta no
 * tiene foto se pide que se genere con IA (src/lib/dish-image.ts) y aparece con un fundido al llegar.
 */
export function RecipeImage({
  src, emoji, alt = "", className, recipeId,
}: { src?: string | null; emoji?: string | null; alt?: string; className?: string; recipeId?: string }) {
  const [failed, setFailed] = useState(false);
  const [fetched, setFetched] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const url = src || fetched;

  useEffect(() => {
    if (src || !recipeId) return;
    let alive = true;
    requestImage(recipeId).then((u) => alive && u && setFetched(u));
    return () => {
      alive = false;
    };
  }, [src, recipeId]);

  return (
    <div className={cn("relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-2xl dark:from-amber-950/40 dark:to-orange-900/40", className)}>
      {(!url || failed || !loaded) && <span aria-hidden>{emoji || "🍽️"}</span>}
      {url && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          loading="lazy"
          className={cn("absolute inset-0 size-full object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
