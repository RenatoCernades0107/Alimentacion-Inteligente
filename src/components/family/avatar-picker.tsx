"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { AvatarGrid } from "@/components/family/avatar-grid";
import { MemberAvatar } from "@/components/family/member-avatar";
import { setMemberAvatar } from "@/app/actions/family";
import { isAvatarId, type AvatarId } from "@/lib/avatars";
import type { Profile } from "@/lib/types";

type Member = Pick<Profile, "id" | "full_name" | "avatar" | "avatar_url">;

/** Drawer para elegir el avatar de un miembro (el propio o el de un hijo). */
export function AvatarPicker({
  member,
  isSelf,
  open,
  onOpenChange,
}: {
  member: Member | null;
  isSelf: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        {member && (
          // key: reinicia la selección al cambiar de miembro
          <PickerBody key={member.id} member={member} isSelf={isSelf} onDone={() => onOpenChange(false)} />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function PickerBody({ member, isSelf, onDone }: { member: Member; isSelf: boolean; onDone: () => void }) {
  const t = useTranslations("avatar");
  const tc = useTranslations("common");
  const [selected, setSelected] = useState<AvatarId | null>(isAvatarId(member.avatar) ? member.avatar : null);
  const [pending, start] = useTransition();

  const save = (avatar: AvatarId | null) =>
    start(async () => {
      try {
        await setMemberAvatar(member.id, avatar);
        toast.success(tc("saved"));
        onDone();
      } catch {
        toast.error(tc("error"));
      }
    });

  return (
    <>
      <DrawerHeader className="items-center pb-2">
        <MemberAvatar member={{ ...member, avatar: selected }} className="size-20" />
        <DrawerTitle className="mt-2 text-lg">
          {isSelf ? t("titleSelf") : t("titleOther", { name: member.full_name ?? "" })}
        </DrawerTitle>
        <DrawerDescription>{t("subtitle")}</DrawerDescription>
      </DrawerHeader>
      <div className="flex-1 overflow-y-auto p-4">
        <AvatarGrid value={selected} onChange={setSelected} disabled={pending} />
      </div>
      <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button size="lg" className="h-11 w-full text-base" disabled={pending || !selected} onClick={() => save(selected)}>
          {tc("save")}
        </Button>
        {member.avatar && (
          <Button variant="ghost" className="w-full" disabled={pending} onClick={() => save(null)}>
            {t("reset")}
          </Button>
        )}
      </DrawerFooter>
    </>
  );
}
