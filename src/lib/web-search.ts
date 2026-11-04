import "server-only";
import type { Source } from "./chef";

/**
 * Búsqueda web del Chef IA, limitada a nutrición, alimentación, planes de comida y salud.
 *
 * La restricción no depende solo de lo que diga la IA: la búsqueda se hace únicamente sobre una lista
 * cerrada de sitios de salud y alimentación (`HEALTH_DOMAINS`) y además se rechazan las consultas que
 * no parecen de ese tema (`isFoodHealthQuery`). Usa Tavily (TAVILY_API_KEY); sin llave, el Chef
 * simplemente no busca.
 */

/** Sitios permitidos: organismos de salud, universidades, guías alimentarias y sitios de nutrición/recetas saludables. */
export const HEALTH_DOMAINS = [
  // Organismos internacionales y gobiernos
  "who.int", "paho.org", "fao.org", "unicef.org", "efsa.europa.eu",
  "nih.gov", "medlineplus.gov", "cdc.gov", "fda.gov", "usda.gov", "myplate.gov", "nutrition.gov", "dietaryguidelines.gov",
  "nhs.uk", "minsa.gob.pe", "ins.gob.pe", "gob.pe", "aesan.gob.es",
  // Universidades, hospitales y asociaciones
  "hsph.harvard.edu", "nutritionsource.hsph.harvard.edu", "health.harvard.edu", "mayoclinic.org", "clevelandclinic.org",
  "hopkinsmedicine.org", "eatright.org", "heart.org", "diabetes.org", "bda.uk.com", "nutrition.org", "fundaciondelcorazon.com",
  "seen.es", "kidshealth.org",
  // Nutrición basada en evidencia y planes / recetas saludables
  "examine.com", "eatingwell.com", "bbcgoodfood.com",
] as const;

/** Palabras que delatan una consulta de alimentación, nutrición o salud (es/en). */
const TOPIC = new RegExp(
  [
    "aliment", "comida", "comer", "dieta", "nutri", "receta", "plato", "cocin", "desayun", "almuerz", "\\bcena", "merienda", "snack",
    "calor", "kcal", "prote[ií]n", "carbohidrat", "carbos", "grasa", "fibra", "az[uú]car", "sodio", "sal\\b", "vitamin", "mineral",
    "hierro", "calcio", "omega", "colesterol", "glucosa", "diabet", "presi[oó]n", "hipertens", "obesi", "sobrepeso", "peso\\b", "\\bimc\\b",
    "m[uú]sculo", "masa muscular", "entren", "ejercicio", "deport", "salud", "saludable", "porci[oó]n", "macros?\\b", "macronutri", "ayuno", "vegan",
    "vegetarian", "gluten", "lactosa", "alergi", "intoleran", "embaraz", "lactancia", "ni[ñn]os?\\b", "beb[eé]", "hidrat", "agua",
    "verdura", "fruta", "menestra", "legumbre", "cereal", "avena", "quinua", "arroz", "pollo", "pescado", "carne", "huevo", "leche",
    "food", "meal", "\\beat", "diet", "nutrition", "recipe", "cook", "breakfast", "lunch", "dinner", "calorie", "protein", "carb", "\\bfats?\\b",
    "fiber", "sugar", "health", "weight", "muscle", "workout", "exercise", "fasting", "allerg", "pregnan", "vegetable", "fruit",
  ].join("|"),
  "i",
);

export function isFoodHealthQuery(query: string): boolean {
  return TOPIC.test(query);
}

export function hasWebSearch() {
  return Boolean(process.env.TAVILY_API_KEY);
}

export type SearchResult = Source & { content: string };

/** Busca en los sitios permitidos. Devuelve [] si la consulta no es del tema, no hay llave o la búsqueda falla. */
export async function searchHealthWeb(query: string, opts: { maxResults?: number; signal?: AbortSignal } = {}): Promise<SearchResult[]> {
  const q = query.trim().slice(0, 300);
  const apiKey = process.env.TAVILY_API_KEY;
  if (!q || !apiKey || !isFoodHealthQuery(q)) return [];
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query: q,
        search_depth: "basic",
        topic: "general",
        max_results: opts.maxResults ?? 5,
        include_domains: HEALTH_DOMAINS,
        include_answer: false,
      }),
      signal: opts.signal ?? AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`tavily ${res.status}`);
    const json = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    return (json.results ?? [])
      .filter((r) => r.url && isAllowedUrl(r.url))
      .map((r) => ({ title: (r.title ?? r.url!).trim().slice(0, 140), url: r.url!, content: (r.content ?? "").trim().slice(0, 900) }));
  } catch (e) {
    console.warn("web search failed:", e);
    return [];
  }
}

/** La URL es https y de uno de los sitios permitidos (o un subdominio). */
export function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return HEALTH_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
