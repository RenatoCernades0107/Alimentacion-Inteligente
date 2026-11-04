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
  /**
   * Tiempo total (ms) para responder, sumando reintentos. Cada llamada usa lo que queda (sin los
   * reintentos automáticos del SDK, que con su plazo por defecto de 10 min pasaban el límite de la función).
   */
  budgetMs?: number;
  /** Para mostrar en vivo lo que piensa el modelo: con esto las llamadas se hacen en streaming. */
  hooks?: StreamHooks;
};

export type StreamHooks = {
  /** Trozo nuevo del razonamiento del modelo (si el proveedor lo expone). */
  onReasoning?: (delta: string) => void;
  /** El modelo empezó a escribir la respuesta final. */
  onAnswerStart?: () => void;
};

type Params = Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, "stream">;

/**
 * Una llamada al modelo. Con `hooks` va en streaming (para ir mostrando el razonamiento) y arma la
 * misma respuesta que sin streaming; si el proveedor no acepta streaming, repite la llamada sin él.
 */
async function create(client: OpenAI, params: Params, deadline: number, hooks?: StreamHooks): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  if (!hooks) return client.chat.completions.create(params, callOptions(deadline));
  const acc = chunkAccumulator(hooks);
  try {
    const stream = await client.chat.completions.create({ ...params, stream: true }, callOptions(deadline));
    for await (const chunk of stream) acc.push(chunk);
    return acc.result();
  } catch (e) {
    if (!(e instanceof OpenAI.BadRequestError) || acc.started()) throw e;
    const completion = await client.chat.completions.create(params, callOptions(deadline));
    const reasoning = reasoningOf(completion.choices[0]?.message);
    if (reasoning) hooks.onReasoning?.(reasoning);
    return completion;
  }
}

/** Razonamiento que algunos proveedores agregan al mensaje o al delta (no es parte del estándar). */
function reasoningOf(m: unknown): string {
  const r = m as { reasoning_content?: unknown; reasoning?: unknown } | undefined;
  const v = r?.reasoning_content ?? r?.reasoning;
  return typeof v === "string" ? v : "";
}

/**
 * Junta los trozos de una respuesta en streaming en una respuesta normal: el texto, las llamadas a
 * herramientas (que llegan por partes, por índice) y el razonamiento, que se va pasando a `hooks`. Algunos
 * modelos escriben el razonamiento dentro del texto entre <think>…</think>: también se separa.
 */
