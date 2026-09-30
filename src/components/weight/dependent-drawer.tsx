"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { AvatarGrid } from "@/components/family/avatar-grid";
import { MemberAvatar } from "@/components/family/member-avatar";
import { addDependent, updateDependent } from "@/app/actions/body";
import { isAvatarId, type AvatarId } from "@/lib/avatars";
import { SEXES, type Sex } from "@/lib/body";
import { cn } from "@/lib/utils";

export type DependentLite = { id: string; name: string; avatar: string | null };

/**
 * Alta (sin `dependent`) o edición de nombre y avatar de un integrante sin cuenta.
 * Al crearlo se abre su ficha para completar estatura, actividad y peso.
 */
export function DependentDrawer({
  open,
  onOpenChange,
  dependent,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dependent?: DependentLite | null;
  today: string;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        {open && <Body key={dependent?.id ?? "new"} dependent={dependent ?? null} today={today} onDone={() => onOpenChange(false)} />}
      </DrawerContent>
    </Drawer>
  );
}

function Body({ dependent, today, onDone }: { dependent: DependentLite | null; today: string; onDone: () => void }) {
  const t = useTranslations("weight");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();

  const editing = !!dependent;
  const [name, setName] = useState(dependent?.name ?? "");
  const [avatar, setAvatar] = useState<AvatarId | null>(isAvatarId(dependent?.avatar) ? dependent!.avatar as AvatarId : null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [birth, setBirth] = useState("");

  const valid = name.trim().length > 0 && (editing || (!!sex && !!birth));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    start(async () => {
      try {
        if (dependent) {
          const res = await updateDependent(dependent.id, name, avatar);
          if (!res.ok) {
            toast.error(tc("error"));
            return;
          }
          toast.success(tc("saved"));
          onDone();
        } else if (sex) {
          const res = await addDependent({ name, avatar, birthDate: birth, sex });
          if (!res.ok) {
            toast.error(res.error === "invalid" ? t("invalidBirth") : tc("error"));
            return;
          }
          toast.success(t("dependentSaved"));
          onDone();
          router.push(`/weight/${res.id}`);
        }
      } catch {
        toast.error(tc("error"));
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader className="items-center pb-2">
        <MemberAvatar member={{ full_name: name || "?", avatar }} className="size-20" />
        <DrawerTitle className="mt-2 text-lg">{editing ? tc("edit") : t("dependentTitle")}</DrawerTitle>
        {!editing && <DrawerDescription>{t("dependentHint")}</DrawerDescription>}
      </DrawerHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <div className="space-y-1.5">
          <Label htmlFor="dep-name">{t("dependentName")}</Label>
          <Input id="dep-name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className="h-10" autoComplete="off" />
        </div>

        {!editing && (
          <>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t("sex")}</legend>
              <div role="radiogroup" aria-label={t("sex")} className="grid grid-cols-2 gap-2">
                {SEXES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={sex === s}
                    onClick={() => setSex(s)}
                    className={cn(
                      "h-11 rounded-lg border text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      sex === s ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                    )}
                  >
                    {s === "female" ? t("female") : t("male")}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="dep-birth">{t("birthDate")}</Label>
              <Input id="dep-birth" type="date" required value={birth} min="1900-01-01" max={today} onChange={(e) => setBirth(e.target.value)} className="h-10" />
            </div>
          </>
        )}

        <AvatarGrid value={avatar} onChange={setAvatar} disabled={pending} />
      </div>

      <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button type="submit" size="lg" className="h-11 w-full text-base" disabled={pending || !valid}>
          {tc("save")}
        </Button>
      </DrawerFooter>
    </form>
  );
}
