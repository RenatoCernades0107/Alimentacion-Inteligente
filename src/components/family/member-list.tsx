"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { UserMinus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { removeMember } from "@/app/actions/family";
import type { Profile } from "@/lib/types";

export function MemberList({ members, currentUserId, canRemove }: { members: Profile[]; currentUserId: string; canRemove: boolean }) {
  const t = useTranslations("family");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const [toRemove, setToRemove] = useState<Profile | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <ul className="divide-y rounded-2xl border bg-card">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 p-3">
            <Avatar className="size-10">
              {m.avatar_url && <AvatarImage src={m.avatar_url} alt="" />}
              <AvatarFallback>{(m.full_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {m.full_name} {m.id === currentUserId && <span className="text-muted-foreground">({t("you")})</span>}
              </div>
              <div className="text-sm text-muted-foreground">{m.role === "parent" ? tr("parentTitle") : tr("childTitle")}</div>
            </div>
            {canRemove && m.id !== currentUserId && (
              <Button variant="ghost" size="icon" onClick={() => setToRemove(m)} aria-label={t("remove")}>
                <UserMinus />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeConfirm", { name: toRemove?.full_name ?? "" })}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (toRemove) await removeMember(toRemove.id);
                  setToRemove(null);
                })
              }
            >
              {t("remove")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
