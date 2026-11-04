import { Fragment, type ReactNode } from "react";

/** **negrita** dentro de una línea (sin HTML: todo pasa por React, así que no hay inyección). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

const BULLET = /^\s*(?:[-•*]|\d+[.)])\s+/;

/**
 * Markdown mínimo para las respuestas del Chef: párrafos, listas ("- ", "• ", "1. ") y **negrita**.
 * Lo demás se muestra tal cual.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) blocks.push(<p key={blocks.length}>{para.flatMap((l, i) => (i ? [<br key={`b${i}`} />, ...inline(l)] : inline(l)))}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={list.ordered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    if (BULLET.test(line)) {
      flushPara();
      const ordered = /^\s*\d/.test(line);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(line.replace(BULLET, ""));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className={className ?? "space-y-2"}>{blocks}</div>;
}
