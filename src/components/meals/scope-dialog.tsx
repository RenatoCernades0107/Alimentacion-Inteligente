"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { Scope } from "@/app/actions/meals";

/** Pregunta si el cambio aplica solo a esta comida o a toda la recurrencia. */
export function ScopeDialog({
  open, action, onChoose, onCancel,
}: {
  open: boolean;
  action: "edit" | "delete";
  onChoose: (scope: Scope) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("calendar");
  const tc = useTranslations("common");
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("scopeTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{action === "edit" ? t("scopeEdit") : t("scopeDelete")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <Button variant={action === "delete" ? "destructive" : "default"} onClick={() => onChoose("one")}>{t("onlyThis")}</Button>
          <Button variant={action === "delete" ? "destructive" : "default"} onClick={() => onChoose("series")}>{t("allSeries")}</Button>
          <Button variant="ghost" onClick={onCancel}>{tc("cancel")}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
