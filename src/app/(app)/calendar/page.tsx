import { getTranslations } from "next-intl/server";
import { requireMember } from "@/lib/session";
import { materializeSeries } from "@/lib/calendar";
import { addDays, isValidDate, startOfWeek, todayIn } from "@/lib/dates";
import { slotsFor } from "@/lib/meals";
import { PageHeader } from "@/components/page-header";
import { CalendarView } from "@/components/meals/calendar-view";
import type { Meal } from "@/lib/types";
import type { RecipeOption } from "@/components/meals/meal-drawer";

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const { date: dateParam } = await searchParams;
  const { supabase, family, isParent } = await requireMember();
  const t = await getTranslations("calendar");

  const today = todayIn(family.timezone);
  const date = isValidDate(dateParam) ? dateParam : today;
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);

  await materializeSeries(family.id, weekEnd > addDays(today, 14) ? weekEnd : addDays(today, 14));

  const [{ data: meals }, { data: recipes }, { data: nearby }] = await Promise.all([
    supabase
      .from("meals")
      .select("*, recipe:recipes(id, slug, name_es, name_en, emoji, image_url), series:meal_series(recurrence), proposer:profiles!meals_proposed_by_fkey(full_name)")
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
  ]);

  return (
    <>
      <PageHeader title={t("title")} />
      <CalendarView
        date={date}
        today={today}
        weekStart={weekStart}
        meals={(meals ?? []) as Meal[]}
        mealDates={[...new Set((nearby ?? []).map((m) => m.date as string))]}
        recipes={(recipes ?? []) as RecipeOption[]}
        slots={slotsFor(family.meals_per_day)}
        isParent={isParent}
      />
    </>
  );
}
