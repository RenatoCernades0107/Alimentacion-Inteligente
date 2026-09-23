import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/dates";
import { occurrences } from "@/lib/meals";
import type { MealSeries } from "@/lib/types";

/**
 * Genera las comidas de las series recurrentes de una familia hasta `until`.
 * Usa el cliente admin porque también se ejecuta cuando un hijo abre el calendario
 * (los hijos no pueden escribir comidas planificadas).
 */
export async function materializeSeries(familyId: string, until: string) {
  const admin = createAdminClient();
  const { data: series } = await admin
    .from("meal_series")
    .select("*")
    .eq("family_id", familyId)
    .lt("materialized_until", until);

  for (const s of (series ?? []) as MealSeries[]) {
    const dates = occurrences(s, addDays(s.materialized_until, 1), until);
    if (dates.length) {
      await admin.from("meals").upsert(
        dates.map((date) => ({
          family_id: familyId,
          date,
          slot: s.slot,
          recipe_id: s.recipe_id,
          title: s.title,
          series_id: s.id,
          status: "planned",
        })),
        { onConflict: "series_id,date", ignoreDuplicates: true },
      );
    }
    await admin.from("meal_series").update({ materialized_until: until }).eq("id", s.id);
  }
}
