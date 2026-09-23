"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/app/actions/family";

export function AcceptInviteButton({ token, label }: { token: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      className="h-11 w-full max-w-xs text-base"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await acceptInvite(token);
          if (res?.error) toast.error(res.error);
        })
      }
    >
      {label}
    </Button>
  );
}
