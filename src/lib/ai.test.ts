import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hasAi, jsonSchema, parseJsonReply, requireModel } from "./ai";

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

  it("jsonSchema arma el response_format", () => {
    expect(jsonSchema("n", { type: "object" })).toEqual({ type: "json_schema", json_schema: { name: "n", schema: { type: "object" }, strict: false } });
  });

  it("parseJsonReply lee el primer mensaje", () => {
    const completion = { choices: [{ message: { content: '{"a":1}' } }] } as never;
    expect(parseJsonReply(completion)).toEqual({ a: 1 });
    expect(parseJsonReply({ choices: [] } as never)).toEqual({});
  });
});
