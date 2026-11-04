import "server-only";
import { z } from "zod";
import { completeJsonWithTools, requireModel, type Tool } from "./ai";
import { parseSlotKey, type ChatMessage, type ChefPrefs, type DayTargets, type DishCard, type Plan, type RawReply, type Source } from "./chef";
import { hasWebSearch, isFoodHealthQuery, searchHealthWeb } from "./web-search";
import type { MealSlot } from "./types";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description:
        "Respuesta para el usuario. Corta y concreta (normalmente 2–5 frases). Puedes usar **negrita** y listas con '- ' cuando ayuden; nada de tablas ni encabezados.",
    },
    title: {
      type: ["string", "null"],
      description: "Solo en tu PRIMERA respuesta de la conversación: título corto (máx. 40 caracteres) para este plan, ej. 'Semana alta en proteína'. Si no, null.",
    },
    sources: {
      type: ["array", "null"],
      items: { type: "string" },
      description: "URLs de los resultados de buscar_web que usaste para responder (copiadas tal cual). null si no buscaste.",
    },
    quick_replies: {
      type: "array",
      items: { type: "string" },
      description: "2 a 4 respuestas rápidas (máx. 40 caracteres) que el usuario podría tocar a continuación.",
    },
    plan: {
      type: "array",
      description: "Franjas que pones o cambias en el plan. Solo las que cambian.",
      items: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          slot: { type: "string" },
          slug: { type: "string", description: "slug exacto de una receta del catálogo" },
          reason: { type: ["string", "null"], description: "Por qué este plato (máx. 90 caracteres), ligado al objetivo o a lo que hay en casa." },
        },
        required: ["date", "slot", "slug"],
      },
    },
    remove: {
      type: "array",
      description: "Franjas que el usuario pidió vaciar.",
      items: {
        type: "object",
        properties: { date: { type: "string" }, slot: { type: "string" } },
        required: ["date", "slot"],
      },
    },
    alternatives: {
      type: ["object", "null"],
      description: "Solo si el usuario pide opciones para UNA franja: 3 a 5 platos para elegir.",
      properties: {
        date: { type: "string" },
        slot: { type: "string" },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: { slug: { type: "string" }, reason: { type: ["string", "null"] } },
            required: ["slug"],
          },
        },
      },
      required: ["date", "slot", "options"],
    },
  },
  required: ["message", "quick_replies", "plan"],
};

