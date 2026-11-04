"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Copy, MoreHorizontal, Pencil, Search, SquarePen, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { daysBetween, fromLocal, parseDate } from "@/lib/dates";
import type { DraftMeta } from "@/lib/chef";
import { cn } from "@/lib/utils";

/** Lista de borradores del Chef (como el historial de chats de ChatGPT): abrir, nuevo, renombrar, duplicar y borrar. */
export function DraftSidebar({
  open, onOpenChange, drafts, currentId, today, disabled, onNew, onOpen, onRename, onDuplicate, onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: DraftMeta[];
  currentId: string | null;
  today: string;
  /** El Chef está respondiendo: no se cambia de borrador hasta que termine. */
  disabled: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("chef");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);

  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const q = query.trim().toLowerCase();
  const list = q ? drafts.filter((d) => (d.title || t("untitled")).toLowerCase().includes(q)) : drafts;

  // Grupos por última edición: hoy, últimos 7 días y antes.
  const groups: { key: string; label: string; items: DraftMeta[] }[] = [
    { key: "today", label: t("drafts.today"), items: [] },
    { key: "week", label: t("drafts.week"), items: [] },
    { key: "older", label: t("drafts.older"), items: [] },
  ];
  for (const d of list) {
    const age = daysBetween(fromLocal(new Date(d.updatedAt)), today);
    groups[age <= 0 ? 0 : age <= 7 ? 1 : 2].items.push(d);
  }

  const close = () => {
    setMenu(null);
    setConfirmDelete(null);
    setEditing(null);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : (close(), onOpenChange(false)))}>
      <SheetContent side="left" className="w-[85%] gap-0 p-0 pt-safe">
        <SheetHeader className="border-b pb-3">
          <SheetTitle>{t("drafts.title")}</SheetTitle>
          <SheetDescription>{t("drafts.subtitle")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 p-3">
          <button
            onClick={onNew}
            disabled={disabled}
            className="flex w-full items-center gap-2 rounded-xl bg-foreground px-3 py-2.5 text-sm font-semibold text-background active:scale-[0.98] disabled:opacity-50"
          >
            <SquarePen className="size-4" /> {t("drafts.new")}
          </button>
          {drafts.length > 4 && (
            <label className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("drafts.search")}
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {!drafts.length && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("drafts.empty")}</p>}
          {groups
            .filter((g) => g.items.length)
            .map((g) => (
              <section key={g.key} className="mb-3">
                <h4 className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground">{g.label}</h4>
                <ul>
                  {g.items.map((d) => {
                    const active = d.id === currentId;
                    const past = d.start != null && d.start < today;
                    return (
                      <li key={d.id} className="relative">
                        {editing?.id === d.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              onRename(d.id, editing.title.trim());
                              setEditing(null);
                            }}
                            className="px-1 py-1"
                          >
                            <input
                              autoFocus
                              value={editing.title}
                              maxLength={80}
                              onChange={(e) => setEditing({ id: d.id, title: e.target.value })}
                              onBlur={() => {
                                onRename(d.id, editing.title.trim());
                                setEditing(null);
                              }}
                              aria-label={t("drafts.rename")}
                              className="h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                            />
                          </form>
                        ) : (
                          <div className={cn("flex items-center rounded-xl", active ? "bg-muted" : "active:bg-muted/60")}>
                            <button
                              onClick={() => onOpen(d.id)}
                              disabled={disabled && !active}
                              className="min-w-0 flex-1 px-3 py-2 text-left disabled:opacity-50"
                            >
                              <span className="block truncate text-sm font-medium">{d.title || t("untitled")}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {t("drafts.meals", { count: d.meals })}
                                {d.start && ` · ${past ? t("drafts.reuse") : dayFmt.format(parseDate(d.start))}`}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setConfirmDelete(null);
                                setMenu(menu === d.id ? null : d.id);
                              }}
                              aria-label={t("drafts.actions")}
                              aria-expanded={menu === d.id}
                              className="mr-1 rounded-lg p-2 text-muted-foreground active:bg-background"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </div>
                        )}
                        {menu === d.id && !editing && (
                          <div className="mx-2 mb-1 flex gap-1 rounded-xl border bg-card p-1 text-xs font-medium shadow-sm">
                            <button
                              onClick={() => {
                                setMenu(null);
                                setEditing({ id: d.id, title: d.title });
                              }}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg py-2 active:bg-muted"
                            >
                              <Pencil className="size-3.5" /> {t("drafts.rename")}
                            </button>
                            <button
                              onClick={() => {
                                setMenu(null);
                                onDuplicate(d.id);
                              }}
                              disabled={disabled}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg py-2 active:bg-muted disabled:opacity-50"
                            >
                              <Copy className="size-3.5" /> {t("drafts.duplicate")}
                            </button>
                            <button
                              onClick={() => {
                                if (confirmDelete !== d.id) return setConfirmDelete(d.id);
                                setMenu(null);
                                setConfirmDelete(null);
                                onDelete(d.id);
                              }}
                              disabled={disabled && active}
                              className={cn(
                                "flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-rose-600 active:bg-rose-50 disabled:opacity-50 dark:active:bg-rose-950/40",
                                confirmDelete === d.id && "bg-rose-600 text-white active:bg-rose-700",
                              )}
                            >
                              <Trash2 className="size-3.5" /> {confirmDelete === d.id ? t("drafts.confirmDelete") : t("drafts.delete")}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
