import "server-only";
import OpenAI from "openai";

const DEFAULT_BASE_URL = "https://api.inferhub.dev/v1";

/** ¿Hay llave de InferHub? Sin ella, las funciones de IA usan su respaldo. */
export function hasAi() {
  return Boolean(process.env.INFERHUB_API_KEY);
}

/** Cliente de InferHub (API compatible con OpenAI). Lanza si no hay llave. */
export function getClient() {
  const apiKey = process.env.INFERHUB_API_KEY;
  if (!apiKey) throw new Error("INFERHUB_API_KEY is not set");
  return new OpenAI({ apiKey, baseURL: process.env.INFERHUB_BASE_URL || DEFAULT_BASE_URL });
}

/** Modelo configurado en el entorno; lanza si falta. */
export function requireModel(envName: "INFERHUB_VISION_MODEL" | "INFERHUB_CHAT_MODEL") {
  const model = process.env[envName];
  if (!model) throw new Error(`${envName} is not set`);
  return model;
}

type JsonRequest = {
  model: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  name: string;
  schema: Record<string, unknown>;
  temperature?: number;
  reasoningEffort?: "low" | "medium" | "high";
};

/**
 * Pide una respuesta JSON que cumpla `schema`. Primero con `json_schema`; si el modelo lo rechaza (400),
 * reintenta una vez con `json_object` y el esquema dentro del prompt (quien llama valida con zod).
 */
export async function completeJson(req: JsonRequest): Promise<unknown> {
  const client = getClient();
  const base = { model: req.model, temperature: req.temperature, ...(req.reasoningEffort ? { reasoning_effort: req.reasoningEffort } : {}) };
  try {
    const completion = await client.chat.completions.create({
      ...base,
      messages: req.messages,
      response_format: { type: "json_schema", json_schema: { name: req.name, schema: req.schema, strict: false } },
    });
    return parseJsonReply(completion);
  } catch (e) {
    if (!(e instanceof OpenAI.BadRequestError)) throw e;
    console.warn("json_schema rejected, retrying with json_object:", e.message);
    const hint = `\n\nResponde SOLO con un objeto JSON válido (sin markdown) que cumpla este JSON Schema:\n${JSON.stringify(req.schema)}`;
    const messages = req.messages.map((m, i) => (i === 0 && m.role === "system" && typeof m.content === "string" ? { ...m, content: m.content + hint } : m));
    const completion = await client.chat.completions.create({ ...base, messages, response_format: { type: "json_object" } });
    return parseJsonReply(completion);
  }
}

/** Contenido de la primera respuesta, parseado como JSON (tolera ```json … ``` y texto alrededor). */
export function parseJsonReply(completion: OpenAI.Chat.Completions.ChatCompletion): unknown {
  const text = (completion.choices[0]?.message?.content ?? "").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("model reply is not JSON");
    return JSON.parse(text.slice(start, end + 1));
  }
}

export type Tool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Ejecuta la herramienta; lo que devuelve se le pasa al modelo como texto. */
  run: (args: Record<string, unknown>) => Promise<string>;
};

/**
 * Como `completeJson`, pero el modelo puede llamar herramientas (ej. buscar en la web) antes de
 * responder. Hace como mucho `maxRounds` rondas de herramientas; en la última se le pide responder sin
 * más llamadas. Si el proveedor no acepta herramientas o la respuesta final no es JSON, responde con
 * `completeJson` pasándole en el prompt lo que devolvieron las herramientas.
 */
export async function completeJsonWithTools(req: JsonRequest & { tools: Tool[]; maxRounds?: number }): Promise<unknown> {
  if (!req.tools.length) return completeJson(req);
  const client = getClient();
  const maxRounds = req.maxRounds ?? 2;
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = req.tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
  const base = {
    model: req.model,
    temperature: req.temperature,
    ...(req.reasoningEffort ? { reasoning_effort: req.reasoningEffort } : {}),
    response_format: { type: "json_schema" as const, json_schema: { name: req.name, schema: req.schema, strict: false } },
    tools,
  };
  const messages = [...req.messages];
  /** Lo que devolvieron las herramientas, por si hay que caer a `completeJson`. */
  const notes: string[] = [];
  const fallback = () => {
    if (!notes.length) return completeJson(req);
    const extra = `\n\nResultados de las herramientas que ya consultaste en este turno:\n${notes.join("\n\n")}`;
    return completeJson({
      ...req,
      messages: req.messages.map((m, i) => (i === 0 && m.role === "system" && typeof m.content === "string" ? { ...m, content: m.content + extra } : m)),
    });
  };

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await client.chat.completions.create({ ...base, messages, tool_choice: "auto" });
    for (let round = 0; round < maxRounds; round++) {
      const msg = completion.choices[0]?.message;
      const calls = (msg?.tool_calls ?? []).filter((c) => c.type === "function");
      if (!msg || !calls.length) break;
      messages.push(msg);
      for (const call of calls) {
        const tool = req.tools.find((t) => t.name === call.function.name);
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          // argumentos inválidos: la herramienta recibe {}
        }
        const out = tool ? await tool.run(args).catch(() => "error") : "unknown tool";
        notes.push(`[${call.function.name}] ${JSON.stringify(args)}\n${out}`);
        messages.push({ role: "tool", tool_call_id: call.id, content: out });
      }
      const last = round === maxRounds - 1;
      completion = await client.chat.completions.create({ ...base, messages, tool_choice: last ? "none" : "auto" });
    }
  } catch (e) {
    if (!(e instanceof OpenAI.BadRequestError)) throw e;
    console.warn("tools rejected, answering without them:", e.message);
    return fallback();
  }
  try {
    const parsed = parseJsonReply(completion);
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length) return parsed;
  } catch {
    // cae al respaldo
  }
  return fallback();
}