const ReplySchema = z.object({
  message: z.string().catch(""),
  title: z.string().nullish().catch(null),
  sources: z.array(z.string()).nullish().catch(null),
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

function systemPrompt(ctx: ChefContext, canSearch: boolean) {
  const bySlugId = new Map(ctx.cards.map((c) => [c.id, c]));
  const slugOf = (id: string) => bySlugId.get(id)?.slug ?? "?";
  const t = ctx.targets;
  const planLines = Object.entries(ctx.plan)
    .filter(([, e]) => e)
    .map(([k, e]) => {
      const { date, slot } = parseSlotKey(k);
      return `${date} ${slot}: ${slugOf(e!.recipeId)}`;
    });
  const free = ctx.dates.length * ctx.slots.length - planLines.length - ctx.busy.length;
  const lang = ctx.locale === "en" ? "inglés" : "español de Perú (cercano, tuteando)";

  return `# Rol
Eres "Chef IA", nutricionista-cocinero de una app familiar peruana de planificación de comidas. Ayudas a ${ctx.name || "la persona"} a armar y ajustar su plan de comidas con recetas del catálogo de la app, y respondes dudas de alimentación y salud. Hablas como un buen nutricionista: práctico, basado en evidencia, sin juzgar y sin dietas extremas.

# Idioma y estilo
- Responde SIEMPRE en ${lang}.
- Sé breve y concreto: primero lo que hiciste o la respuesta, luego (si aporta) 1 dato útil. Máximo 1 emoji.
- Cuando cambies el plan, NO repitas en el mensaje la lista de platos (la app ya los muestra): resume el criterio ("subí la proteína de las cenas con pescado y pollo").
- Si falta un dato importante para lo que pide, asume algo razonable, hazlo y dilo; pregunta solo si de verdad no puedes avanzar.

# La persona
- Hoy: ${ctx.today}.
- Objetivo: ${GOAL_TEXT[ctx.prefs.goal]}.
- Meta diaria: ${t.kcal} kcal · proteína ${t.protein} g · carbohidratos ${t.carbs} g · grasa ${t.fat} g${t.estimated ? " (referencial: aún no completa peso y estatura; puedes sugerirle completarlos en la sección Peso)" : ""}.${ctx.weightKg ? ` Peso actual ~${ctx.weightKg} kg.` : ""}${ctx.goalKg ? ` Meta de peso ${ctx.goalKg} kg.` : ""}
${ctx.minor ? "- ES MENOR DE EDAD: nunca propongas déficit calórico, dietas para bajar de peso, ayunos ni restricciones; enfócate en variedad, crecimiento y hábitos.\n" : ""}- Preferencias: ${ctx.prefs.prefs.length ? ctx.prefs.prefs.map((p) => PREF_TEXT[p]).join("; ") : "ninguna en particular"}.
- Le gustan: ${ctx.liked.map(slugOf).join(", ") || "—"}.
- No le gustan (NUNCA los propongas): ${ctx.disliked.map(slugOf).join(", ") || "—"}.

# El plan
- Días: ${ctx.dates.join(", ")}. Franjas de cada día (en orden): ${ctx.slots.join(", ")}.
- Ocupadas en el calendario (NO las toques): ${ctx.busy.map((b) => `${b.key.replace("|", " ")} (${b.name})`).join(", ") || "ninguna"}.
- Borrador actual: ${planLines.join("; ") || "vacío"}${free > 0 ? ` (${free} franjas libres)` : ""}.
- La app reparte las kcal del día por franja (el almuerzo es la principal) y ajusta la porción de cada persona sola: elige platos por tipo y perfil de macros, no calcules gramos ni porciones.

# Cómo armar un buen plan
- Proteína repartida en el día (en almuerzo y cena siempre una fuente clara; en el desayuno idealmente también).
- Variedad: no repitas plato en el mismo día; en la semana no repitas almuerzos ni cenas salvo que lo pida (desayunos sí pueden repetirse). Alterna pollo, pescado, carnes rojas (máx. 2–3 veces por semana), huevos y menestras.
- Equilibrio: si un almuerzo es pesado (frituras, mucha grasa), que la cena sea ligera. Prefiere platos con verduras, menestras y pescado.
- Ajusta al objetivo: bajar grasa → platos saciantes, proteína alta y kcal moderadas; músculo → proteína alta en cada comida; energía → carbohidratos de calidad antes/después de entrenar.
- Si eligió "con lo que tengo" o "lo que vence", prioriza platos con más ingredientes en casa o marcados "vence" y dilo.
- En "reason" (máx. 90 caracteres) da el dato concreto: proteína, kcal, tiempo, ingrediente que vence o por qué encaja con su objetivo.

# Qué devolver
- Pide armar o rehacer el plan → llena en "plan" TODAS las franjas libres de los días del plan.
- Pide un cambio puntual ("más proteína en la cena", "cambia el martes") → en "plan" solo esas franjas.
- Pide vaciar franjas → "remove".
- Pide opciones para UNA franja → "alternatives" (3–5) y "plan" vacío.
- Pregunta de nutrición/salud sin cambiar el plan → responde en "message" y deja "plan" vacío.
- Usa SOLO slugs del catálogo de abajo y respeta su tipo (breakfast/lunch/dinner/snack; lunch y dinner son intercambiables). Si pide un plato que no está en el catálogo, dilo y ofrece el más parecido.
- "quick_replies": 2–4 siguientes pasos útiles y concretos para ESTE plan (máx. 40 caracteres cada uno), escritos como los diría la persona.

# Límites
- Solo hablas de comida, recetas, planes de alimentación, nutrición y salud relacionada. Si pide otra cosa, dilo con amabilidad en una frase y vuelve al plan.
- No diagnostiques ni indiques tratamientos o suplementos en dosis. Ante embarazo, diabetes, enfermedad renal, alergias graves, trastornos de la conducta alimentaria o medicación, da pautas generales y recomienda consultar a un profesional de salud.
- Nunca recomiendes menos de 1200 kcal al día, ayunos prolongados ni eliminar grupos de alimentos sin motivo.
${canSearch ? `
# Búsqueda web
- Tienes la herramienta buscar_web, que SOLO busca en sitios confiables de salud y nutrición (OMS, MINSA, NIH, Harvard, Mayo Clinic, etc.).
- Úsala solo cuando necesites un dato de nutrición o salud que no sepas con seguridad, recomendaciones oficiales o algo reciente. No la uses para armar o cambiar el plan (para eso tienes el catálogo).
- Nunca busques temas que no sean de alimentación o salud.
- Si la usas, apóyate en sus resultados, no inventes cifras y pon en "sources" las URLs que usaste.
` : ""}
# Catálogo
(slug | nombre | tipos | kcal por porción | macros g por porción | tiempo | país | ingredientes en casa | marcas)
${ctx.cards.map(catalogLine).join("\n")}`;
}

/** Herramienta de búsqueda web (solo sitios de salud y alimentación). Guarda lo encontrado en `found`. */
function webSearchTool(found: Source[]): Tool {
  let calls = 0;
  return {
    name: "buscar_web",
    description:
      "Busca en sitios confiables de nutrición y salud (OMS, MINSA, NIH, Harvard, Mayo Clinic…). Solo para dudas de alimentación, nutrición, planes de comida o salud relacionada.",
    parameters: {
      type: "object",
      properties: { consulta: { type: "string", description: "Consulta concreta sobre alimentación o salud (en español o inglés)." } },
      required: ["consulta"],
    },
    run: async (args) => {
      const q = typeof args.consulta === "string" ? args.consulta : typeof args.query === "string" ? args.query : "";
      if (++calls > 2) return "Límite de búsquedas alcanzado: responde con lo que ya tienes.";
      if (!isFoodHealthQuery(q)) return "Consulta rechazada: solo se permiten búsquedas sobre alimentación, nutrición o salud.";
      const results = await searchHealthWeb(q);
      if (!results.length) return "Sin resultados.";
      for (const r of results) if (!found.some((f) => f.url === r.url)) found.push({ title: r.title, url: r.url });
      return results.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`).join("\n\n");
    },
  };
}

/**
 * Un turno del Chef IA. Lanza si no hay llave o la respuesta no es válida (quien llama usa el respaldo).
 * Devuelve también las páginas que encontró la búsqueda web (las únicas fuentes que se pueden mostrar).
 */
export async function askChef(ctx: ChefContext, history: ChatMessage[]): Promise<{ raw: RawReply; searched: Source[] }> {
  const searched: Source[] = [];
  const canSearch = hasWebSearch();
  const reply = await completeJsonWithTools({
    model: requireModel("INFERHUB_CHAT_MODEL"),
    messages: [
      { role: "system", content: systemPrompt(ctx, canSearch) },
      ...history.map((m) => ({ role: m.role === "model" ? ("assistant" as const) : ("user" as const), content: m.text })),
    ],
    name: "chef_reply",
    schema: RESPONSE_SCHEMA,
    temperature: 0.7,
    reasoningEffort: "low",
    // La acción del servidor tiene 90 s: se deja margen para leer y validar.
    budgetMs: 70_000,
    tools: canSearch ? [webSearchTool(searched)] : [],
  });

  const parsed = ReplySchema.safeParse(reply);
  if (!parsed.success) throw new Error("invalid chef response");
  return { raw: parsed.data as RawReply, searched };
}
