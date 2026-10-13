import "server-only";
import { GoogleGenAI, ThinkingLevel, Type, type Content, type Schema } from "@google/genai";
import { z } from "zod";
import { parseSlotKey, type ChatMessage, type ChefPrefs, type DayTargets, type DishCard, type Plan, type RawReply } from "./chef";
import type { MealSlot } from "./types";

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    message: { type: Type.STRING, description: "Respuesta breve y cálida para el usuario (2–4 frases, sin listas largas ni markdown pesado)." },
    quick_replies: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2 a 4 respuestas rápidas (máx. 40 caracteres) que el usuario podría tocar a continuación.",
    },
    plan: {
      type: Type.ARRAY,
      description: "Franjas que pones o cambias en el plan. Solo las que cambian.",
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "YYYY-MM-DD" },
          slot: { type: Type.STRING },
          slug: { type: Type.STRING, description: "slug exacto de una receta del catálogo" },
          reason: { type: Type.STRING, nullable: true, description: "Por qué este plato (máx. 90 caracteres), ligado al objetivo o a lo que hay en casa." },
        },
        required: ["date", "slot", "slug"],
        propertyOrdering: ["date", "slot", "slug", "reason"],
      },
    },
    remove: {
      type: Type.ARRAY,
      description: "Franjas que el usuario pidió vaciar.",
      items: {
        type: Type.OBJECT,
        properties: { date: { type: Type.STRING }, slot: { type: Type.STRING } },
        required: ["date", "slot"],
      },
    },
    alternatives: {
      type: Type.OBJECT,
      nullable: true,
      description: "Solo si el usuario pide opciones para UNA franja: 3 a 5 platos para elegir.",
      properties: {
        date: { type: Type.STRING },
        slot: { type: Type.STRING },
        options: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { slug: { type: Type.STRING }, reason: { type: Type.STRING, nullable: true } },
            required: ["slug"],
          },
        },
      },
      required: ["date", "slot", "options"],
    },
  },
  required: ["message", "quick_replies", "plan"],
  propertyOrdering: ["message", "plan", "remove", "alternatives", "quick_replies"],
};

const ReplySchema = z.object({
  message: z.string().catch(""),
  quick_replies: z.array(z.string()).catch([]),
  plan: z.array(z.object({ date: z.string(), slot: z.string(), slug: z.string(), reason: z.string().nullish() })).catch([]),
  remove: z.array(z.object({ date: z.string(), slot: z.string() })).nullish().catch([]),
  alternatives: z
    .object({ date: z.string(), slot: z.string(), options: z.array(z.object({ slug: z.string(), reason: z.string().nullish() })) })
    .nullish()
    .catch(null),
});

const GOAL_TEXT: Record<ChefPrefs["goal"], string> = {
  lose: "bajar grasa de forma saludable (déficit moderado ya incluido en sus kcal; prioriza saciedad y proteína)",
  muscle: "ganar músculo (proteína alta en cada comida, carbohidratos suficientes)",
  maintain: "mantener su peso con comidas equilibradas",
  healthy: "comer más sano y variado (más verduras, menestras y pescado; menos frituras)",
  energy: "tener energía para entrenar (carbohidratos de calidad, proteína moderada)",
};

const PREF_TEXT: Record<ChefPrefs["prefs"][number], string> = {
  pantry: "usar lo que ya tiene en casa (prioriza recetas con más ingredientes en casa)",
  expiring: "aprovechar los alimentos que vencen pronto (marcados 'vence')",
  quick: "recetas rápidas (≤ 40 min)",
  peruvian: "comida peruana",
  american: "comida estadounidense",
  veggie: "sin carne ni mariscos",
};

export type ChefContext = {
  locale: "es" | "en";
  name: string;
  today: string;
  prefs: ChefPrefs;
  targets: DayTargets;
  minor: boolean;
  weightKg: number | null;
  goalKg: number | null;
  mealsPerDay: number;
  slots: MealSlot[];
  dates: string[];
  cards: DishCard[];
  plan: Plan;
  busy: { key: string; name: string }[];
  liked: string[];
  disliked: string[];
};

function catalogLine(c: DishCard) {
  const macros = c.protein != null ? `P${c.protein} C${c.carbs} G${c.fat}` : "macros ?";
  const flags = [c.expiring && "vence", !c.meat && "sin carne"].filter(Boolean).join(",");
  return `${c.slug} | ${c.name_es} | ${c.meal_types.join("/")} | ${c.kcal ?? "?"} kcal | ${macros} | ${c.time ?? "?"} min | ${c.country} | casa ${c.have}/${c.total}${flags ? ` | ${flags}` : ""}`;
}

