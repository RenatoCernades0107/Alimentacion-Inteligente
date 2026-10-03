import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireMember } from "@/lib/session";
import { RecipeForm, type RecipeFormValues } from "@/components/recipes/recipe-form";
import type { Country } from "@/lib/types";

export default async function NewRecipePage() {
  const { family } = await requireMember();
  const t = await getTranslations("myRecipes");
  const locale = await getLocale();

  // País de origen sugerido: Perú para quien está en Lima o usa la app en español; si no, USA.
  const country: Country = family.timezone === "America/Lima" || locale === "es" ? "PE" : "US";
  const initial: RecipeFormValues = {
    name: "",
    description: "",
    emoji: "",
    mealTypes: ["lunch", "dinner"],
    servings: "4",
    timeMinutes: "",
    country,
    sourceUrl: "",
    ingredients: [],
    steps: [],
  };

  return (
    <div className="pb-6">
      <div className="pt-3">
        <Link href="/recipes?tab=mine" className="-ml-2 inline-flex items-center gap-1 rounded-lg p-2 text-sm text-muted-foreground">
          <ArrowLeft className="size-4" /> {t("tabMine")}
        </Link>
      </div>
      <h1 className="pb-4 text-2xl font-bold tracking-tight">{t("formTitleNew")}</h1>
      <RecipeForm initial={initial} sourceId={null} notice={null} />
    </div>
  );
}
