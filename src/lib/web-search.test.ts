import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isAllowedUrl, isFoodHealthQuery, searchHealthWeb } from "./web-search";

describe("búsqueda web del Chef", () => {
  it("solo acepta consultas de alimentación o salud", () => {
    expect(isFoodHealthQuery("¿Cuánta proteína necesito al día?")).toBe(true);
    expect(isFoodHealthQuery("recomendaciones OMS de azúcar")).toBe(true);
    expect(isFoodHealthQuery("healthy breakfast ideas")).toBe(true);
    expect(isFoodHealthQuery("resultado del partido de fútbol")).toBe(false);
    expect(isFoodHealthQuery("weather in Lima tomorrow")).toBe(false);
    expect(isFoodHealthQuery("precio del dólar en pesos")).toBe(false);
  });

  it("solo acepta sitios de la lista (y sus subdominios) por https", () => {
    expect(isAllowedUrl("https://www.who.int/news")).toBe(true);
    expect(isAllowedUrl("https://ods.od.nih.gov/factsheets")).toBe(true);
    expect(isAllowedUrl("https://evilwho.int/x")).toBe(false);
    expect(isAllowedUrl("http://www.who.int/x")).toBe(false);
    expect(isAllowedUrl("https://example.com")).toBe(false);
  });

  it("no llama a la API si la consulta no es del tema o no hay llave", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.stubEnv("TAVILY_API_KEY", "k");
    expect(await searchHealthWeb("cotización bitcoin")).toEqual([]);
    vi.stubEnv("TAVILY_API_KEY", "");
    expect(await searchHealthWeb("proteína en el huevo")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    fetchSpy.mockRestore();
  });

  it("restringe la búsqueda a los sitios permitidos y descarta resultados de otros", async () => {
    vi.stubEnv("TAVILY_API_KEY", "k");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { title: "Proteína", url: "https://www.mayoclinic.org/p", content: "..." },
            { title: "Spam", url: "https://spam.example/p", content: "..." },
          ],
        }),
      ),
    );
    const r = await searchHealthWeb("proteína diaria recomendada");
    expect(r.map((x) => x.url)).toEqual(["https://www.mayoclinic.org/p"]);
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.include_domains).toContain("who.int");
    vi.unstubAllEnvs();
    fetchSpy.mockRestore();
  });
});
