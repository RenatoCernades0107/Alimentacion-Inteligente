import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { requireMember } from "@/lib/session";
import { materializeSeries } from "@/lib/calendar";
import { addDays, todayIn } from "@/lib/dates";
import { slotsFor } from "@/lib/meals";
import { suggest } from "@/lib/suggestions";
import { loadRecipesAndInventory } from "@/lib/recipes";
import { Section } from "@/components/page-header";
import { FoodImage } from "@/components/food-image";
import { ExpiryBadge } from "@/components/inventory/expiry-badge";
import { InviteCard } from "@/components/family/invite-card";
import { PushCard } from "@/components/family/push-card";
import { HomeMeals } from "@/components/meals/home-meals";
import { itemName, localName, type InventoryItem, type Meal } from "@/lib/types";

export default async function HomePage() {
  const { supabase, family, profile, isParent } = await requireMember();
  const t = await getTranslations("home");
  const locale = await getLocale();
  const today = todayIn(family.timezone);

  await materializeSeries(family.id, addDays(today, 14));

  const mealSelect = "*, recipe:recipes(id, slug, name_es, name_en, emoji), series:meal_series(recurrence), proposer:profiles!meals_proposed_by_fkey(full_name)";
  const [{ data: todayMeals }, { data: proposals }, { data: pending }, { data: expiring }, { recipes, inventory }] = await Promise.all([
    supabase.from("meals").select(mealSelect).eq("family_id", family.id).eq("date", today).neq("status", "cancelled"),
    isParent
      ? supabase.from("meals").select(mealSelect).eq("family_id", family.id).eq("status", "proposed").gte("date", today).order("date")
      : Promise.resolve({ data: [] }),
    isParent
      ? supabase.from("meals").select(mealSelect).eq("family_id", family.id).eq("status", "planned").lt("date", today).gte("date", addDays(today, -7)).order("date")
      : Promise.resolve({ data: [] }),
    supabase.from("inventory_items").select("*, food:foods(*)").eq("family_id", family.id).not("expires_on", "is", null).lte("expires_on", addDays(today, 7)).order("expires_on"),
    loadRecipesAndInventory(supabase, family.id),
  ]);

  const slots = slotsFor(family.meals_per_day);
  const suggestions = (todayMeals ?? []).length === 0
    ? suggest(recipes, inventory, { mode: "any", countries: ["PE", "US"], mealType: "lunch", today }).slice(0, 3)
    : [];
  const firstName = profile.full_name?.split(" ")[0] ?? "";

  return (
    <>
      <header className="pt-4 pb-1">
        <p className="text-sm text-muted-foreground">{family.name}</p>
        <h1 className="text-2xl font-bold tracking-tight">{t("hello", { name: firstName })} 👋</h1>
      </header>

      <PushCard compact />

      {(proposals ?? []).length > 0 && (
        <Section title={t("proposals")}>
          <HomeMeals meals={proposals as Meal[]} today={today} isParent={isParent} slots={slots} showDate />
        </Section>
      )}

      <Section title={t("todayMeals")} action={<Link href="/calendar" className="text-sm text-primary">→</Link>}>
        {(todayMeals ?? []).length > 0 ? (
          <HomeMeals meals={todayMeals as Meal[]} today={today} isParent={isParent} slots={slots} />
        ) : (
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-muted-foreground">{t("noMealsToday")}</p>
            <ul className="mt-3 space-y-2">
              {suggestions.map(({ recipe }) => (
                <li key={recipe.id}>
                  <Link href={`/recipes/${recipe.slug}`} className="flex items-center gap-3 rounded-xl bg-muted/60 p-2">
                    <span className="text-2xl">{recipe.emoji}</span>
                    <span className="flex-1 font-medium">{localName(recipe, locale)}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/recipes" className="mt-3 inline-block text-sm font-medium text-primary">{t("seeSuggestions")} →</Link>
          </div>
        )}
      </Section>

      {(pending ?? []).length > 0 && (
        <Section title={t("pendingCompletion")}>
          <p className="mb-2 text-sm text-muted-foreground">{t("pendingCompletionHint")}</p>
          <HomeMeals meals={pending as Meal[]} today={today} isParent={isParent} slots={slots} showDate />
        </Section>
      )}

      <Section title={t("expiring")} action={<Link href="/inventory" className="text-sm text-primary">→</Link>}>
        {(expiring ?? []).length === 0 ? (
          <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t("noExpiring")}</p>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {(expiring as InventoryItem[]).map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3">
                <FoodImage src={item.image_url ?? item.food?.image_url} emoji={item.food?.emoji ?? "📦"} alt={itemName(item, locale)} className="size-10" />
                <span className="min-w-0 flex-1 truncate font-medium">{itemName(item, locale)}</span>
                <ExpiryBadge expiresOn={item.expires_on} estimated={item.expiry_estimated} today={today} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {isParent && (
        <Section title={t("inviteTitle")}>
          <InviteCard />
        </Section>
      )}
    </>
  );
}
