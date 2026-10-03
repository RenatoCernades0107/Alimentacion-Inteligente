"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { toggleFavorite } from "@/app/actions/recipes";
import { cn } from "@/lib/utils";

/** Corazón para marcar una receta como favorita (es del usuario, no de la familia). */
export function FavoriteButton({ recipeId, favorite, className }: { recipeId: string; favorite: boolean; className?: string }) {
  const t = useTranslations("myRecipes");
  const tc = useTranslations("common");
  const [optimistic, setOptimistic] = useOptimistic(favorite);
  const [, start] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? t("unfavorite") : t("favorite")}
      onClick={() =>
        start(async () => {
          // Se pinta al instante; si la acción falla, React vuelve al valor real.
          setOptimistic(!optimistic);
          try {
            await toggleFavorite(recipeId, !optimistic);
          } catch {
            toast.error(tc("error"));
          }
        })
      }
      className={cn("flex size-10 items-center justify-center rounded-full text-muted-foreground active:bg-muted", className)}
    >
      <Heart className={cn("size-5 transition-colors", optimistic && "fill-rose-500 text-rose-500")} />
    </button>
  );
}
