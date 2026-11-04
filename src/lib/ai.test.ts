import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hasAi, parseJsonReply, requireModel } from "./ai";

describe("ai", () => {
  it("hasAi depende de INFERHUB_API_KEY", () => {
    vi.stubEnv("INFERHUB_API_KEY", "");
    expect(hasAi()).toBe(false);
    vi.stubEnv("INFERHUB_API_KEY", "sk-test");
    expect(hasAi()).toBe(true);
    vi.unstubAllEnvs();
  });

  it("requireModel lanza si falta el modelo", () => {
    vi.stubEnv("INFERHUB_CHAT_MODEL", "");
    expect(() => requireModel("INFERHUB_CHAT_MODEL")).toThrow("INFERHUB_CHAT_MODEL");
    vi.stubEnv("INFERHUB_CHAT_MODEL", "x/y");
    expect(requireModel("INFERHUB_CHAT_MODEL")).toBe("x/y");
    vi.unstubAllEnvs();
  });

  it("parseJsonReply tolera cercas de markdown y texto alrededor", () => {
    const wrap = (content: string) => ({ choices: [{ message: { content } }] }) as never;
    expect(parseJsonReply(wrap('```json\n{"a":1}\n```'))).toEqual({ a: 1 });
    expect(parseJsonReply(wrap('Aquí va: {"a":{"b":2}} listo'))).toEqual({ a: { b: 2 } });
    expect(() => parseJsonReply(wrap("sin json"))).toThrow();
  });

  it("parseJsonReply lee el primer mensaje", () => {
    const completion = { choices: [{ message: { content: '{"a":1}' } }] } as never;
    expect(parseJsonReply(completion)).toEqual({ a: 1 });
    expect(parseJsonReply({ choices: [] } as never)).toEqual({});
  });
});

describe("streaming", () => {
  type Chunk = import("openai").OpenAI.Chat.Completions.ChatCompletionChunk;
  const chunk = (delta: Record<string, unknown>, finish: string | null = null) =>
    ({ id: "", object: "chat.completion.chunk", created: 0, model: "", choices: [{ index: 0, delta, finish_reason: finish }] }) as unknown as Chunk;

  it("junta el texto y pasa el razonamiento (reasoning_content o reasoning)", async () => {
    const { chunkAccumulator } = await import("./ai");
    const thoughts: string[] = [];
    let started = 0;
    const acc = chunkAccumulator({ onReasoning: (t) => thoughts.push(t), onAnswerStart: () => started++ });
    acc.push(chunk({ reasoning_content: "Pienso " }));
    acc.push(chunk({ reasoning: "en pollo." }));
    acc.push(chunk({ content: '{"message":' }));
    acc.push(chunk({ content: '"hola"}' }, "stop"));
    expect(thoughts).toEqual(["Pienso ", "en pollo."]);
    expect(started).toBe(1);
    expect(parseJsonReply(acc.result())).toEqual({ message: "hola" });
  });

  it("arma las llamadas a herramientas que llegan por partes", async () => {
    const { chunkAccumulator } = await import("./ai");
    const acc = chunkAccumulator();
    acc.push(chunk({ tool_calls: [{ index: 0, id: "c1", type: "function", function: { name: "buscar_web", arguments: '{"consu' } }] }));
    acc.push(chunk({ tool_calls: [{ index: 0, function: { arguments: 'lta":"hierro"}' } }] }));
    acc.push(chunk({ tool_calls: [{ index: 1, id: "c2", function: { name: "buscar_web", arguments: "{}" } }] }, "tool_calls"));
    const msg = acc.result().choices[0].message;
    expect(msg.tool_calls).toEqual([
      { id: "c1", type: "function", function: { name: "buscar_web", arguments: '{"consulta":"hierro"}' } },
      { id: "c2", type: "function", function: { name: "buscar_web", arguments: "{}" } },
    ]);
    expect(acc.result().choices[0].finish_reason).toBe("tool_calls");
  });

  it("separa el razonamiento escrito entre <think> del texto", async () => {
    const { chunkAccumulator } = await import("./ai");
    const thoughts: string[] = [];
    const acc = chunkAccumulator({ onReasoning: (t) => thoughts.push(t) });
    for (const c of ["<thi", "nk>Primero ", "la proteína", "</think>", '{"a":1}']) acc.push(chunk({ content: c }));
    expect(thoughts.join("")).toBe("Primero la proteína");
    expect(acc.result().choices[0].message.content).toBe('{"a":1}');
  });

  it("parseJsonReply ignora un bloque <think> al inicio", () => {
    const completion = { choices: [{ message: { content: '<think>{no es json}</think>\n{"ok":true}' } }] } as never;
    expect(parseJsonReply(completion)).toEqual({ ok: true });
  });
});
