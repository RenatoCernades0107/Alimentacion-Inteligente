"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, ChefHat, Refrigerator, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", key: "calendar", icon: CalendarDays },
  { href: "/inventory", key: "inventory", icon: Refrigerator },
  { href: "/chef", key: "chef", icon: Sparkles },
  { href: "/recipes", key: "recipes", icon: ChefHat },
  { href: "/family", key: "family", icon: Users },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-safe backdrop-blur">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map(({ href, key, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          // El Chef IA va al centro, destacado.
          if (key === "chef") {
            return (
              <li key={href} className="flex justify-center">
                <Link href={href} className="flex flex-col items-center gap-0.5 pt-1 pb-2 text-[11px] font-semibold">
                  <span
                    className={cn(
                      "-mt-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-orange-500 text-white shadow-lg shadow-fuchsia-600/30 ring-4 ring-background transition-transform active:scale-95",
                      active && "scale-105",
                    )}
                  >
                    <Icon className="size-6" strokeWidth={2} />
                  </span>
                  <span className={cn(active ? "text-fuchsia-600" : "text-muted-foreground")}>{t(key)}</span>
                </Link>
              </li>
            );
          }
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
