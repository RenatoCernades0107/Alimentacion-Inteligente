"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteRecipe } from "@/app/actions/recipes";
import { cn } from "@/lib/utils";

/**
 * Editar (cualquiera puede: si la receta no es suya, se guarda su propia versión) y, en recetas propias,
 * eliminar. En una versión modificada de otra receta "eliminar" es "restaurar la original".
 */
export function RecipeActions({
  recipeId, slug, canDelete, originalSlug, scheduledCount,
}: {
  recipeId: string;
  slug: string;
  /** El autor, o un padre de la familia, puede eliminar una receta propia. */
  canDelete: boolean;
  /** Si esta receta es mi versión modificada de otra, el slug de la original. */
  originalSlug: string | null;
  /** Comidas del calendario que usan la receta. */
  scheduledCount: number;
}) {
  const t = useTranslations("myRecipes");
  const tc = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const restore = !!originalSlug;

  function confirm() {
    start(async () => {
      try {
        await deleteRecipe(recipeId);
        toast.success(restore ? t("restored") : t("deleted"));
        setOpen(false);
        router.replace(originalSlug ? `/recipes/${originalSlug}` : "/recipes");
      } catch {
        toast.error(tc("error"));
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Link href={`/recipes/${slug}/edit`} className={cn(buttonVariants({ variant: "outline" }), "h-10 flex-1")}>
        <Pencil /> {tc("edit")}
      </Link>
      {canDelete && (
        <Button variant="outline" className="h-10 flex-1 text-destructive" onClick={() => setOpen(true)}>
          {restore ? <RotateCcw /> : <Trash2 />} {restore ? t("restoreButton") : tc("delete")}
        </Button>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{restore ? t("restoreTitle") : t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {restore ? t("restoreBody") : t("deleteBody")}
              {scheduledCount > 0 && <> {t("deleteScheduled", { count: scheduledCount })}</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <Button variant="destructive" disabled={pending} onClick={confirm}>
              {restore ? t("restoreConfirm") : t("deleteConfirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
