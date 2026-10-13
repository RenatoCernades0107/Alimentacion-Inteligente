import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/session";
import { materializeSeries } from "@/lib/calendar";
import { addDays, isValidDate, startOfWeek, todayIn } from "@/lib/dates";
import { slotsFor } from "@/lib/meals";
import { loadMyTarget } from "@/lib/my-target";
import { MemberAvatar } from "@/components/family/member-avatar";
import { CalendarView } from "@/components/meals/calendar-view";
import { DownloadPlan } from "@/components/meals/download-plan";
import { HomeAlerts } from "@/components/home/home-alerts";
import type { InventoryItem, Meal } from "@/lib/types";
import type { RecipeOption } from "@/components/meals/meal-drawer";

/** Inicio: el calendario de la semana, con los avisos del día (propuestas, pendientes, por vencer) arriba. */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { date: dateParam } = await searchParams;
  const { supabase, family, profile, isParent, user } = await requireMember();
  const t = await getTranslations("home");

  const today = todayIn(family.timezone);
  const date = isValidDate(dateParam) ? dateParam : today;
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);

  await materializeSeries(family.id, weekEnd > addDays(today, 14) ? weekEnd : addDays(today, 14));

  const mealSelect = "*, recipe:recipes(id, slug, name_es, name_en, emoji, image_url, servings, kcal_per_serving, kcal_complete), series:meal_series(recurrence), proposer:profiles!meals_proposed_by_fkey(full_name)";
  const [{ data: meals }, { data: recipes }, { data: nearby }, { data: proposals }, { data: pending }, { data: expiring }, myTarget] = await Promise.all([
    supabase.from("meals").select(mealSelect).eq("family_id", family.id).gte("date", weekStart).lte("date", weekEnd).neq("status", "cancelled").order("created_at"),
    supabase.from("recipes").select("id, slug, name_es, name_en, emoji, image_url, meal_types, country, family_id").order("name_es"),
    // Días con comidas alrededor de la semana, para marcarlos en el selector de mes.
    supabase.from("meals").select("date").eq("family_id", family.id).gte("date", addDays(weekStart, -42)).lte("date", addDays(weekEnd, 42)).neq("status", "cancelled"),
    isParent
      ? supabase.from("meals").select(mealSelect).eq("family_id", family.id).eq("status", "proposed").gte("date", today).order("date")
      : Promise.resolve({ data: [] }),
    isParent
      ? supabase.from("meals").select(mealSelect).eq("family_id", family.id).eq("status", "planned").lt("date", today).gte("date", addDays(today, -7)).order("date")
      : Promise.resolve({ data: [] }),
    supabase.from("inventory_items").select("*, food:foods(*)").eq("family_id", family.id).not("expires_on", "is", null).lte("expires_on", addDays(today, 7)).order("expires_on"),
    // Solo los datos propios (RLS): la barra de progreso muestra la meta de quien mira.
    loadMyTarget(supabase, user.id, family.timezone),
  ]);

  const mealDates = [...new Set((nearby ?? []).map((m) => m.date as string))];
  const slots = slotsFor(family.meals_per_day);
  const firstName = profile.full_name?.split(" ")[0] ?? "";

  return (
    <>
      <header className="flex items-center gap-3 pt-4 pb-3">
        <Link href="/weight" aria-label={t("profile")} className="shrink-0 rounded-full">
          <MemberAvatar member={profile} className="size-10" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{family.name}</p>
          <h1 className="truncate text-xl font-bold tracking-tight">{t("hello", { name: firstName })} 👋</h1>
        </div>
        <DownloadPlan today={today} date={date} weekStart={weekStart} mealDates={mealDates} />
      </header>

      <HomeAlerts
        today={today}
        isParent={isParent}
        slots={slots}
        mealsPerDay={family.meals_per_day}
        myKcal={myTarget.kcal}
        needsBody={isParent && myTarget.state === "incomplete"}
        proposals={(proposals ?? []) as Meal[]}
        pending={(pending ?? []) as Meal[]}
        expiring={(expiring ?? []) as InventoryItem[]}
      />

      <CalendarView
        date={date}
        today={today}
        weekStart={weekStart}
        meals={(meals ?? []) as Meal[]}
        mealDates={mealDates}
        recipes={(recipes ?? []) as RecipeOption[]}
        slots={slots}
        isParent={isParent}
        mealsPerDay={family.meals_per_day}
        myKcal={myTarget.kcal}
        myState={myTarget.state}
        canEditData={myTarget.canEdit}
      />
    </>
  );
}
