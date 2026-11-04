import { getLocale } from "next-intl/server";
import { requireMember } from "@/lib/session";
import { isValidDate, todayIn } from "@/lib/dates";
import { slotsFor } from "@/lib/meals";
import { loadMyTarget } from "@/lib/my-target";
import { loadChefData } from "@/lib/chef-data";
import { loadDraftList } from "@/lib/chef-drafts";
import { defaultGoal } from "@/lib/chef";
import { ChefView } from "@/components/chef/chef-view";

/** Pasar el plan al calendario (con recetas nuevas) corre como server action de esta ruta: se le da margen. El turno del Chef va por /api/chef. */
export const maxDuration = 90;

/** Chef IA: chat para armar planes de comidas, guardados como borradores. */
export default async function ChefPage({ searchParams }: PageProps<"/chef">) {
  const { date, use, draft } = await searchParams;
  const { supabase, family, profile, isParent, user } = await requireMember();
  const locale = await getLocale();
  const today = todayIn(family.timezone);
  const start = isValidDate(date) && date > today ? date : today;

  const [{ cards, busy }, target, drafts] = await Promise.all([
    loadChefData(supabase, family.id, today, locale),
    loadMyTarget(supabase, user.id, family.timezone),
    loadDraftList(supabase),
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
      drafts={drafts}
      openId={typeof draft === "string" && /^[0-9a-f-]{36}$/i.test(draft) ? draft : null}
    />
  );
}
