"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Pencil, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MemberAvatar } from "@/components/family/member-avatar";
import { AvatarPicker } from "@/components/family/avatar-picker";
import { removeMember } from "@/app/actions/family";
import type { Profile } from "@/lib/types";

export function MemberList({ members, currentUserId, isParent }: { members: Profile[]; currentUserId: string; isParent: boolean }) {
  const t = useTranslations("family");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const tv = useTranslations("avatar");
  const [toRemove, setToRemove] = useState<Profile | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Cada uno cambia su avatar; los padres también el de sus hijos.
  const canEditAvatar = (m: Profile) => m.id === currentUserId || (isParent && m.role === "child");
  const [pending, start] = useTransition();

  return (
    <>
      <ul className="divide-y rounded-2xl border bg-card">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 p-3">
            {canEditAvatar(m) ? (
              <button
                type="button"
                className="relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => {
                  setEditing(m);
                  setPickerOpen(true);
                }}
                aria-label={m.id === currentUserId ? tv("changeSelf") : tv("changeOther", { name: m.full_name ?? "" })}
              >
                <MemberAvatar member={m} />
                <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
                  <Pencil className="size-2.5" />
                </span>
              </button>
            ) : (
              <MemberAvatar member={m} />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {m.full_name} {m.id === currentUserId && <span className="text-muted-foreground">({t("you")})</span>}
              </div>
              <div className="text-sm text-muted-foreground">{m.role === "parent" ? tr("parentTitle") : tr("childTitle")}</div>
            </div>
            {isParent && m.id !== currentUserId && (
              <Button variant="ghost" size="icon" onClick={() => setToRemove(m)} aria-label={t("remove")}>
                <UserMinus />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <AvatarPicker member={editing} isSelf={editing?.id === currentUserId} open={pickerOpen} onOpenChange={setPickerOpen} />

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
