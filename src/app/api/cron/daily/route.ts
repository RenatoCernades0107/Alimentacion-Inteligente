import { NextResponse, type NextRequest } from "next/server";
import { createTranslator } from "next-intl";
import { createAdminClient } from "@/lib/supabase/server";
import { notifyFamily } from "@/lib/push";
import { addDays, todayIn } from "@/lib/dates";
import { suggest } from "@/lib/suggestions";
import { RECIPE_SELECT } from "@/lib/recipes";
import { itemName, localName, type Family, type InventoryItem, type Recipe } from "@/lib/types";
import es from "../../../../../messages/es.json";
import en from "../../../../../messages/en.json";

/**
 * Recordatorios diarios (Vercel Cron, ver vercel.json):
 * - Alimentos que vencen en 7 días y en 1 día → todos los miembros.
 * - Día sin comidas planificadas → sugerencia a todos.
 * - Comidas pasadas sin marcar como completadas → padres.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: families } = await admin.from("families").select("*");
  const { data: recipes } = await admin.from("recipes").select(RECIPE_SELECT);
  const tr = (locale: "es" | "en") => createTranslator({ locale, messages: locale === "en" ? en : es, namespace: "push" });

  // Evita repetir la misma notificación si el cron corre más de una vez.
  async function once(key: string) {
    const { error } = await admin.from("notification_log").insert({ dedupe_key: key });
    return !error;
  }

  const summary: Record<string, number> = {};

  for (const family of (families ?? []) as Family[]) {
    const today = todayIn(family.timezone);
    let sent = 0;

    const { data: inventory } = await admin.from("inventory_items").select("*, food:foods(*)").eq("family_id", family.id);
    const items = (inventory ?? []) as InventoryItem[];

    for (const days of [7, 1]) {
      const expiring = items.filter((i) => i.expires_on === addDays(today, days) && i.quantity > 0);
      if (expiring.length && (await once(`exp:${family.id}:${today}:${days}`))) {
        sent += await notifyFamily(family.id, (locale) => ({
          title: tr(locale)("expiringTitle", { days }),
          body: tr(locale)("expiringBody", { list: expiring.map((i) => itemName(i, locale)).join(", ") }),
          url: "/inventory",
          tag: `expiring-${days}`,
        }));
      }
    }

    const { count: todayCount } = await admin
      .from("meals")
      .select("id", { count: "exact", head: true })
      .eq("family_id", family.id)
      .eq("date", today)
      .in("status", ["planned", "completed"]);

    if (!todayCount && (await once(`nomeals:${family.id}:${today}`))) {
      const top = suggest((recipes ?? []) as Recipe[], items, { mode: "any", countries: ["PE", "US"], mealType: "lunch", today })[0];
      if (top) {
        sent += await notifyFamily(family.id, (locale) => ({
          title: tr(locale)("noMealsTitle"),
          body: tr(locale)("noMealsBody", { recipe: localName(top.recipe, locale) }),
          url: `/recipes/${top.recipe.slug}`,
          tag: "no-meals",
        }));
      }
    }

    const { count: pendingCount } = await admin
      .from("meals")
      .select("id", { count: "exact", head: true })
      .eq("family_id", family.id)
      .eq("status", "planned")
      .lt("date", today)
      .gte("date", addDays(today, -3));

    if (pendingCount && (await once(`pending:${family.id}:${today}`))) {
      sent += await notifyFamily(family.id, (locale) => ({
        title: tr(locale)("pendingTitle"),
        body: tr(locale)("pendingBody", { count: pendingCount }),
        url: "/",
        tag: "pending",
      }), { role: "parent" });
    }

    summary[family.id] = sent;
  }

  return NextResponse.json({ ok: true, sent: summary });
}
