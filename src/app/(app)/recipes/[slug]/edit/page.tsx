import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireMember } from "@/lib/session";
import { loadMemberNames, RECIPE_SELECT, sortIngredients, type RecipeIngredientRow } from "@/lib/recipes";
import { RECIPE_MEAL_TYPES, resolveEditTarget, textsInLocale } from "@/lib/recipe-form";
import { RecipeForm, type FormNotice, type IngredientRow, type RecipeFormValues } from "@/components/recipes/recipe-form";
import type { Recipe } from "@/lib/types";

export default async function EditRecipePage({ params }: PageProps<"/recipes/[slug]/edit">) {
  const { slug } = await params;
  const { supabase, user, family } = await requireMember();
  const t = await getTranslations("myRecipes");
  const locale = await getLocale();

  const { data } = await supabase.from("recipes").select(RECIPE_SELECT).eq("slug", slug).maybeSingle();
  if (!data) notFound();
  const recipe = data as Recipe;

  // Si la receta no es mía y ya hice mi versión, se edita esa (así no se pisa con la original).
  const { data: mine } = await supabase.from("recipes").select("id, slug, parent_recipe_id").eq("created_by", user.id).eq("parent_recipe_id", recipe.id);
  const target = resolveEditTarget(recipe, user.id, mine ?? []);
  if (target.kind === "my-copy") {
    const copy = (mine ?? []).find((r) => r.id === target.id);
    if (copy) redirect(`/recipes/${copy.slug}/edit`);
  }

  let notice: FormNotice = null;
  if (target.kind === "new-copy") {
    if (recipe.family_id) {
      const name = recipe.created_by ? (await loadMemberNames(supabase, family.id)).get(recipe.created_by) : null;
      notice = name ? { kind: "member", name } : { kind: "catalog" };
    } else {
      notice = { kind: "catalog" };
    }
  } else if (recipe.parent_recipe_id) {
    notice = { kind: "myVersion" };
  }

  const texts = textsInLocale(
    {
      name_es: recipe.name_es,
      name_en: recipe.name_en,
      description_es: recipe.description_es,
      description_en: recipe.description_en,
      steps_es: recipe.steps_es,
      steps_en: recipe.steps_en,
    },
    locale === "en" ? "en" : "es",
  );
  const ingredients: IngredientRow[] = sortIngredients(recipe.recipe_ingredients as RecipeIngredientRow[] | undefined)
    .filter((i) => i.food)
    .map(({ food: f, quantity, unit, optional }) => ({
      // Solo lo que el formulario necesita del alimento.
      food: { id: f!.id, name_es: f!.name_es, name_en: f!.name_en, emoji: f!.emoji, image_url: f!.image_url, default_unit: f!.default_unit, family_id: f!.family_id },
      quantity: quantity != null ? String(Number(quantity)) : "",
      unit: unit ?? f!.default_unit,
      optional,
    }));

  const initial: RecipeFormValues = {
    name: texts.name,
    description: texts.description,
    emoji: recipe.emoji ?? "",
    mealTypes: RECIPE_MEAL_TYPES.filter((m) => recipe.meal_types.includes(m)),
    servings: String(recipe.servings),
    timeMinutes: recipe.time_minutes ? String(recipe.time_minutes) : "",
    country: recipe.country,
    sourceUrl: recipe.source_url ?? "",
    ingredients,
    steps: texts.steps,
  };

  return (
    <div className="pb-6">
      <div className="pt-3">
        <Link href={`/recipes/${recipe.slug}`} className="-ml-2 inline-flex items-center gap-1 rounded-lg p-2 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> {texts.name}
        </Link>
      </div>
      <h1 className="pb-4 text-2xl font-bold tracking-tight">{t("formTitleEdit")}</h1>
      <RecipeForm key={recipe.id} initial={initial} sourceId={recipe.id} notice={notice} />
    </div>
  );
}
