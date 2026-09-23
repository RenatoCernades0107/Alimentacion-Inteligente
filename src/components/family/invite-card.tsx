"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInviteLink } from "@/app/actions/family";
import type { Role } from "@/lib/types";

type Link = { token: string; expiresAt: string };

/** Links de invitación de un solo uso (uno para padres y otro para hijos). */
export function InviteCard() {
  const t = useTranslations("invite");
  const [links, setLinks] = useState<Partial<Record<Role, Link>>>({});

  useEffect(() => {
    Promise.all([getInviteLink("parent"), getInviteLink("child")])
      .then(([parent, child]) => setLinks({ parent, child }))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{t("cardSubtitle")}</p>
      <InviteRow role="parent" label={`👨‍👩 ${t("parentsLink")}`} link={links.parent} />
      <InviteRow role="child" label={`🧒 ${t("childrenLink")}`} link={links.child} />
    </div>
  );
}

function InviteRow({ label, link }: { role: Role; label: string; link?: Link }) {
  const t = useTranslations("invite");
  const locale = useLocale();
  const url = link ? `${typeof location !== "undefined" ? location.origin : ""}/invite/${link.token}` : "";
  const expires = link ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(link.expiresAt)) : "";

  async function share() {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: t("shareText"), text: t("shareText"), url });
      } catch {
        // El usuario canceló.
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success(t("copied"));
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{label}</div>
        <div className="truncate text-xs text-muted-foreground">{link ? `${url.replace(/^https?:\/\//, "")} · ${t("expires", { date: expires })}` : "…"}</div>
      </div>
      <Button variant="outline" onClick={share} disabled={!link}>
        <Share2 /> {t("share")}
      </Button>
    </div>
  );
}