function systemPrompt(ctx: ChefContext) {
  const bySlugId = new Map(ctx.cards.map((c) => [c.id, c]));
  const slugOf = (id: string) => bySlugId.get(id)?.slug ?? "?";
  const t = ctx.targets;
  const planLines = Object.entries(ctx.plan)
    .filter(([, e]) => e)
    .map(([k, e]) => {
      const { date, slot } = parseSlotKey(k);
      return `${date} ${slot}: ${slugOf(e!.recipeId)}`;
    });

  return `Eres "Chef IA", el planificador de comidas de una app familiar peruana. Ayudas a ${ctx.name || "la persona"} a armar su plan de comidas según su objetivo, con recetas del catálogo de la app.

Responde SIEMPRE en ${ctx.locale === "en" ? "inglés" : "español (de Perú, cercano, tuteando)"}. Mensajes cortos, cálidos y concretos; usa como mucho 1 emoji.

Hoy: ${ctx.today}.
Objetivo: ${GOAL_TEXT[ctx.prefs.goal]}.
Meta diaria: ${t.kcal} kcal · proteína ${t.protein} g · carbohidratos ${t.carbs} g · grasa ${t.fat} g${t.estimated ? " (referencial: aún no completa sus datos de peso y estatura)" : ""}.${ctx.weightKg ? ` Peso actual ~${ctx.weightKg} kg.` : ""}${ctx.goalKg ? ` Meta de peso ${ctx.goalKg} kg.` : ""}${ctx.minor ? " Es menor de edad: nunca propongas dietas de bajar de peso ni restricciones." : ""}
Preferencias: ${ctx.prefs.prefs.length ? ctx.prefs.prefs.map((p) => PREF_TEXT[p]).join("; ") : "ninguna en particular"}.
Le gustan: ${ctx.liked.map(slugOf).join(", ") || "—"}. No le gustan (no los propongas): ${ctx.disliked.map(slugOf).join(", ") || "—"}.

Días del plan: ${ctx.dates.join(", ")}. Franjas de cada día (en este orden): ${ctx.slots.join(", ")}. Las kcal del día se reparten por franja (el almuerzo es la principal) y la app ajusta la porción de cada persona automáticamente: elige platos por su tipo y perfil de macros, no te preocupes por cantidades.
Franjas ocupadas en el calendario (NO las cambies): ${ctx.busy.map((b) => `${b.key.replace("|", " ")} (${b.name})`).join(", ") || "ninguna"}.
Plan actual (borrador): ${planLines.join("; ") || "vacío"}.

Reglas:
- Usa SOLO slugs del catálogo de abajo. Respeta el tipo de comida (breakfast/lunch/dinner/snack); un plato de lunch también sirve de dinner y viceversa.
- No repitas el mismo plato en un día. En la semana evita repetir almuerzos y cenas; los desayunos pueden repetirse.
- Prioriza lo que le gusta, el objetivo y sus preferencias; menciona en "reason" el dato concreto (proteína, kcal, ingrediente que vence, tiempo).
- Si pide armar o rehacer el plan, llena todas las franjas libres de los días del plan en "plan".
- Si pide cambiar algo puntual ("más proteína en la cena", "cambia el lunes"), devuelve en "plan" solo esas franjas.
- Si pide ver opciones para una franja, usa "alternatives" (3–5) y deja "plan" vacío.
- Si pide algo que no es de comida, responde amable y vuelve al plan. No des consejos médicos; ante condiciones de salud sugiere consultar a un profesional.
- quick_replies: siguientes pasos útiles y concretos para este plan.

Catálogo (slug | nombre | tipos | kcal por porción | macros g por porción | tiempo | país | ingredientes en casa | marcas):
${ctx.cards.map(catalogLine).join("\n")}`;
}

/** Un turno del Chef IA. Lanza si no hay llave o la respuesta no es válida (quien llama usa el respaldo). */
export async function askChef(ctx: ChefContext, history: ChatMessage[]): Promise<RawReply> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey });

  const contents: Content[] = history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_CHAT_MODEL || "gemini-3-flash-preview",
    contents,
    config: {
      systemInstruction: systemPrompt(ctx),
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      temperature: 0.8,
    },
  });

  const parsed = ReplySchema.safeParse(JSON.parse(response.text ?? "{}"));
  if (!parsed.success) throw new Error("invalid chef response");
  return parsed.data as RawReply;
}
