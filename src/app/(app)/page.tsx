import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Scale } from "lucide-react";
import { requireMember } from "@/lib/session";
import { materializeSeries } from "@/lib/calendar";
import { addDays, todayIn } from "@/lib/dates";
import { slotsFor } from "@/lib/meals";
import { suggest } from "@/lib/suggestions";
import { loadRecipesAndInventory } from "@/lib/recipes";
import { Section } from "@/components/page-header";
import { FoodImage } from "@/components/food-image";
import { RecipeImage } from "@/components/recipe-image";
import { ExpiryBadge } from "@/components/inventory/expiry-badge";
import { InviteCard } from "@/components/family/invite-card";
import { PushCard } from "@/components/family/push-card";
import { MemberAvatar } from "@/components/family/member-avatar";
import { HomeMeals } from "@/components/meals/home-meals";
import { itemName, localName, type InventoryItem, type Meal } from "@/lib/types";

export default async function HomePage() {
  const { supabase, family, profile, isParent } = await requireMember();
  const t = await getTranslations("home");
  const tw = await getTranslations("weight");
  const locale = await getLocale();
  const today = todayIn(family.timezone);

  await materializeSeries(family.id, addDays(today, 14));

  const mealSelect = "*, recipe:recipes(id, slug, name_es, name_en, emoji, image_url, servings, kcal_per_serving, kcal_complete), series:meal_series(recurrence), proposer:profiles!meals_proposed_by_fkey(full_name)";
  const [{ data: todayMeals }, { data: proposals }, { data: pending }, { data: expiring }, { recipes, inventory }, { data: myBody }] = await Promise.all([
    supabase.from("meals").select(mealSelect).eq("family_id", family.id).eq("date", today).neq("status", "cancelled"),
    isParent
      ? supabase.from("meals").select(mealSelect).eq("family_id", family.id).eq("status", "proposed").gte("date", today).order("date")
      : Promise.resolve({ data: [] }),
    isParent
      ? supabase.from("meals").select(mealSelect).eq("family_id", family.id).eq("status", "planned").lt("date", today).gte("date", addDays(today, -7)).order("date")
      : Promise.resolve({ data: [] }),
    supabase.from("inventory_items").select("*, food:foods(*)").eq("family_id", family.id).not("expires_on", "is", null).lte("expires_on", addDays(today, 7)).order("expires_on"),
    loadRecipesAndInventory(supabase, family.id),
    // Datos corporales propios (RLS): para invitar a completarlos.
    isParent
      ? supabase.from("body_profiles").select("id, sex, birth_date, height_cm").eq("profile_id", profile.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const { count: myLogs } = myBody
    ? await supabase.from("weight_logs").select("id", { count: "exact", head: true }).eq("body_id", myBody.id)
    : { count: 0 };
  const needsBody = isParent && (!myBody || !myBody.sex || !myBody.birth_date || !myBody.height_cm || !myLogs);

  const slots = slotsFor(family.meals_per_day);
  const suggestions = (todayMeals ?? []).length === 0
    ? suggest(recipes, inventory, { mode: "any", countries: ["PE", "US"], mealType: "lunch", today }).slice(0, 3)
    : [];
  const firstName = profile.full_name?.split(" ")[0] ?? "";

  return (
    <>
      <header className="flex items-center gap-3 pt-4 pb-1">
        <Link href="/weight" aria-label={t("profile")} className="shrink-0 rounded-full">
          <MemberAvatar member={profile} className="size-12" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{family.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">{t("hello", { name: firstName })} 👋</h1>
        </div>
      </header>

      <PushCard compact />

      {needsBody && (
        <Link href="/weight" className="mt-3 flex items-center gap-3 rounded-2xl border bg-card p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Scale className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{tw("cardTitle")}</span>
            <span className="block text-sm text-muted-foreground">{tw("cardBody")}</span>
          </span>
          <span className="shrink-0 text-sm font-medium text-primary">{tw("cardAction")} →</span>
        </Link>
      )}

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
                    <RecipeImage src={recipe.image_url} emoji={recipe.emoji} />
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
