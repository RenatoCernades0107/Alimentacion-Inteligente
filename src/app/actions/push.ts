"use server";

import { requireMember } from "@/lib/session";
import { sendToUsers } from "@/lib/push";
import { getTranslations } from "next-intl/server";

type SerializedSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function subscribePush(sub: SerializedSubscription) {
  const { supabase, user } = await requireMember();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

export async function unsubscribePush(endpoint: string) {
  const { supabase } = await requireMember();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function sendTestPush() {
  const { user } = await requireMember();
  const t = await getTranslations("push");
  return sendToUsers([user.id], { title: t("testTitle"), body: t("testBody"), url: "/" });
}
