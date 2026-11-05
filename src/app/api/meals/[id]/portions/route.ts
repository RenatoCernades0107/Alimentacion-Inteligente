import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { loadMealItems } from "@/lib/meal-items";
import { loadFamilyTargets } from "@/lib/family-targets";
import { kcalPerServing, macrosPerServing, type Macros } from "@/lib/nutrition";
import { buildPortions, type PortionsData } from "@/lib/portions";
import { loadPrices, recipeCost } from "@/lib/cost";
import { STORES } from "@/lib/stores";
import type { MealSlot } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tabla de porciones de una comida: cuánto le corresponde a cada integrante según su meta diaria.
 * Se pide al abrir la comida (no en cada carga de Inicio/Calendario) y devuelve solo datos derivados.
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/meals/[id]/portions">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const session = await getSession();
  if (!session?.family || !session.profile.role) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { supabase, user, family, profile } = session;

  // El cliente con RLS del usuario garantiza que la comida es de su familia.
  const { data } = await supabase
    .from("meals")
    .select("id, date, slot, portion_scale, kcal_per_serving, recipe:recipes(servings)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  const meal = data as unknown as {
    id: string;
    date: string;
    slot: MealSlot;
    portion_scale: number;
    kcal_per_serving: number | null;
    recipe: { servings: number } | null;
  };

  let perServing: number | null = null;
  let complete = true;
  let optionalKcal = 0;
  let macros: Macros | null = null;
  let cost: PortionsData["cost"] = null;
  if (meal.recipe) {
    // Con los ingredientes efectivos de la comida (los editados, si los hay).
    const store = family.store ?? "plazavea";
    const [{ items }, prices] = await Promise.all([loadMealItems(supabase, meal.id), loadPrices(supabase, store)]);
    if (prices.size) {
      const c = recipeCost(items, prices, meal.recipe.servings);
      if (c.total > 0) cost = { recipeTotal: c.total, perServing: c.perServing, complete: c.complete, store: STORES[store].name };
    }
    const r = kcalPerServing(items, meal.recipe.servings);
    perServing = r.kcal;
    complete = r.complete;
    optionalKcal = r.optionalKcal;
    // Sin el dato de algún obligatorio (alimentos propios) los macros quedarían cortos: mejor no mostrarlos.
    const m = macrosPerServing(items, meal.recipe.servings);
    if (m.complete) macros = { protein: m.protein, carbs: m.carbs, fat: m.fat };
  } else {
    perServing = meal.kcal_per_serving;
  }

  // La franja se reparte entre las comidas planificadas ese día (una sopa y un segundo, por ejemplo).
  const { count: others } = await supabase
    .from("meals")
    .select("id", { count: "exact", head: true })
    .eq("family_id", family.id)
    .eq("date", meal.date)
    .eq("slot", meal.slot)
    .neq("id", meal.id)
    .in("status", ["planned", "completed"]);

  const targets = await loadFamilyTargets({ supabase, userId: user.id, isParent: profile.role === "parent", family });
  const portions = buildPortions({
    targets,
    kcalPerServing: perServing,
    complete,
    optionalKcal,
    macrosPerServing: macros,
    slot: meal.slot,
    mealsPerDay: family.meals_per_day,
    recipeServings: meal.recipe?.servings ?? null,
    scale: Number(meal.portion_scale) || 1,
    siblings: 1 + (others ?? 0),
  });
  return NextResponse.json({ ...portions, cost } satisfies PortionsData, { headers: { "Cache-Control": "no-store" } });
}
