"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AvatarGrid } from "@/components/family/avatar-grid";
import { acceptInvite } from "@/app/actions/family";
import type { AvatarId } from "@/lib/avatars";

export function AcceptInviteButton({ token, label }: { token: string; label: string }) {
  const t = useTranslations("avatar");
  const [avatar, setAvatar] = useState<AvatarId | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="w-full space-y-6">
      <fieldset className="space-y-2 text-left">
        <legend className="text-sm font-medium">{t("choose")}</legend>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <AvatarGrid value={avatar} onChange={setAvatar} disabled={pending} />
      </fieldset>
      <Button
        size="lg"
        className="mx-auto h-11 w-full max-w-xs text-base"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await acceptInvite(token, avatar);
            if (res?.error) toast.error(res.error);
          })
        }
      >
        {label}
      </Button>
    </div>
  );
}
