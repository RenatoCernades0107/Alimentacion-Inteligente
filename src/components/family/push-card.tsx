"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Bell, BellOff, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendTestPush, subscribePush, unsubscribePush } from "@/app/actions/push";

type State = "loading" | "install" | "unsupported" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Activa las notificaciones push. En iPhone solo funcionan si la app se abrió desde
 * la pantalla de inicio (iOS 16.4+), así que primero se muestra cómo instalarla.
 * `compact`: en la pantalla de inicio solo aparece si falta hacer algo.
 */
export function PushCard({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("push");
  const tc = useTranslations("common");
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (isIOS() && !isStandalone()) return setState("install");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, []);

  function enable() {
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        });
        await subscribePush(JSON.parse(JSON.stringify(sub)));
        setState("on");
        toast.success(t("enabled"));
      } catch {
        toast.error(tc("error"));
      }
    });
  }

  function disable() {
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  }

  if (state === "loading") return null;
  if (compact && (state === "on" || state === "unsupported" || state === "denied")) return null;

  if (state === "install") {
    return (
      <div className="mt-4 flex gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <Share className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="font-medium">{t("installTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("installSteps")}</p>
        </div>
      </div>
    );
  }

  if (state === "unsupported" || state === "denied") {
    return <p className="text-sm text-muted-foreground">{state === "denied" ? t("denied") : t("unsupported")}</p>;
  }

  if (state === "off") {
    return (
      <div className={compact ? "mt-4" : ""}>
        <Button size="lg" className="h-11 w-full" onClick={enable} disabled={pending}>
          <Bell /> {t("enable")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-sm font-medium text-primary">✓ {t("enabled")}</span>
      <Button variant="outline" size="sm" onClick={() => start(async () => void (await sendTestPush()))} disabled={pending}>
        {t("test")}
      </Button>
      <Button variant="ghost" size="sm" onClick={disable} disabled={pending}>
        <BellOff /> {t("disable")}
      </Button>
    </div>
  );
}
