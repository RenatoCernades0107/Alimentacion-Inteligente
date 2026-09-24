import type { OffProduct } from "./off";
import type { Food, Unit } from "./types";

export type PhotoMode = "food" | "receipt";

/** A qué se asoció un alimento detectado en una foto o boleta. */
export type DetectedMatch =
  | { kind: "food"; food: Food }
  | { kind: "product"; product: OffProduct; linked: Food | null }
  | { kind: "new"; name: string; emoji: string };

/** Alimento detectado, listo para revisarlo antes de agregarlo. */
export type DetectedItem = {
  id: string;
  raw_text: string;
  confidence: "high" | "medium" | "low";
  match: DetectedMatch;
  quantity: number;
  unit: Unit;
};
