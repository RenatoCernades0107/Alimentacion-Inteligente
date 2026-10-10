import { getLocale } from "next-intl/server";
import { requireMember } from "@/lib/session";
import { isValidDate, todayIn } from "@/lib/dates";
import { slotsFor } from "@/lib/meals";
import { loadMyTarget } from "@/lib/my-target";
import { loadChefData } from "@/lib/chef-data";
import { defaultGoal } from "@/lib/chef";
import { ChefView } from "@/components/chef/chef-view";

/** Chef IA: arma el plan de comidas conversando con Gemini y eligiendo platos. */
export default async function ChefPage({ searchParams }: PageProps<"/chef">) {
  const { date, use } = await searchParams;
  const { supabase, family, profile, isParent, user } = await requireMember();
  const locale = await getLocale();
  const today = todayIn(family.timezone);
  const start = isValidDate(date) && date > today ? date : today;

  const [{ cards, busy }, target] = await Promise.all([
    loadChefData(supabase, family.id, today, locale),
    loadMyTarget(supabase, user.id, family.timezone),
  ]);
  const minor = !!target.minor;

  return (
    <ChefView
      userId={user.id}
      firstName={profile.full_name?.split(" ")[0] ?? ""}
      today={today}
      start={start}
      cards={cards}
      busy={[...busy.entries()]}
      slots={slotsFor(family.meals_per_day)}
      mealsPerDay={family.meals_per_day}
      myKcal={target.kcal}
      minor={minor}
      isParent={isParent}
      initialGoal={defaultGoal(target.direction, minor)}
      useExpiring={use === "expiring"}
    />
  );
}