export function chunkAccumulator(hooks: StreamHooks = {}) {
  let raw = "";
  let thinkSent = 0;
  let answering = false;
  let any = false;
  let finish: OpenAI.Chat.Completions.ChatCompletion.Choice["finish_reason"] = "stop";
  const calls: { id: string; name: string; args: string }[] = [];

  const content = () => {
    const t = raw.trimStart();
    if (t.startsWith("<think>")) {
      const end = t.indexOf("</think>");
      const thought = end < 0 ? t.slice(7) : t.slice(7, end);
      if (thought.length > thinkSent) {
        hooks.onReasoning?.(thought.slice(thinkSent));
        thinkSent = thought.length;
      }
      return end < 0 ? "" : t.slice(end + 8);
    }
    // Puede ser el comienzo de "<think>" que aún no llega completo.
    return "<think>".startsWith(t) ? "" : raw;
  };

  return {
    push(chunk: OpenAI.Chat.Completions.ChatCompletionChunk) {
      any = true;
      const choice = chunk.choices?.[0];
      if (!choice) return;
      if (choice.finish_reason) finish = choice.finish_reason;
      const d = choice.delta ?? {};
      const reasoning = reasoningOf(d);
      if (reasoning) hooks.onReasoning?.(reasoning);
      if (d.content) {
        raw += d.content;
        if (!answering && content().trim()) {
          answering = true;
          hooks.onAnswerStart?.();
        }
      }
      for (const tc of d.tool_calls ?? []) {
        const slot = (calls[tc.index ?? calls.length] ??= { id: "", name: "", args: "" });
        if (tc.id) slot.id = tc.id;
        const name = tc.function?.name;
        if (name && name !== slot.name) slot.name += name;
        if (tc.function?.arguments) slot.args += tc.function.arguments;
      }
    },
    started: () => any,
    result(): OpenAI.Chat.Completions.ChatCompletion {
      const toolCalls = calls
        .filter(Boolean)
        .map((c, i) => ({ id: c.id || `call_${i}`, type: "function" as const, function: { name: c.name, arguments: c.args } }));
      return {
        id: "",
        object: "chat.completion",
        created: 0,
        model: "",
        choices: [
          {
            index: 0,
            finish_reason: finish,
            logprobs: null,
            message: { role: "assistant", content: content(), refusal: null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
          },
        ],
      };
    },
  };
}

/** Margen mínimo para que valga la pena otra llamada al modelo. */
const MIN_CALL_MS = 6_000;

function deadlineOf(req: JsonRequest) {
  return Date.now() + (req.budgetMs ?? 60_000);
}

/** Opciones por llamada: el tiempo que queda y sin reintentos automáticos. */
function callOptions(deadline: number) {
  return { timeout: Math.max(MIN_CALL_MS, deadline - Date.now()), maxRetries: 0 };
}

function withSchemaHint(req: JsonRequest, messages = req.messages) {
  const hint = `\n\nResponde SOLO con un objeto JSON válido (sin markdown) que cumpla este JSON Schema:\n${JSON.stringify(req.schema)}`;
  return messages.map((m, i) => (i === 0 && m.role === "system" && typeof m.content === "string" ? { ...m, content: m.content + hint } : m));
}

const isUsable = (v: unknown) => !!v && typeof v === "object" && Object.keys(v as object).length > 0;

/**
 * Pide una respuesta JSON que cumpla `schema`. Primero con `json_schema`; si el modelo lo rechaza (400)
 * o responde vacío / sin JSON válido, reintenta una vez con `json_object` y el esquema dentro del prompt
 * (quien llama valida con zod). Respeta `budgetMs` en total.
 */
export async function completeJson(req: JsonRequest, deadline = deadlineOf(req)): Promise<unknown> {
  const client = getClient();
  const base = { model: req.model, temperature: req.temperature, ...(req.reasoningEffort ? { reasoning_effort: req.reasoningEffort } : {}) };
  let firstError: unknown = null;
  try {
    const completion = await create(
      client,
      { ...base, messages: req.messages, response_format: { type: "json_schema", json_schema: { name: req.name, schema: req.schema, strict: false } } },
      deadline,
      req.hooks,
    );
    const parsed = parseJsonReply(completion);
    if (isUsable(parsed)) return parsed;
    firstError = new Error("empty JSON reply");
  } catch (e) {
    if (!(e instanceof OpenAI.BadRequestError) && !(e instanceof SyntaxError) && !(e instanceof JsonReplyError)) throw e;
    firstError = e;
  }
  if (deadline - Date.now() < MIN_CALL_MS) throw firstError;
  console.warn("json_schema reply unusable, retrying with json_object:", firstError instanceof Error ? firstError.message : firstError);
  const completion = await create(client, { ...base, messages: withSchemaHint(req), response_format: { type: "json_object" } }, deadline, req.hooks);
  return parseJsonReply(completion);
}

export class JsonReplyError extends Error {}

/**
 * Contenido de la primera respuesta, parseado como JSON. Tolera ```json … ```, texto alrededor y
 * saltos de línea o tabs crudos dentro de los textos (algunos modelos los mandan sin escapar).
 */
export function parseJsonReply(completion: OpenAI.Chat.Completions.ChatCompletion): unknown {
  // Algunos modelos ponen su razonamiento antes de la respuesta, entre <think>…</think>.
  const text = (completion.choices[0]?.message?.content ?? "").replace(/^\s*<think>[\s\S]*?<\/think>/, "").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) {
      console.warn("model reply is not JSON:", text.slice(0, 300));
      throw new JsonReplyError("model reply is not JSON");
    }
    const body = text.slice(start, end + 1);
    try {
      return JSON.parse(body);
    } catch {
      try {
        return JSON.parse(escapeControlChars(body));
      } catch (e) {
        console.warn("model reply is not valid JSON:", body.slice(0, 300));
        throw new JsonReplyError(e instanceof Error ? e.message : "invalid JSON");
      }
    }
  }
}

/** Escapa los caracteres de control que aparecen dentro de strings JSON (fuera de ellos no se tocan). */
export function escapeControlChars(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      else if (ch < " ") {
        out += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : ch === "\t" ? "\\t" : "";
        continue;
      }
    } else if (ch === '"') inString = true;
    out += ch;
  }
  return out;
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
 * responder. Hace como mucho `maxRounds` rondas de herramientas (menos si se acaba el tiempo); en la
 * última se le pide responder sin más llamadas. Si el proveedor no acepta herramientas o la respuesta
 * final no sirve, responde con `completeJson` pasándole en el prompt lo que devolvieron las herramientas.
 */
export async function completeJsonWithTools(req: JsonRequest & { tools: Tool[]; maxRounds?: number }): Promise<unknown> {
  const deadline = deadlineOf(req);
  if (!req.tools.length) return completeJson(req, deadline);
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
    if (!notes.length) return completeJson(req, deadline);
    const extra = `\n\nResultados de las herramientas que ya consultaste en este turno:\n${notes.join("\n\n")}`;
    return completeJson(
      { ...req, messages: req.messages.map((m, i) => (i === 0 && m.role === "system" && typeof m.content === "string" ? { ...m, content: m.content + extra } : m)) },
      deadline,
    );
  };

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await create(client, { ...base, messages, tool_choice: "auto" }, deadline, req.hooks);
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
      if (deadline - Date.now() < MIN_CALL_MS) throw new Error("chef deadline reached");
      const last = round === maxRounds - 1;
      completion = await create(client, { ...base, messages, tool_choice: last ? "none" : "auto" }, deadline, req.hooks);
    }
  } catch (e) {
    if (!(e instanceof OpenAI.BadRequestError)) throw e;
    console.warn("tools rejected, answering without them:", e.message);
    return fallback();
  }
  try {
    const parsed = parseJsonReply(completion);
    if (isUsable(parsed)) return parsed;
  } catch {
    // cae al respaldo
  }
  if (deadline - Date.now() < MIN_CALL_MS) throw new Error("chef deadline reached");
  return fallback();
}
