"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { AVATARS, avatarPath, type AvatarId } from "@/lib/avatars";
import { cn } from "@/lib/utils";

/**
 * Cuadrícula de avatares animados (radiogroup accesible con flechas).
 * Si se pasa `name`, incluye un input oculto para usarla dentro de un <form>.
 */
export function AvatarGrid({
  value,
  onChange,
  name,
  disabled,
  className,
}: {
  value: AvatarId | null;
  onChange: (id: AvatarId) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("avatar");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = value ? AVATARS.indexOf(value) : -1;

  const move = (from: number, delta: number) => {
    const next = (from + delta + AVATARS.length) % AVATARS.length;
    onChange(AVATARS[next]);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={t("choose")} className={cn("grid grid-cols-4 gap-3 sm:grid-cols-5", className)}>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      {AVATARS.map((id, i) => {
        const selected = id === value;
        return (
          <button
            key={id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t("option", { number: i + 1 })}
            tabIndex={selected || (selectedIndex === -1 && i === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i, -1);
              }
            }}
            className={cn(
              "relative aspect-square rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-background transition outline-none",
              "hover:scale-105 focus-visible:ring-ring disabled:opacity-50",
              selected && "ring-primary",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático pequeño */}
            <img src={avatarPath(id)} alt="" className="size-full rounded-full" loading="lazy" />
            {selected && (
              <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                <Check className="size-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** AvatarGrid con estado propio para formularios (envía el id en `name`). */
export function AvatarField({ name, defaultValue = null }: { name: string; defaultValue?: AvatarId | null }) {
  const [value, setValue] = useState<AvatarId | null>(defaultValue);
  return <AvatarGrid name={name} value={value} onChange={setValue} />;
}
