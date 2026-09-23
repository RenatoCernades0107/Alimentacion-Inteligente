import { STORES, type StoreId } from "@/lib/stores";
import { cn } from "@/lib/utils";

/** Chips con las cadenas donde se encontró el producto. */
export function StoreBadges({ stores, className }: { stores: StoreId[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {stores.map((s) => (
        <span key={s} className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none", STORES[s]?.className)}>
          {STORES[s]?.name ?? s}
        </span>
      ))}
    </div>
  );
}
