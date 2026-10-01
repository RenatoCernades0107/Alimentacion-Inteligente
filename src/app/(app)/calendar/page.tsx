import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/session";
import { materializeSeries } from "@/lib/calendar";
import { addDays, isValidDate, startOfWeek, todayIn } from "@/lib/dates";
import { slotsFor } from "@/lib/meals";
import { loadMyTarget } from "@/lib/my-target";
import { PageHeader } from "@/components/page-header";
import { CalendarView } from "@/components/meals/calendar-view";
import { DownloadPlan } from "@/components/meals/download-plan";
import type { Meal } from "@/lib/types";
import type { RecipeOption } from "@/components/meals/meal-drawer";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { date: dateParam } = await searchParams;
  const { supabase, family, isParent, user } = await requireMember();
  const t = await getTranslations("calendar");

  const today = todayIn(family.timezone);
  const date = isValidDate(dateParam) ? dateParam : today;
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);

  await materializeSeries(family.id, weekEnd > addDays(today, 14) ? weekEnd : addDays(today, 14));

  const [{ data: meals }, { data: recipes }, { data: nearby }, myTarget] = await Promise.all([
    supabase
      .from("meals")
      .select("*, recipe:recipes(id, slug, name_es, name_en, emoji, image_url, servings, kcal_per_serving, kcal_complete), series:meal_series(recurrence), proposer:profiles!meals_proposed_by_fkey(full_name)")
      .eq("family_id", family.id)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .neq("status", "cancelled")
      .order("created_at"),
    supabase.from("recipes").select("id, slug, name_es, name_en, emoji, image_url, meal_types, country").order("name_es"),
    // Días con comidas alrededor de la semana, para marcarlos en el selector de mes.
    supabase
      .from("meals")
      .select("date")
      .eq("family_id", family.id)
      .gte("date", addDays(weekStart, -42))
      .lte("date", addDays(weekEnd, 42))
      .neq("status", "cancelled"),
    // Solo los datos propios (RLS): la barra de progreso muestra la meta de quien mira.
    loadMyTarget(supabase, user.id, family.timezone),
  ]);

  const mealDates = [...new Set((nearby ?? []).map((m) => m.date as string))];

  return (
    <>
      <PageHeader title={t("title")} action={<DownloadPlan today={today} date={date} weekStart={weekStart} mealDates={mealDates} />} />
      <CalendarView
        date={date}
        today={today}
        weekStart={weekStart}
        meals={(meals ?? []) as Meal[]}
        mealDates={mealDates}
        recipes={(recipes ?? []) as RecipeOption[]}
        slots={slotsFor(family.meals_per_day)}
        isParent={isParent}
        mealsPerDay={family.meals_per_day}
        myKcal={myTarget.kcal}
        myState={myTarget.state}
        canEditData={myTarget.canEdit}
      />
    </>
  );
}
