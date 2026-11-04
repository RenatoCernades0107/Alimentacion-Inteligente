import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const create = vi.fn();
vi.mock("openai", () => {
  class BadRequestError extends Error {}
  class OpenAI {
    static BadRequestError = BadRequestError;
    chat = { completions: { create } };
  }
  return { default: OpenAI };
});

import OpenAI from "openai";
import { completeJsonWithTools, type Tool } from "./ai";

const reply = (message: Record<string, unknown>) => ({ choices: [{ message: { role: "assistant", content: null, ...message } }] });
const req = (tools: Tool[]) => ({
  model: "m",
  messages: [{ role: "system" as const, content: "sys" }, { role: "user" as const, content: "hola" }],
  name: "x",
  schema: { type: "object" },
  tools,
});

describe("completeJsonWithTools", () => {
  beforeEach(() => {
    create.mockReset();
    vi.stubEnv("INFERHUB_API_KEY", "k");
  });

  it("ejecuta las herramientas que pide el modelo y devuelve el JSON final", async () => {
    const run = vi.fn().mockResolvedValue("resultado");
    create
      .mockResolvedValueOnce(reply({ tool_calls: [{ id: "1", type: "function", function: { name: "buscar_web", arguments: '{"consulta":"proteína"}' } }] }))
      .mockResolvedValueOnce(reply({ content: '{"message":"listo"}' }));
    const out = await completeJsonWithTools(req([{ name: "buscar_web", description: "", parameters: {}, run }]));
    expect(out).toEqual({ message: "listo" });
    expect(run).toHaveBeenCalledWith({ consulta: "proteína" });
    const second = create.mock.calls[1][0];
    expect(second.messages.at(-1)).toEqual({ role: "tool", tool_call_id: "1", content: "resultado" });
  });

  it("en la última ronda ya no deja llamar herramientas", async () => {
    const run = vi.fn().mockResolvedValue("r");
    const call = reply({ tool_calls: [{ id: "1", type: "function", function: { name: "t", arguments: "{}" } }] });
    create.mockResolvedValueOnce(call).mockResolvedValueOnce(call).mockResolvedValueOnce(reply({ content: '{"ok":1}' }));
    expect(await completeJsonWithTools({ ...req([{ name: "t", description: "", parameters: {}, run }]), maxRounds: 2 })).toEqual({ ok: 1 });
    expect(create.mock.calls[2][0].tool_choice).toBe("none");
  });

  it("si el proveedor rechaza herramientas, responde sin ellas", async () => {
    create.mockRejectedValueOnce(new (OpenAI.BadRequestError as unknown as new (m: string) => Error)("no tools")).mockResolvedValueOnce(reply({ content: '{"message":"sin tools"}' }));
    const out = await completeJsonWithTools(req([{ name: "t", description: "", parameters: {}, run: vi.fn() }]));
    expect(out).toEqual({ message: "sin tools" });
    expect(create.mock.calls[1][0].tools).toBeUndefined();
  });
});

import { completeJson, escapeControlChars, parseJsonReply } from "./ai";

describe("respuestas JSON robustas", () => {
  beforeEach(() => {
    create.mockReset();
    vi.stubEnv("INFERHUB_API_KEY", "k");
  });

  it("acepta saltos de línea crudos dentro de los textos", () => {
    const raw = '{"message":"Hola\nmundo\t!","plan":[]}';
    expect(escapeControlChars(raw)).toBe('{"message":"Hola\\nmundo\\t!","plan":[]}');
    expect(parseJsonReply(reply({ content: "```json\n" + raw + "\n```" }) as never)).toEqual({ message: "Hola\nmundo\t!", plan: [] });
  });

  it("si la primera respuesta llega vacía, reintenta con json_object", async () => {
    create.mockResolvedValueOnce(reply({ content: "" })).mockResolvedValueOnce(reply({ content: '{"message":"ok"}' }));
    expect(await completeJson({ ...req([]), budgetMs: 30_000 })).toEqual({ message: "ok" });
    expect(create.mock.calls[1][0].response_format).toEqual({ type: "json_object" });
  });

  it("cada llamada tiene plazo y no usa los reintentos automáticos del SDK", async () => {
    create.mockResolvedValueOnce(reply({ content: '{"message":"ok"}' }));
    await completeJson({ ...req([]), budgetMs: 30_000 });
    const opts = create.mock.calls[0][1];
    expect(opts.maxRetries).toBe(0);
    expect(opts.timeout).toBeLessThanOrEqual(30_000);
  });

  it("los errores de red no se reintentan en silencio", async () => {
    create.mockRejectedValueOnce(new Error("timeout"));
    await expect(completeJson({ ...req([]), budgetMs: 30_000 })).rejects.toThrow("timeout");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
