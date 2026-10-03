import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Clock } from "lucide-react";
import { RecipeImage } from "@/components/recipe-image";
import { FavoriteButton } from "@/components/recipes/favorite-button";
import { Badge } from "@/components/ui/badge";
import type { Suggestion } from "@/lib/suggestions";
import { localName } from "@/lib/types";

/** Quién hizo la receta, para la etiqueta de la tarjeta (null en las del catálogo). */
export type RecipeOwner = { kind: "mine" | "myVersion" | "family" } | { kind: "member"; name: string } | null;

/**
 * Tarjeta de una receta en la lista. El corazón queda fuera del link para no anidar controles
 * interactivos; el nombre deja espacio a la derecha para que no se pise con él.
 */
export async function RecipeCard({
  suggestion: { recipe, have, total, missing, expiringUsed }, locale, favorite, owner,
}: {
  suggestion: Suggestion;
  locale: string;
  favorite: boolean;
  owner: RecipeOwner;
}) {
  const t = await getTranslations("recipes");
  const tm = await getTranslations("myRecipes");

  const ownerLabel =
    owner?.kind === "mine" ? tm("badgeMine")
    : owner?.kind === "myVersion" ? tm("badgeMyVersion")
    : owner?.kind === "member" ? tm("badgeBy", { name: owner.name })
    : owner?.kind === "family" ? tm("badgeFamily")
    : null;

  return (
    <div className="relative">
      <Link href={`/recipes/${recipe.slug}`} className="flex gap-3 rounded-2xl border bg-card p-3 active:bg-muted">
        <RecipeImage src={recipe.image_url} emoji={recipe.emoji} className="size-16 text-4xl" />
        <div className="min-w-0 flex-1 space-y-1">
          <span className="block pr-9 font-semibold leading-tight">{localName(recipe, locale)}</span>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-sm">{recipe.country === "PE" ? "🇵🇪" : "🇺🇸"}</span>
            <Badge variant={missing.length === 0 ? "default" : "secondary"}>
              {missing.length === 0 ? t("haveAll") : t("haveCount", { have, total })}
            </Badge>
            {expiringUsed > 0 && <Badge variant="outline" className="border-amber-300 text-amber-800">⏰ {t("usesExpiring")}</Badge>}
            {ownerLabel && <Badge variant="outline">{ownerLabel}</Badge>}
            {recipe.time_minutes && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3" /> {t("minutes", { count: recipe.time_minutes })}
              </span>
            )}
            {recipe.kcal_per_serving ? (
              <span className="text-muted-foreground tabular-nums">
                {recipe.kcal_complete ? "≈" : "~"} {recipe.kcal_per_serving} kcal
              </span>
            ) : null}
          </div>
        </div>
      </Link>
      <FavoriteButton recipeId={recipe.id} favorite={favorite} className="absolute top-1.5 right-1.5" />
    </div>
  );
}
