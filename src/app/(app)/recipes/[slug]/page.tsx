import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Check, Clock, ExternalLink, Users } from "lucide-react";
import { requireMember } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { slotsFor } from "@/lib/meals";
import { RECIPE_SELECT } from "@/lib/recipes";
import { formatQuantity } from "@/lib/units";
import { FoodImage } from "@/components/food-image";
import { RecipeImage } from "@/components/recipe-image";
import { AddRecipeToCalendar } from "@/components/meals/add-recipe-to-calendar";
import { localName, type Recipe } from "@/lib/types";
import { cn } from "@/lib/utils";
import photoCredits from "../../../../../public/recipes/CREDITS.json";

export default async function RecipePage({ params }: PageProps<"/recipes/[slug]">) {
  const { slug } = await params;
  const { supabase, family, isParent } = await requireMember();
  const t = await getTranslations("recipes");
  const tu = await getTranslations("units");
  const tc = await getTranslations("countries");
  const locale = await getLocale();

  const [{ data }, { data: inventory }] = await Promise.all([
    supabase.from("recipes").select(RECIPE_SELECT).eq("slug", slug).maybeSingle(),
    supabase.from("inventory_items").select("food_id").eq("family_id", family.id).gt("quantity", 0),
  ]);
  if (!data) notFound();
  const recipe = data as Recipe;
  const have = new Set((inventory ?? []).map((i) => i.food_id));

  const ingredients = [...(recipe.recipe_ingredients ?? [])].sort((a, b) => Number(a.optional) - Number(b.optional));
  const steps = locale === "en" ? recipe.steps_en : recipe.steps_es;
  const slots = slotsFor(family.meals_per_day);
  const defaultSlot = slots.find((s) => recipe.meal_types.includes(s)) ?? (recipe.meal_types.includes("snack") ? slots.find((s) => s.includes("snack")) : undefined) ?? slots[0];

  const credit = (photoCredits as Record<string, { page: string; author: string; license: string }>)[recipe.slug];

  return (
    <article className="pb-6">
      <div className="pt-3">
        <Link href="/recipes" className="-ml-2 inline-flex items-center gap-1 rounded-lg p-2 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> {t("title")}
        </Link>
      </div>

      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <RecipeImage src={recipe.image_url} emoji={recipe.emoji} alt={localName(recipe, locale)} className="aspect-[4/3] h-auto w-full max-w-sm rounded-3xl text-6xl" />
        {credit && (
          <a href={credit.page} target="_blank" rel="noreferrer" className="-mt-1 max-w-sm truncate text-xs text-muted-foreground">
            {t("photoCredit", { author: credit.author, license: credit.license })}
          </a>
        )}
        <h1 className="text-2xl font-bold">{localName(recipe, locale)}</h1>
        <p className="text-muted-foreground">{locale === "en" ? recipe.description_en : recipe.description_es}</p>
        <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
          <span>{recipe.country === "PE" ? "🇵🇪" : "🇺🇸"} {tc(recipe.country)}</span>
          {recipe.time_minutes && <span className="inline-flex items-center gap-1"><Clock className="size-4" /> {t("minutes", { count: recipe.time_minutes })}</span>}
          <span className="inline-flex items-center gap-1"><Users className="size-4" /> {t("servings", { count: recipe.servings })}</span>
        </div>
      </div>

      <AddRecipeToCalendar
        recipeId={recipe.id}
        date={todayIn(family.timezone)}
        slot={defaultSlot}
        slots={slots}
        isParent={isParent}
        recipes={[{ id: recipe.id, slug: recipe.slug, name_es: recipe.name_es, name_en: recipe.name_en, emoji: recipe.emoji, image_url: recipe.image_url, meal_types: recipe.meal_types, country: recipe.country }]}
      />

      <h2 className="mt-6 mb-2 text-lg font-semibold">{t("ingredients")}</h2>
      <ul className="divide-y rounded-2xl border bg-card">
        {ingredients.map((ing) => {
          const ok = have.has(ing.food_id) || ing.food?.category === "basics";
          return (
            <li key={ing.food_id} className="flex items-center gap-3 p-2.5">
              <FoodImage src={ing.food?.image_url} emoji={ing.food?.emoji} alt="" className="size-10" />
              <div className="min-w-0 flex-1">
                <span className={cn(!ok && "text-muted-foreground")}>{ing.food ? localName(ing.food, locale) : ""}</span>
                {ing.optional && <span className="ml-1 text-xs text-muted-foreground">({t("optional")})</span>}
              </div>
              {ing.quantity && ing.unit && (
                <span className="text-sm text-muted-foreground">{formatQuantity(ing.quantity)} {tu(ing.unit)}</span>
              )}
              {ok ? <Check className="size-4 text-primary" /> : <span className="text-xs font-medium text-orange-600">{t("missing")}</span>}
            </li>
          );
        })}
      </ul>

      <h2 className="mt-6 mb-2 text-lg font-semibold">{t("steps")}</h2>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{i + 1}</span>
            <p className="pt-0.5">{step}</p>
          </li>
        ))}
      </ol>

      {recipe.source_url && (
        <a href={recipe.source_url} target="_blank" rel="noreferrer" className="mt-6 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
          {t("source")} <ExternalLink className="size-3.5" />
        </a>
      )}
    </article>
  );
}
