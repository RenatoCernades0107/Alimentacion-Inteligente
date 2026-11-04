"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CalendarCheck, CloudOff, Menu, Share2, SlidersHorizontal, SquarePen, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { deleteChefDraft, duplicateChefDraft, getChefDraft, renameChefDraft, saveChefDraft } from "@/app/actions/chef-drafts";
import { Composer, Messages, Welcome, type LiveThinking, type Starter } from "@/components/chef/chat-panel";
import { CustomRecipeDrawer } from "@/components/chef/custom-recipe-drawer";
import { DraftSidebar } from "@/components/chef/draft-sidebar";
import { PlanPanel } from "@/components/chef/plan-panel";
import { AlternativesDrawer, ApplyDrawer } from "@/components/chef/plan-drawers";
import { PrefsPanel } from "@/components/chef/prefs-panel";
import { ShareDrawer } from "@/components/chef/share-drawer";
import { TasteStep } from "@/components/chef/taste-step";
import {
  dayTargets, fallbackAlternatives, migrateDraft, pasteClip, rebaseDraft, scopeDates, slotKey, tasteDeck,
  type ChefPrefs, type ChefReply, type DishCard, type DraftData, type DraftMeta, type MealClip, type Plan, type SlotKey, type Thinking, type UiMessage,
} from "@/lib/chef";
import { pruneCustom, replaceRecipeIds } from "@/lib/chef-custom";
import type { ChefEvent } from "@/lib/chef-turn";
import type { MealSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ChefViewProps = {
  userId: string;
  firstName: string;
  today: string;
  /** Día pedido desde el calendario (?date=); si no, hoy. */
  start: string;
  cards: DishCard[];
  busy: [SlotKey, string][];
  slots: MealSlot[];
  mealsPerDay: number;
  myKcal: number | null;
  minor: boolean;
  isParent: boolean;
  initialGoal: ChefPrefs["goal"];
  /** Llegó desde "por vencer": se preselecciona aprovechar lo que vence. */
  useExpiring: boolean;
  /** Borradores guardados (los más recientes primero). */
  drafts: DraftMeta[];
  /** Borrador a abrir (?draft=), ej. al venir de un link compartido. */
  openId: string | null;
};

/** Borrador abierto. `key` lo identifica en el cliente aunque todavía no tenga id en la base. */
type Current = { key: string; id: string | null; title: string; data: DraftData };
type Tab = "chat" | "plan";

const LAST_KEY = (u: string) => `chef:last:${u}`;
const CLIP_KEY = (u: string) => `chef:clip:${u}`;
/** Borrador de la versión anterior (uno solo, guardado en el dispositivo): se importa una vez. */
const OLD_KEY = (u: string) => `chef:v1:${u}`;
/**
 * Copia en el dispositivo del borrador abierto. Si no se pudo guardar en la base (sin conexión, o la
 * tabla aún no existe), la conversación no se pierde: al volver se recupera de aquí y se reintenta.
 */
const MIRROR_KEY = (u: string) => `chef:current:${u}`;

/** Cuántos mensajes viajan al servidor (el servidor igual usa solo los últimos). */
const HISTORY_SENT = 40;

const hasContent = (d: DraftData) => d.messages.length > 0 || Object.keys(d.plan).length > 0;
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

function store(op: "get", key: string): string | null;
function store(op: "set", key: string, value: string): void;
function store(op: "remove", key: string): void;
function store(op: "get" | "set" | "remove", key: string, value?: string) {
  try {
    if (op === "get") return localStorage.getItem(key);
    if (op === "set") localStorage.setItem(key, value!);
    else localStorage.removeItem(key);
  } catch {
    // Sin almacenamiento (modo privado): se sigue sin recordar.
  }
  return null;
}

function readClip(userId: string): MealClip | null {
  try {
    const c = JSON.parse(store("get", CLIP_KEY(userId)) ?? "null") as MealClip | null;
    if (c?.kind === "meal" && typeof c.recipeId === "string") return c;
    if (c?.kind === "day" && c.meals && typeof c.meals === "object") return c;
  } catch {
    // dañado: se ignora
  }
  return null;
}

/** La copia local del borrador abierto (null si no hay o está dañada). */
function readMirror(userId: string): (Current & { pending: boolean }) | null {
  try {
    const m = JSON.parse(store("get", MIRROR_KEY(userId)) ?? "null") as (Current & { pending: boolean }) | null;
    const data = m && (migrateDraft(m.data) as DraftData | undefined);
    if (!m || !data || typeof m.key !== "string" || data.v !== 3 || !data.prefs || !Array.isArray(data.messages) || typeof data.plan !== "object") return null;
    return {
      key: m.key, id: typeof m.id === "string" ? m.id : null, title: typeof m.title === "string" ? m.title : "",
      data: { ...data, custom: data.custom && typeof data.custom === "object" ? data.custom : {} }, pending: !!m.pending,
    };
  } catch {
    return null;
  }
}

/** El borrador de la versión anterior, convertido al formato nuevo (null si no hay o no sirve). */
function readOldDraft(userId: string): DraftData | null {
  try {
    const raw = store("get", OLD_KEY(userId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Omit<DraftData, "v">> & { v?: number };
    if (d?.v !== 1 || !d.prefs) return null;
    return {
      v: 3,
      prefs: d.prefs,
      liked: d.liked ?? [],
      disliked: d.disliked ?? [],
      plan: d.plan ?? {},
      messages: (d.messages ?? []).map((m) => ({ role: m.role, text: String(m.text ?? "").slice(0, 4000), ...(m.offline ? { offline: true } : {}) })),
      quickReplies: d.quickReplies ?? [],
      custom: {},
    };
  } catch {
    return null;
  }
}

/**
 * Chef IA con interfaz de chat (al estilo ChatGPT): cada conversación es un borrador de plan que se
 * guarda solo en la base y se retoma desde la lista lateral. En la pestaña "Plan" se ve el plan por
 * día, se cambian, copian y pegan platos, y se pasa al calendario.
 */
export function ChefView(props: ChefViewProps) {
  const { userId, firstName, today, start, cards, slots, mealsPerDay, myKcal, minor, isParent, initialGoal, useExpiring, openId } = props;
  const t = useTranslations("chef");

  const freshData = (first: string, expiring = false): DraftData => ({
    v: 3,
    prefs: {
      goal: initialGoal,
      scope: expiring ? "today" : first === today ? "week" : "today",
      prefs: expiring ? ["expiring", "pantry"] : [],
      start: first,
    },
    liked: [],
    disliked: [],
    plan: {},
    messages: [],
    quickReplies: [],
    custom: {},
  });

  const [drafts, setDrafts] = useState<DraftMeta[]>(props.drafts);
  const [current, setCurrent] = useState<Current>(() => ({ key: newKey(), id: null, title: "", data: freshData(start, useExpiring) }));
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [sidebar, setSidebar] = useState(false);
  const [settings, setSettings] = useState(false);
  const [tasting, setTasting] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [alternatives, setAlternatives] = useState<ChefReply["alternatives"]>(null);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [clip, setClipState] = useState<MealClip | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [live, setLive] = useState<LiveThinking | null>(null);
  const pending = !!live;
  const [openCustom, setOpenCustom] = useState<string | null>(null);
  const turnAbort = useRef<AbortController | null>(null);
  useEffect(() => () => turnAbort.current?.abort(), []);
  const highlightTimer = useRef<number | null>(null);

  // ─────────────────────────────── Guardado automático en la base ───────────────────────────────
  // Los cambios se guardan ~1 s después del último; los guardados van en cola para que un borrador
  // nuevo no se cree dos veces (el id que devuelve el primero lo usan los siguientes).
  const latest = useRef(current);
  const ids = useRef(new Map<string, string>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  const lastSaveFailed = useRef(false);
  const warnedLocal = useRef(false);
  useEffect(() => {
    latest.current = current;
  }, [current]);

  // Copia local del borrador abierto: "pending" mientras haya cambios que la base todavía no tiene.
  useEffect(() => {
    if (ready && hasContent(current.data)) store("set", MIRROR_KEY(userId), JSON.stringify({ ...current, pending: dirty.current || !current.id }));
  }, [current, ready, userId]);

  const autoTitle = (d: DraftData) => {
    const first = d.messages.find((m) => m.role === "user")?.text.replace(/\s+/g, " ").trim();
    return (first && first !== t("buildPrompt") ? first : `${t(`goal.${d.prefs.goal}`)} · ${t(`scope.${d.prefs.scope}`)}`).slice(0, 60);
  };

  const save = (snap: Current) => {
    queue.current = queue.current.then(async () => {
      if (!hasContent(snap.data)) return;
      const id = snap.id ?? ids.current.get(snap.key) ?? null;
      try {
        const meta = await saveChefDraft({ id, title: snap.title || autoTitle(snap.data), data: snap.data });
        ids.current.set(snap.key, meta.id);
        setDrafts((list) => [meta, ...list.filter((d) => d.id !== meta.id)]);
        setCurrent((c) => (c.key === snap.key && !c.id ? { ...c, id: meta.id } : c));
        if (latest.current.key === snap.key && !dirty.current) {
          store("set", MIRROR_KEY(userId), JSON.stringify({ ...latest.current, id: meta.id, pending: false }));
        }
        lastSaveFailed.current = false;
        setSaveError(false);
      } catch (e) {
        console.error("chef draft", e);
        lastSaveFailed.current = true;
        setSaveError(true);
        if (latest.current.key === snap.key) dirty.current = true;
        if (!warnedLocal.current) {
          warnedLocal.current = true;
          toast(t("drafts.savedLocally"));
        }
      }
    });
    return queue.current;
  };

  const flush = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return queue.current;
    dirty.current = false;
    return save(latest.current);
  };

  /** Para compartir: guarda lo pendiente y devuelve el id del borrador (null si no se pudo guardar). */
  const ensureSaved = async () => {
    const c = latest.current;
    if (!hasContent(c.data)) return null;
    if (!c.id && !ids.current.get(c.key)) dirty.current = true;
    await flush();
    if (lastSaveFailed.current) return null;
    return latest.current.id ?? ids.current.get(latest.current.key) ?? null;
  };

  const scheduleSave = () => {
    dirty.current = true;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 900);
  };

  const change = (fn: (c: Current) => Current) => {
    setCurrent(fn);
    scheduleSave();
  };
  const changeData = (fn: (d: DraftData) => DraftData) => change((c) => ({ ...c, data: fn(c.data) }));

  // Al salir de la pantalla o esconder la app se guarda lo pendiente.
  const onLeave = useEffectEvent(() => void flush());
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && onLeave();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onLeave);
      onLeave();
    };
  }, []);

  useEffect(() => {
    if (current.id) store("set", LAST_KEY(userId), current.id);
  }, [current.id, userId]);

  // ─────────────────────────────────── Abrir / crear borradores ───────────────────────────────────
  const openDraft = async (id: string) => {
    setSidebar(false);
    if (id === current.id) return;
    await flush();
    setLoading(true);
    setAlternatives(null);
    setTasting(false);
    try {
      const res = await getChefDraft(id);
      if (!res) {
        toast.error(t("drafts.notFound"));
        setDrafts((l) => l.filter((d) => d.id !== id));
        return;
      }
      const { data, shifted } = rebaseDraft(res.data, today);
      ids.current.set(id, id);
      setCurrent({ key: id, id, title: res.meta.title, data });
      setTab(Object.keys(data.plan).length && !data.messages.length ? "plan" : "chat");
      if (shifted) {
        toast(t("drafts.rebased"));
        scheduleSave();
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  };

  const newDraft = () => {
    void flush();
    setCurrent({ key: newKey(), id: null, title: "", data: freshData(today) });
    setTab("chat");
    setSidebar(false);
    setTasting(false);
    setAlternatives(null);
    store("remove", LAST_KEY(userId));
  };

  // Primera carga: se importa el borrador de la versión anterior o se abre el último usado. Si se
  // llegó con un día del calendario o desde "por vencer", se empieza uno nuevo con esos datos.
  const init = useEffectEvent(async () => {
    setClipState(readClip(userId));
    const old = readOldDraft(userId);
    store("remove", OLD_KEY(userId));
    const mirror = readMirror(userId);
    const forceNew = start !== today || useExpiring;
    if (openId) {
      window.history.replaceState(null, "", "/chef");
      await openDraft(openId);
    } else if (!forceNew && mirror?.pending && hasContent(mirror.data)) {
      // Lo último que se escribió no llegó a la base: se recupera del dispositivo y se reintenta.
      const { data } = rebaseDraft(mirror.data, today);
      if (mirror.id) ids.current.set(mirror.key, mirror.id);
      setCurrent({ key: mirror.key, id: mirror.id, title: mirror.title, data });
      setTab("chat");
      scheduleSave();
    } else if (!forceNew && old && hasContent(old)) {
      const { data } = rebaseDraft(old, today);
      setCurrent({ key: newKey(), id: null, title: "", data });
      setTab(Object.keys(data.plan).length ? "plan" : "chat");
      scheduleSave();
    } else if (!forceNew) {
      const last = store("get", LAST_KEY(userId));
      if (last && drafts.some((d) => d.id === last)) await openDraft(last);
    }
    setReady(true);
  });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación única desde localStorage y la base
    void init();
  }, []);

  const rename = (id: string, title: string) => {
    const before = drafts.find((d) => d.id === id);
    if (!before || before.title === title) return;
    setDrafts((l) => l.map((d) => (d.id === id ? { ...d, title } : d)));
    if (id === current.id) setCurrent((c) => ({ ...c, title }));
    renameChefDraft(id, title).catch(() => toast.error(t("error")));
  };

  const duplicate = async (id: string) => {
    await flush();
    const src = drafts.find((d) => d.id === id);
    try {
      const meta = await duplicateChefDraft(id, t("drafts.copyTitle", { title: (src?.title || t("untitled")).slice(0, 60) }));
      setDrafts((l) => [meta, ...l.filter((d) => d.id !== meta.id)]);
      toast.success(t("drafts.duplicated"));
      await openDraft(meta.id);
    } catch {
      toast.error(t("error"));
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteChefDraft(id);
      setDrafts((l) => l.filter((d) => d.id !== id));
      if (id === current.id) {
        dirty.current = false;
        newDraft();
      }
      toast.success(t("drafts.deleted"));
    } catch {
      toast.error(t("error"));
    }
  };

  // ───────────────────────────────────────── Datos del plan ─────────────────────────────────────────
  const data = current.data;
  const cardMap = useMemo(
    () => new Map([...cards, ...Object.values(data.custom).map((d) => d.card)].map((c) => [c.id, c])),
    [cards, data.custom],
  );
  const busyMap = useMemo(() => new Map<string, string>(props.busy), [props.busy]);
  const targets = dayTargets(myKcal, data.prefs.goal);
  const dates = scopeDates(data.prefs.scope, today, data.prefs.start);
  const deck = useMemo(() => tasteDeck(cards, data.prefs.goal, data.prefs.prefs, slots), [cards, data.prefs.goal, data.prefs.prefs, slots]);
  const entries = dates.flatMap((d) =>
    slots
      .map((s) => slotKey(d, s))
      .filter((k) => data.plan[k] && !busyMap.has(k) && cardMap.has(data.plan[k]!.recipeId))
      .map((k) => ({ key: k, recipeId: data.plan[k]!.recipeId })),
  );
  const busyInScope = [...busyMap.keys()].filter((k) => dates.includes(k.split("|")[0])).length;
  const emptyCount = dates.length * slots.length - entries.length - busyInScope;
  const started = hasContent(data);

  const flash = (keys: string[]) => {
    if (!keys.length) return;
    setHighlight(new Set(keys));
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlight(new Set()), 2600);
  };

  // ─────────────────────────────────────────── El Chef ───────────────────────────────────────────
  /** Aplica la respuesta del Chef al borrador en que se pidió: cambios al plan, mensaje y alternativas. */
  const receive = (key: string, reply: ChefReply, thinking?: Thinking) => {
    change((c) => {
      if (c.key !== key) return c;
      const plan: Plan = { ...c.data.plan };
      for (const ch of reply.changes) {
        if (ch.recipeId) plan[ch.key] = { recipeId: ch.recipeId, reason: ch.reason };
        else delete plan[ch.key];
      }
      // Recetas nuevas que inventó: viven en el borrador hasta pasarlas al calendario.
      const custom = pruneCustom({ ...c.data.custom, ...Object.fromEntries(reply.custom.map((d) => [d.card.id, d])) }, plan);
      const text = reply.message || (reply.changes.length ? t("updatedCount", { count: reply.changes.length }) : "");
      const msg: UiMessage = {
        role: "model",
        text,
        ...(reply.offline ? { offline: true } : {}),
        ...(reply.sources.length ? { sources: reply.sources } : {}),
        ...(reply.changes.length ? { changes: reply.changes.length } : {}),
        ...(thinking && (thinking.steps.length || thinking.text) ? { thinking } : {}),
      };
      return {
        ...c,
        title: c.title || reply.title || "",
        data: { ...c.data, plan, custom, messages: text ? [...c.data.messages, msg] : c.data.messages, quickReplies: reply.quickReplies },
      };
    });
    flash(reply.changes.map((c) => c.key));
    if (reply.alternatives) setAlternatives(reply.alternatives);
  };

  const send = (intent: "build" | "message", text: string, prepare?: (d: DraftData) => DraftData) => {
    if (pending) return;
    const prepared = prepare ? prepare(current.data) : current.data;
    const base = intent === "build" ? { ...prepared, plan: {} } : prepared;
    const userMsg: UiMessage = { role: "user", text };
    const history = (intent === "message" ? [...base.messages, userMsg] : base.messages).slice(-HISTORY_SENT);
    const key = current.key;
    change((c) => ({ ...c, data: { ...base, messages: [...base.messages, userMsg], quickReplies: [] } }));
    setTasting(false);
    setTab(intent === "build" ? "plan" : "chat");
    const startedAt = Date.now();
    const steps: string[] = [];
    let thought = "";
    setLive({ steps: [], text: "", startedAt });
    const ctrl = new AbortController();
    turnAbort.current = ctrl;
    void (async () => {
      try {
        const res = await fetch("/api/chef", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            intent,
            prefs: base.prefs,
            history: history.map(({ role, text }) => ({ role, text })),
            plan: base.plan,
            liked: base.liked,
            disliked: base.disliked,
            custom: Object.fromEntries(Object.entries(base.custom).map(([id, d]) => [id, d.recipe])),
          }),
        });
        if (!res.ok || !res.body) throw new Error(`chef ${res.status}`);
        let reply: ChefReply | null = null;
        for await (const ev of readEvents(res.body)) {
          if (ev.type === "step") {
            steps.push(ev.text);
            setLive((l) => l && { ...l, steps: [...steps] });
          } else if (ev.type === "thinking") {
            thought += ev.text;
            setLive((l) => l && { ...l, text: thought });
          } else if (ev.type === "reply") reply = ev.reply;
          else throw new Error("chef error");
        }
        if (!reply) throw new Error("chef: no reply");
        receive(key, reply, { steps: steps.slice(-20), text: clipThought(thought), ms: Date.now() - startedAt });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        console.error(e);
        toast.error(t("error"));
        change((c) => (c.key === key ? { ...c, data: { ...c.data, messages: [...c.data.messages, { role: "model", text: t("error"), offline: true }] } } : c));
      } finally {
        if (turnAbort.current === ctrl) turnAbort.current = null;
        setLive(null);
      }
    })();
  };

  const build = (prepare?: (d: DraftData) => DraftData) => send("build", t("buildPrompt"), prepare);

  // ──────────────────────────────────────── Copiar y pegar ────────────────────────────────────────
  const setClip = (c: MealClip | null) => {
    setClipState(c);
    if (c) store("set", CLIP_KEY(userId), JSON.stringify(c));
    else store("remove", CLIP_KEY(userId));
  };

  const paste = (targetsToPaste: string[]) => {
    if (!clip) return;
    const res = pasteClip(data.plan, clip, targetsToPaste, { slots, busy: busyMap, known: (id) => cardMap.has(id) });
    if (!res.changed.length) return toast(t("clip.nothing"));
    changeData((d) => ({ ...d, plan: res.plan }));
    flash(res.changed);
    toast.success(t("clip.pasted", { count: res.changed.length }));
  };

  const setSlot = (key: SlotKey, recipeId: string | null) =>
    changeData((d) => {
      const plan = { ...d.plan };
      if (recipeId) plan[key] = { recipeId };
      else delete plan[key];
      return { ...d, plan };
    });

  const starters: Starter[] = [
    { emoji: "🗓️", label: t("starters.week"), text: t("starters.weekText"), prefs: { scope: "week" } },
    { emoji: "💪", label: t("starters.protein"), text: t("starters.proteinText"), prefs: { scope: "tomorrow", start: today } },
    {
      emoji: "⏳",
      label: t("starters.expiring"),
      text: t("starters.expiringText"),
      prefs: { scope: "today", start: today, prefs: [...new Set([...data.prefs.prefs, "expiring" as const, "pantry" as const])] },
    },
    { emoji: "🥗", label: t("starters.question"), text: t("starters.questionText") },
  ];

  const quick = data.quickReplies.length
    ? data.quickReplies
    : entries.length
      ? [t("qr.moreProtein"), t("qr.lighter"), t("qr.quicker"), t("qr.moreVeggies")]
      : [];

  // ─────────────────────────────────────────── Pantalla ───────────────────────────────────────────
  return (
    <div className="pb-[calc(10rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 -mx-4 bg-background/95 px-2 pt-2 pb-1 backdrop-blur">
        <div className="flex items-center gap-1">
          <button onClick={() => setSidebar(true)} aria-label={t("drafts.title")} className="rounded-full p-2.5 active:bg-muted">
            <Menu className="size-5" />
          </button>
          <button onClick={() => setSidebar(true)} className="min-w-0 flex-1 px-1 text-left">
            <span className="block truncate text-base leading-tight font-semibold">{current.title || (started ? autoTitle(data) : t("title"))}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {t(`goal.${data.prefs.goal}`)} · {t("targetLine", { kcal: targets.kcal })}
            </span>
          </button>
          {saveError && (
            <button onClick={() => (dirty.current = true, void flush())} aria-label={t("drafts.retrySave")} className="rounded-full p-2.5 text-amber-600 active:bg-muted">
              <CloudOff className="size-5" />
            </button>
          )}
          {started && (
            <button onClick={() => setShareOpen(true)} aria-label={t("share")} className="rounded-full p-2.5 active:bg-muted">
              <Share2 className="size-5" />
            </button>
          )}
          <button onClick={() => setSettings(true)} aria-label={t("settings")} className="rounded-full p-2.5 active:bg-muted">
            <SlidersHorizontal className="size-5" />
          </button>
          <button onClick={newDraft} disabled={pending} aria-label={t("drafts.new")} className="rounded-full p-2.5 active:bg-muted disabled:opacity-40">
            <SquarePen className="size-5" />
          </button>
        </div>
        {started && !tasting && (
          <div className="mx-2 mt-1.5 flex rounded-xl bg-muted p-0.5 text-sm font-medium" role="tablist">
            {(["chat", "plan"] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cn("flex-1 rounded-[0.6rem] py-1.5 transition-all", tab === k ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                {k === "chat" ? t("tabs.chat") : t("tabs.plan", { count: entries.length })}
              </button>
            ))}
          </div>
        )}
      </header>

      {!ready || loading ? (
        <div className="mt-24 flex justify-center text-4xl motion-safe:animate-pulse">✨</div>
      ) : tasting ? (
        <div className="pt-3">
          <TasteStep
            deck={deck}
            liked={data.liked}
            disliked={data.disliked}
            slots={slots}
            onDecide={(id, liked) => changeData((d) => (liked ? { ...d, liked: [...d.liked, id] } : { ...d, disliked: [...d.disliked, id] }))}
            onDone={(liked, disliked) => build((d) => ({ ...d, liked, disliked }))}
            onBack={() => setTasting(false)}
          />
        </div>
      ) : !started ? (
        <Welcome
          firstName={firstName}
          prefs={data.prefs}
          targets={targets}
          starters={starters}
          onStarter={(s) => send("message", s.text, s.prefs ? (d) => ({ ...d, prefs: { ...d.prefs, ...s.prefs } }) : undefined)}
          onTaste={() => {
            changeData((d) => ({ ...d, liked: [], disliked: [] }));
            setTasting(true);
          }}
          onSettings={() => setSettings(true)}
        />
      ) : tab === "chat" ? (
        <Messages key={current.key} messages={data.messages} live={live} onShowPlan={() => setTab("plan")} />
      ) : (
        <div className="pt-3">
          <PlanPanel
            plan={data.plan}
            dates={dates}
            targets={targets}
            cardMap={cardMap}
            busy={busyMap}
            slots={slots}
            mealsPerDay={mealsPerDay}
            myKcal={myKcal}
            pending={pending}
            highlight={highlight}
            clip={clip}
            onSwap={(key) =>
              setAlternatives({ key, options: fallbackAlternatives(cards, data.plan, key, data.prefs.goal, data.prefs.prefs, data.disliked, 8) })
            }
            onSet={setSlot}
            onClip={setClip}
            onPaste={paste}
            onBuild={() => build()}
            onOpenCustom={setOpenCustom}
          />
        </div>
      )}

      {/* Barra fija: pasar al calendario (en el plan) y la caja para hablar con el Chef */}
      {ready && !loading && !tasting && (
        <div className="fixed inset-x-0 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] z-30 bg-gradient-to-t from-background from-70% to-background/0 pt-4">
          <div className="mx-auto max-w-lg px-4 pb-2">
            {tab === "plan" && started && entries.length > 0 && (
              <button
                onClick={() => setApplyOpen(true)}
                disabled={pending}
                className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-primary px-4 py-2.5 text-left text-primary-foreground shadow-md shadow-primary/25 transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                <CalendarCheck className="size-5 shrink-0" />
                <span className="min-w-0 flex-1 text-sm font-semibold">{t("applyCta", { count: entries.length })}</span>
                {emptyCount > 0 && <span className="shrink-0 text-xs text-primary-foreground/80">{t("emptyLeft", { count: emptyCount })}</span>}
              </button>
            )}
            <Composer pending={pending} quickReplies={tab === "chat" && !pending ? quick : []} onSend={(text) => send("message", text)} />
          </div>
        </div>
      )}

      <DraftSidebar
        open={sidebar}
        onOpenChange={setSidebar}
        drafts={drafts}
        currentId={current.id}
        today={today}
        disabled={pending}
        onNew={newDraft}
        onOpen={(id) => void openDraft(id)}
        onRename={rename}
        onDuplicate={(id) => void duplicate(id)}
        onDelete={(id) => void remove(id)}
      />

      <Drawer open={settings} onOpenChange={setSettings}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-lg overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-0">
              <DrawerTitle>{t("settings")}</DrawerTitle>
              <DrawerDescription>{t("settingsHint")}</DrawerDescription>
            </DrawerHeader>
            <PrefsPanel today={today} minor={minor} myKcal={myKcal} prefs={data.prefs} targets={targets} onChange={(prefs) => changeData((d) => ({ ...d, prefs }))} />
            {started && (
              <Button
                onClick={() => {
                  setSettings(false);
                  build();
                }}
                disabled={pending}
                className="mt-4 h-12 w-full rounded-2xl font-semibold"
              >
                <Wand2 className="size-4" /> {t("rebuildWithSettings")}
              </Button>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <AlternativesDrawer
        alternatives={alternatives}
        cardMap={cardMap}
        myKcal={myKcal}
        mealsPerDay={mealsPerDay}
        onClose={() => setAlternatives(null)}
        onPick={(key, id) => {
          setSlot(key, id);
          setAlternatives(null);
          flash([key]);
        }}
        onAskChef={(text) => {
          setAlternatives(null);
          send("message", text);
        }}
      />

      <ShareDrawer open={shareOpen} onOpenChange={setShareOpen} ensureSaved={ensureSaved} />

      <ApplyDrawer
        open={applyOpen}
        onOpenChange={setApplyOpen}
        entries={entries}
        dates={dates}
        cardMap={cardMap}
        isParent={isParent}
        custom={data.custom}
        onSaved={(saved) =>
          // Las recetas nuevas ya son recetas de verdad: el plan usa sus ids y dejan de estar en el borrador.
          changeData((d) => ({
            ...d,
            plan: replaceRecipeIds(d.plan, saved),
            custom: Object.fromEntries(Object.entries(d.custom).filter(([id]) => !saved[id])),
          }))
        }
      />

      <CustomRecipeDrawer dish={openCustom ? (data.custom[openCustom] ?? null) : null} onClose={() => setOpenCustom(null)} />
    </div>
  );
}

/** Razonamiento que se guarda con el mensaje (el principio, que es donde se ve el plan del modelo). */
function clipThought(text: string) {
  const t = text.trim();
  return t.length > 3000 ? `${t.slice(0, 3000).trimEnd()}…` : t;
}

/** Lee el NDJSON de /api/chef evento por evento. */
async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<ChefEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    buf += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield JSON.parse(line) as ChefEvent;
    }
    if (done) break;
  }
  if (buf.trim()) yield JSON.parse(buf) as ChefEvent;
}
