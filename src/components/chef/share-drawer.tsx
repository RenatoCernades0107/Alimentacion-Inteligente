"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy, Link2, Link2Off, RefreshCw, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { getChefShare, shareChefDraft, unshareChefDraft, type ShareInfo } from "@/app/actions/chef-share";

/**
 * Compartir un borrador como link (como "compartir chat" de ChatGPT/Claude): se publica una foto del
 * plan y la conversación tal como están; quien abre el link puede verlo y seguir editando su copia.
 */
export function ShareDrawer({
  open, onOpenChange, ensureSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Guarda lo pendiente y devuelve el id del borrador (null si no se pudo guardar). */
  ensureSaved: () => Promise<string | null>;
}) {
  const t = useTranslations("share");
  const locale = useLocale();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, startBusy] = useTransition();

  // Al abrir: se guarda lo pendiente y se busca si ya tiene link.
  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const id = await ensureSaved();
      setDraftId(id);
      setInfo(id ? await getChefShare(id) : null);
      if (!id) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };
  const onOpen = useEffectEvent(() => void load());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- se consulta el link al abrir
    if (open) onOpen();
  }, [open]);

  const url = info ? `${window.location.origin}/s/${info.id}` : "";
  const updated = info ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(info.updatedAt)) : "";

  const create = () =>
    startBusy(async () => {
      if (!draftId) return;
      try {
        const res = await shareChefDraft(draftId);
        const isNew = !info;
        setInfo(res);
        toast.success(isNew ? t("created") : t("updated"));
        if (isNew) await copy(`${window.location.origin}/s/${res.id}`);
      } catch {
        toast.error(t("error"));
      }
    });

  const remove = () =>
    startBusy(async () => {
      if (!draftId) return;
      try {
        await unshareChefDraft(draftId);
        setInfo(null);
        toast.success(t("removed"));
      } catch {
        toast.error(t("error"));
      }
    });

  const copy = async (link = url) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // sin permiso: el link queda visible para copiarlo a mano
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: t("shareTitle"), text: t("shareText"), url });
    } catch {
      // cancelado
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <DrawerHeader className="px-0">
            <DrawerTitle>{t("title")}</DrawerTitle>
            <DrawerDescription>{t("description")}</DrawerDescription>
          </DrawerHeader>

          {loading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-muted" />
          ) : failed ? (
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {t("needsSave")}
              <Button variant="outline" onClick={() => void load()} className="mt-3 w-full rounded-xl">
                <RefreshCw className="size-4" /> {t("retry")}
              </Button>
            </div>
          ) : info ? (
            <>
              <div className="flex items-center gap-2 rounded-2xl border bg-card p-1.5 pl-3">
                <Link2 className="size-4 shrink-0 text-muted-foreground" />
                <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={t("link")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                <Button onClick={() => void copy()} size="sm" className="shrink-0 rounded-xl">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? t("copied") : t("copy")}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("sharedAt", { date: updated })}</p>
              <div className="mt-4 grid gap-2">
                {typeof navigator !== "undefined" && "share" in navigator && (
                  <Button onClick={() => void nativeShare()} className="h-11 rounded-2xl">
                    <Share className="size-4" /> {t("shareVia")}
                  </Button>
                )}
                <Button onClick={create} disabled={busy} variant="outline" className="h-11 rounded-2xl">
                  <RefreshCw className="size-4" /> {t("update")}
                </Button>
                <Button onClick={remove} disabled={busy} variant="ghost" className="h-11 rounded-2xl text-rose-600">
                  <Link2Off className="size-4" /> {t("remove")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <ul className="space-y-2 rounded-2xl bg-muted/60 p-4 text-sm">
                <li>👀 {t("point1")}</li>
                <li>✏️ {t("point2")}</li>
                <li>🔒 {t("point3")}</li>
              </ul>
              <Button onClick={create} disabled={busy} className="mt-4 h-12 w-full rounded-2xl text-base font-semibold">
                <Link2 className="size-5" /> {busy ? t("creating") : t("create")}
              </Button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
