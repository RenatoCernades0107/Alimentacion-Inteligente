import { NextResponse, type NextRequest } from "next/server";
import { createTranslator } from "next-intl";
import { createAdminClient } from "@/lib/supabase/server";
import { notifyFamily, sendToUsers } from "@/lib/push";
import { weighReminders, type ReminderBody } from "@/lib/reminders";
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
 * - Pesarse: adultos con meta (semanal); menores y sin cuenta, a los padres (mensual, con calma).
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

  /** Recordatorios para pesarse (ver src/lib/reminders.ts para las reglas). Devuelve cuántos push se enviaron. */
  async function sendWeighReminders(family: Family, today: string) {
    const [{ data: people }, { data: kids }] = await Promise.all([
      admin.from("profiles").select("id, full_name, locale").eq("family_id", family.id),
      admin.from("dependents").select("id, name").eq("family_id", family.id),
    ]);
    const profiles = (people ?? []) as { id: string; full_name: string | null; locale: "es" | "en" | null }[];
    const dependents = (kids ?? []) as { id: string; name: string }[];
    if (!profiles.length) return 0;

    const [{ data: byProfile }, { data: byDependent }] = await Promise.all([
      admin.from("body_profiles").select("id, profile_id, dependent_id, birth_date, goal_weight_kg").in("profile_id", profiles.map((p) => p.id)),
      dependents.length
        ? admin.from("body_profiles").select("id, profile_id, dependent_id, birth_date, goal_weight_kg").in("dependent_id", dependents.map((d) => d.id))
        : Promise.resolve({ data: [] }),
    ]);
    const rows = [...(byProfile ?? []), ...(byDependent ?? [])] as {
      id: string; profile_id: string | null; dependent_id: string | null; birth_date: string | null; goal_weight_kg: number | null;
    }[];
    if (!rows.length) return 0;

    // Último pesaje de cada ficha (con 4 meses alcanza: pasado ese plazo ya toca avisar).
    const { data: logs } = await admin
      .from("weight_logs")
      .select("body_id, logged_on")
      .in("body_id", rows.map((r) => r.id))
      .gte("logged_on", addDays(today, -120));
    const lastLog: Record<string, string> = {};
    for (const l of (logs ?? []) as { body_id: string; logged_on: string }[]) {
      if (!lastLog[l.body_id] || l.logged_on > lastLog[l.body_id]) lastLog[l.body_id] = l.logged_on;
    }

    const bodies: ReminderBody[] = rows.map((r) => ({
      id: r.id, profileId: r.profile_id, dependentId: r.dependent_id, birthDate: r.birth_date,
      goalKg: r.goal_weight_kg != null ? Number(r.goal_weight_kg) : null,
    }));
    const nameOf = new Map<string, string>([
      ...profiles.map((p) => [p.id, (p.full_name ?? "").split(" ")[0]] as [string, string]),
      ...dependents.map((d) => [d.id, d.name] as [string, string]),
    ]);

    let sent = 0;
    for (const r of weighReminders({ today, bodies, lastLog })) {
      if (!(await once(r.key))) continue;
      if (r.kind === "self") {
        const locale = profiles.find((p) => p.id === r.profileId)?.locale ?? "es";
        sent += await sendToUsers([r.profileId], {
          title: tr(locale)("weighTitle"), body: tr(locale)("weighBody"), url: "/weight", tag: "weigh",
        });
      } else {
        const name = nameOf.get(r.personId) ?? "";
        sent += await notifyFamily(family.id, (locale) => ({
          title: tr(locale)("weighKidTitle", { name }), body: tr(locale)("weighKidBody"), url: `/weight/${r.personId}`, tag: `weigh-${r.personId}`,
        }), { role: "parent" });
      }
    }
    return sent;
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

    sent += await sendWeighReminders(family, today);

    summary[family.id] = sent;
  }

  return NextResponse.json({ ok: true, sent: summary });
}
