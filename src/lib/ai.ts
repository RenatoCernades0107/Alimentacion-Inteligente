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

/** `response_format` para pedir una respuesta JSON que cumpla `schema`. */
export function jsonSchema(name: string, schema: Record<string, unknown>) {
  return { type: "json_schema" as const, json_schema: { name, schema, strict: false } };
}

/** Contenido de la primera respuesta, parseado como JSON. */
export function parseJsonReply(completion: OpenAI.Chat.Completions.ChatCompletion): unknown {
  return JSON.parse(completion.choices[0]?.message?.content ?? "{}");
}
