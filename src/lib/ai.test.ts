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
