import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

let configured = false;
function configure() {
  if (configured) return true;
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject || "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

/** Envía una notificación a todos los dispositivos de los usuarios indicados. */
export async function sendToUsers(userIds: string[], payload: PushPayload) {
  if (!userIds.length || !configure()) return 0;
  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("*").in("user_id", userIds);

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // Suscripción vencida o revocada: se elimina.
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      }
    }),
  );
  return sent;
}

/** Miembros de una familia (opcionalmente filtrados por rol) con su idioma. */
export async function familyMembers(familyId: string, role?: Role) {
  const admin = createAdminClient();
  let query = admin.from("profiles").select("id, locale, role").eq("family_id", familyId);
  if (role) query = query.eq("role", role);
  const { data } = await query;
  return data ?? [];
}

/**
 * Envía a cada miembro el mensaje en su idioma.
 * `build` recibe el locale y devuelve el payload.
 */
export async function notifyFamily(
  familyId: string,
  build: (locale: "es" | "en") => PushPayload,
  opts: { role?: Role; exclude?: string } = {},
) {
  const members = (await familyMembers(familyId, opts.role)).filter((m) => m.id !== opts.exclude);
  let sent = 0;
  for (const locale of ["es", "en"] as const) {
    const ids = members.filter((m) => (m.locale ?? "es") === locale).map((m) => m.id);
    sent += await sendToUsers(ids, build(locale));
  }
  return sent;
}
