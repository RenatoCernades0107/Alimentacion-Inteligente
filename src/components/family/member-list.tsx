"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight, Pencil, UserMinus, UserPlus } from "lucide-react";
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
import { DependentDrawer } from "@/components/weight/dependent-drawer";
import { removeMember } from "@/app/actions/family";
import type { Dependent, Profile } from "@/lib/types";

/** Nombre + detalle de una fila; es un enlace a la ficha de peso cuando el usuario puede abrirla. */
function MemberInfo({
  href,
  name,
  sub,
  incompleteLabel,
  openLabel,
}: {
  href?: string;
  name: React.ReactNode;
  sub: string;
  /** Texto de "datos por completar"; vacío si no aplica. */
  incompleteLabel: string;
  openLabel: string;
}) {
  const body = (
    <>
      <div className="truncate font-medium">{name}</div>
      <div className="truncate text-sm text-muted-foreground">
        {sub}
        {href && incompleteLabel && <span className="text-amber-700 dark:text-amber-400"> · {incompleteLabel}</span>}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="flex min-w-0 flex-1 items-center gap-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={openLabel}>
      <div className="min-w-0 flex-1">{body}</div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  ) : (
    <div className="min-w-0 flex-1">{body}</div>
  );
}

export function MemberList({
  members,
  dependents,
  currentUserId,
  isParent,
  links,
  incomplete,
  today,
}: {
  members: Profile[];
  /** Integrantes sin cuenta (bebés, niños). */
  dependents: Pick<Dependent, "id" | "name" | "avatar">[];
  currentUserId: string;
  isParent: boolean;
  /** id → ficha de peso, solo para quienes el usuario puede abrir. */
  links: Record<string, string>;
  /** ids con datos por completar. */
  incomplete: string[];
  today: string;
}) {
  const t = useTranslations("family");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const tv = useTranslations("avatar");
  const tw = useTranslations("weight");
  const [toRemove, setToRemove] = useState<Profile | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  // Cada uno cambia su avatar; los padres también el de sus hijos.
  const canEditAvatar = (m: Profile) => m.id === currentUserId || (isParent && m.role === "child");
  const [pending, start] = useTransition();
  const pendingData = new Set(incomplete);

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
            <MemberInfo
              href={links[m.id]}
              name={
                <>
                  {m.full_name} {m.id === currentUserId && <span className="font-normal text-muted-foreground">({t("you")})</span>}
                </>
              }
              sub={m.role === "parent" ? tr("parentTitle") : tr("childTitle")}
              incompleteLabel={pendingData.has(m.id) ? tw("dataIncompleteTitle") : ""}
              openLabel={tw("memberOpen", { name: m.full_name ?? "" })}
            />
            {isParent && m.id !== currentUserId && (
              <Button variant="ghost" size="icon" onClick={() => setToRemove(m)} aria-label={t("remove")}>
                <UserMinus />
              </Button>
            )}
          </li>
        ))}

        {dependents.map((d) => (
          <li key={d.id} className="flex items-center gap-3 p-3">
            <MemberAvatar member={{ full_name: d.name, avatar: d.avatar }} />
            <MemberInfo
              href={links[d.id]}
              name={d.name}
              sub={tw("dependentTag")}
              incompleteLabel={pendingData.has(d.id) ? tw("dataIncompleteTitle") : ""}
              openLabel={tw("memberOpen", { name: d.name })}
            />
          </li>
        ))}
      </ul>

      {isParent && (
        <Button variant="outline" className="mt-3 h-10 w-full" onClick={() => setAddOpen(true)}>
          <UserPlus /> {tw("dependentAdd")}
        </Button>
      )}

      <AvatarPicker member={editing} isSelf={editing?.id === currentUserId} open={pickerOpen} onOpenChange={setPickerOpen} />
      <DependentDrawer open={addOpen} onOpenChange={setAddOpen} today={today} />

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
