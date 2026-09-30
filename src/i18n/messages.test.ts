import { describe, expect, it } from "vitest";
import es from "../../messages/es.json";
import en from "../../messages/en.json";

/** Rutas de todas las claves hoja, ej. "family.members". */
function paths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
}

describe("traducciones", () => {
  const esKeys = paths(es).sort();
  const enKeys = paths(en).sort();

  it("es y en tienen exactamente las mismas claves", () => {
    expect(esKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !esKeys.includes(k))).toEqual([]);
  });

  it("ningún texto está vacío", () => {
    const flat = (o: unknown, p = ""): [string, unknown][] =>
      o !== null && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k)) : [[p, o]];
    for (const [key, value] of [...flat(es), ...flat(en)]) expect(String(value).trim(), key).not.toBe("");
  });
});
