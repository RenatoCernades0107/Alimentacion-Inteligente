import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ensureDishImage } from "@/lib/dish-image";
import { localName } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La generación de una foto tarda unos segundos. */
export const maxDuration = 60;

/**
 * Foto del plato de una receta; la genera con IA la primera vez que alguien la pide (POST porque
 * puede escribir). Responde `{ url }` (null si no se pudo).
 */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/recipes/[id]/image">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const session = await getSession();
  if (!session?.family || !session.profile.role) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS: solo recetas del catálogo o de la propia familia.
  const { data: recipe } = await session.supabase
    .from("recipes")
    .select("id, image_url, recipe_ingredients(optional, food:foods(name_es, name_en))")
    .eq("id", id)
    .maybeSingle();
  if (!recipe) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (recipe.image_url) return NextResponse.json({ url: recipe.image_url });

  const rows = (recipe.recipe_ingredients ?? []) as unknown as { optional: boolean; food: { name_es: string; name_en: string } | null }[];
  const names = rows.filter((r) => !r.optional && r.food).map((r) => localName(r.food!, "es"));
  return NextResponse.json({ url: await ensureDishImage(id, names) });
}
