"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DependentDrawer, type DependentLite } from "@/components/weight/dependent-drawer";
import { removeDependent } from "@/app/actions/body";

/** Editar o eliminar a un integrante sin cuenta (solo padres). */
export function DependentActions({ dependent, today }: { dependent: DependentLite; today: string }) {
  const t = useTranslations("weight");
  const tc = useTranslations("common");
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-2">
      <Button variant="outline" className="h-10 flex-1" onClick={() => setEditOpen(true)}>
        <Pencil /> {tc("edit")}
      </Button>
      <Button variant="outline" className="h-10 flex-1 text-destructive" onClick={() => setConfirmOpen(true)}>
        <Trash2 /> {t("dependentRemove")}
      </Button>

      <DependentDrawer open={editOpen} onOpenChange={setEditOpen} dependent={dependent} today={today} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dependentRemoveConfirm", { name: dependent.name })}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    await removeDependent(dependent.id);
                    router.push("/family");
                  } catch {
                    toast.error(tc("error"));
                  }
                })
              }
            >
              {t("dependentRemove")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
