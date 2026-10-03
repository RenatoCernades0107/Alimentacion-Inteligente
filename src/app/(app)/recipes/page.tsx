import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { requireMember } from "@/lib/session";
import { todayIn } from "@/lib/dates";
import { suggest, type SuggestionMode } from "@/lib/suggestions";
import { loadFavoriteIds, loadMemberNames, loadRecipesAndInventory, parseCountries } from "@/lib/recipes";
import { PageHeader } from "@/components/page-header";
import { RecipeCard, type RecipeOwner } from "@/components/recipes/recipe-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Country, Recipe } from "@/lib/types";

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const TABS = ["all", "mine", "favorites"] as const;
type Tab = (typeof TABS)[number];

export default async function RecipesPage({ searchParams }: PageProps<"/recipes">) {
  const sp = await searchParams;
  const mode: SuggestionMode = sp.mode === "have" ? "have" : "any";
  const countries = parseCountries(sp.country);
  const mealType = MEAL_TYPES.find((m) => m === sp.type);
  const tab: Tab = TABS.find((x) => x === sp.tab) ?? "all";

  const { supabase, family, user } = await requireMember();
  const t = await getTranslations("recipes");
  const tm = await getTranslations("myRecipes");
  const tc = await getTranslations("countries");
  const tmt = await getTranslations("mealTypes");
  const locale = await getLocale();

  const [{ recipes, inventory }, favorites, memberNames] = await Promise.all([
    loadRecipesAndInventory(supabase, family.id),
    loadFavoriteIds(supabase, user.id),
    loadMemberNames(supabase, family.id),
  ]);

  // Los filtros de país y comida y el modo "con lo que tengo" aplican dentro de cada pestaña.
  const mine = recipes.filter((r) => r.created_by === user.id);
  const favs = recipes.filter((r) => favorites.has(r.id));
  const inTab: Recipe[] = tab === "mine" ? mine : tab === "favorites" ? favs : recipes;
  const results = suggest(inTab, inventory, { mode, countries, mealType, today: todayIn(family.timezone) });

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { tab: tab === "all" ? undefined : tab, mode, country: countries.join(","), type: mealType, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    return `/recipes?${params}`;
  };
  const toggleCountry = (c: Country) => {
    const set = countries.includes(c) ? countries.filter((x) => x !== c) : [...countries, c];
    return href({ country: (set.length ? set : [c]).join(",") });
  };

  const ownerOf = (r: Recipe): RecipeOwner => {
    if (!r.family_id) return null;
    if (r.created_by === user.id) return { kind: r.parent_recipe_id ? "myVersion" : "mine" };
    const name = r.created_by ? memberNames.get(r.created_by) : null;
    return name ? { kind: "member", name } : { kind: "family" };
  };

  const tabLabel: Record<Tab, { label: string; count?: number }> = {
    all: { label: tm("tabAll") },
    mine: { label: tm("tabMine"), count: mine.length },
    favorites: { label: tm("tabFavorites"), count: favs.length },
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        action={
          <Link href="/recipes/new" className={cn(buttonVariants({ size: "lg" }), "h-9 px-3")}>
            <Plus /> {tm("newRecipe")}
          </Link>
        }
      />

      <nav aria-label={t("title")} className="flex border-b text-sm font-medium">
        {TABS.map((x) => (
          <Link
            key={x}
            href={href({ tab: x === "all" ? undefined : x })}
            scroll={false}
            aria-current={tab === x ? "page" : undefined}
            className={cn(
              "-mb-px flex-1 border-b-2 py-2.5 text-center whitespace-nowrap",
              tab === x ? "border-primary text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {tabLabel[x].label}
            {tabLabel[x].count ? <span className="ml-1 text-xs text-muted-foreground tabular-nums">{tabLabel[x].count}</span> : null}
          </Link>
        ))}
      </nav>

      <div className="mt-3 grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
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
          <Chip key={m} href={href({ type: m })} active={mealType === m}>{tmt(m)}</Chip>
        ))}
      </div>

      {results.length === 0 ? (
        tab === "mine" && mine.length === 0 ? (
          <EmptyState emoji="👩‍🍳" title={tm("emptyMineTitle")} text={tm("emptyMine")}>
            <Link href="/recipes/new" className={cn(buttonVariants({ size: "lg" }), "h-10 px-4")}>
              <Plus /> {tm("create")}
            </Link>
          </EmptyState>
        ) : tab === "favorites" && favs.length === 0 ? (
          <EmptyState emoji="🤍" title={tm("emptyFavoritesTitle")} text={tm("emptyFavorites")}>
            <Link href={href({ tab: undefined })} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 px-4")}>
              {tm("seeAll")}
            </Link>
          </EmptyState>
        ) : (
          <p className="py-16 text-center text-muted-foreground">{tab === "all" && mode === "have" ? t("empty") : tm("emptyFiltered")}</p>
        )
      ) : (
        <ul className="mt-4 space-y-3">
          {results.map((s) => (
            <li key={s.recipe.id}>
              <RecipeCard suggestion={s} locale={locale} favorite={favorites.has(s.recipe.id)} owner={ownerOf(s.recipe)} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function EmptyState({ emoji, title, text, children }: { emoji: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
      <span className="text-5xl" aria-hidden>{emoji}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-xs text-sm text-muted-foreground">{text}</p>
      {children}
    </div>
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
