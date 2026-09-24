import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Clock } from "lucide-react";
import { requireMember } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { suggest, type SuggestionMode } from "@/lib/suggestions";
import { loadRecipesAndInventory, parseCountries } from "@/lib/recipes";
import { PageHeader } from "@/components/page-header";
import { RecipeImage } from "@/components/recipe-image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { localName, type Country } from "@/lib/types";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export default async function RecipesPage({ searchParams }: PageProps<"/recipes">) {
  const sp = await searchParams;
  const mode: SuggestionMode = sp.mode === "have" ? "have" : "any";
  const countries = parseCountries(sp.country);
  const mealType = MEAL_TYPES.find((m) => m === sp.type);

  const { supabase, family } = await requireMember();
  const t = await getTranslations("recipes");
  const tc = await getTranslations("countries");
  const tm = await getTranslations("mealTypes");
  const locale = await getLocale();

  const { recipes, inventory } = await loadRecipesAndInventory(supabase, family.id);
  const results = suggest(recipes, inventory, { mode, countries, mealType, today: todayIn(family.timezone) });

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { mode, country: countries.join(","), type: mealType, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    return `/recipes?${params}`;
  };
  const toggleCountry = (c: Country) => {
    const set = countries.includes(c) ? countries.filter((x) => x !== c) : [...countries, c];
    return href({ country: (set.length ? set : [c]).join(",") });
  };

  return (
    <>
      <PageHeader title={t("title")} />

      <div className="grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
        {(["have", "any"] as const).map((m) => (
          <Link key={m} href={href({ mode: m })} className={cn("rounded-lg py-2 text-center", mode === m ? "bg-background shadow-sm" : "text-muted-foreground")}>
            {m === "have" ? t("modeHave") : t("modeAny")}
          </Link>
        ))}
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {(["PE", "US"] as const).map((c) => (
          <Chip key={c} href={toggleCountry(c)} active={countries.includes(c)}>
            {c === "PE" ? "🇵🇪" : "🇺🇸"} {tc(c)}
          </Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-border" />
        <Chip href={href({ type: undefined })} active={!mealType}>{t("allMeals")}</Chip>
        {MEAL_TYPES.map((m) => (
          <Chip key={m} href={href({ type: m })} active={mealType === m}>{tm(m)}</Chip>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {results.map(({ recipe, have, total, missing, expiringUsed }) => (
            <li key={recipe.id}>
              <Link href={`/recipes/${recipe.slug}`} className="flex gap-3 rounded-2xl border bg-card p-3 active:bg-muted">
                <RecipeImage src={recipe.image_url} emoji={recipe.emoji} className="size-16 text-4xl" />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold leading-tight">{localName(recipe, locale)}</span>
                    <span className="shrink-0 text-sm">{recipe.country === "PE" ? "🇵🇪" : "🇺🇸"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge variant={missing.length === 0 ? "default" : "secondary"}>
                      {missing.length === 0 ? t("haveAll") : t("haveCount", { have, total })}
                    </Badge>
                    {expiringUsed > 0 && <Badge variant="outline" className="border-amber-300 text-amber-800">⏰ {t("usesExpiring")}</Badge>}
                    {recipe.time_minutes && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Clock className="size-3" /> {t("minutes", { count: recipe.time_minutes })}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground",
      )}
    >
      {children}
    </Link>
  );
}
