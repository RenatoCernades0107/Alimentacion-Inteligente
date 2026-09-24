import "server-only";
import { GoogleGenAI, MediaResolution, ThinkingLevel, Type, type Schema } from "@google/genai";
import { z } from "zod";
import type { PhotoMode } from "./photo";

/** Alimento del catálogo que se le muestra al modelo para que haga el match. */
export type CatalogEntry = { ref: string; name: string; aliases: string[] };

const UNIT_VALUES = ["unit", "g", "kg", "ml", "l"] as const;

const ItemSchema = z.object({
  raw_text: z.string(),
  name: z.string().min(1),
  brand: z.string().nullish(),
  search_query: z.string().nullish(),
  food_ref: z.string().nullish(),
  count: z.number().positive().catch(1),
  size: z.number().positive().nullish().catch(null),
  size_unit: z.enum(UNIT_VALUES).nullish().catch(null),
  packaged: z.boolean().catch(false),
  confidence: z.enum(["high", "medium", "low"]).catch("medium"),
  emoji: z.string().nullish(),
});
const ResultSchema = z.object({ items: z.array(ItemSchema) });

export type VisionItem = z.infer<typeof ItemSchema>;

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          raw_text: { type: Type.STRING, description: "Texto tal cual en la boleta, o descripción breve de lo que se ve en la foto." },
          name: { type: Type.STRING, description: "Nombre normalizado en español, sin marca ni tamaño. Ej: \"Leche evaporada\"." },
          brand: { type: Type.STRING, nullable: true, description: "Marca si se conoce (GLORIA, LAIVE, BELL'S…)." },
          search_query: {
            type: Type.STRING,
            nullable: true,
            description: "Solo para productos de marca: palabras para buscarlo en un supermercado peruano, sin abreviaturas ni tamaño. Ej: \"leche evaporada gloria\".",
          },
          food_ref: { type: Type.STRING, nullable: true, description: "ref del catálogo que corresponde a este alimento, o null si ninguno encaja." },
          count: { type: Type.NUMBER, description: "Cuántos paquetes o piezas. 1 si es un producto a granel pesado." },
          size: { type: Type.NUMBER, nullable: true, description: "Contenido de cada paquete, o el peso total si es a granel. null si no se sabe." },
          size_unit: { type: Type.STRING, nullable: true, enum: [...UNIT_VALUES], description: "Unidad de size." },
          packaged: { type: Type.BOOLEAN, description: "true si es un producto envasado de marca." },
          confidence: { type: Type.STRING, enum: ["high", "medium", "low"] },
          emoji: { type: Type.STRING, nullable: true, description: "Un emoji que represente al alimento." },
        },
        required: ["raw_text", "name", "count", "packaged", "confidence"],
        propertyOrdering: ["raw_text", "name", "brand", "search_query", "food_ref", "count", "size", "size_unit", "packaged", "confidence", "emoji"],
      },
    },
  },
  required: ["items"],
};

const COMMON_RULES = `Eres el asistente de una app peruana de inventario de comida familiar.
Tu tarea es listar los alimentos que se ven en una imagen para agregarlos al inventario de la familia.

Reglas:
- Solo alimentos y bebidas. Ignora productos de limpieza, higiene, bolsas, utensilios, etc.
- food_ref: elige el alimento del catálogo que mejor corresponda (un producto de marca también corresponde a su genérico: "Leche GLORIA evaporada" → leche evaporada o leche). Usa exactamente el ref del catálogo. Si ninguno encaja razonablemente, usa null (no fuerces un match).
- Si el mismo alimento aparece varias veces, júntalo en un solo ítem sumando count.
- Unidades permitidas: unit, g, kg, ml, l.
- confidence: low si no estás seguro de qué es.`;

const MODE_RULES: Record<PhotoMode, string> = {
  receipt: `La imagen es una boleta o ticket de compra de un supermercado peruano (Plaza Vea, Wong, Tottus, Tambo, Metro, Makro, Vivanda…).
- Cada línea de producto es un ítem. Ignora totales, subtotales, IGV, descuentos, redondeos, bolsas plásticas, medios de pago y datos del cliente o la tienda.
- Las boletas abrevian mucho: interpreta abreviaturas como LCH/LECH=leche, EVAP=evaporada, PQ/PAQ=paquete, BOT=botella, DP/DOYP=doypack, UN/UND=unidad, X6/6X=pack de 6, AZ=azul, ENT=entera, DESC=descremada, POLL=pollo, FIL=filete, PECH=pechuga, TOM=tomate, CEB=cebolla, PAP=papa, ARR=arroz, AZUC=azúcar, ACEIT=aceite, MANT=mantequilla, YOG=yogurt, QSO=queso, HUEV=huevo, GAS=gaseosa.
- Cantidad: "2 X LECHE GLORIA 400G" → count 2, size 400, size_unit g. Un producto pesado "TOMATE KG 1.254" → count 1, size 1.254, size_unit kg. Un pack "YOGURT X6 1KG" → count 6 si son unidades separadas.
- raw_text: la línea tal como aparece en la boleta.`,
  food: `La imagen es una foto de alimentos (sobre una mesa, en la refrigeradora o en bolsas de compra).
- Cuenta las piezas visibles (count) cuando sea razonable: 5 tomates → count 5, size null.
- Si ves un producto envasado con la etiqueta legible, indica marca y tamaño; si no, deja size en null.
- raw_text: descripción breve de lo que ves ("3 plátanos maduros", "botella de aceite Primor 1 L").`,
};

function systemPrompt(mode: PhotoMode, catalog: CatalogEntry[]) {
  const lines = catalog.map((c) => `${c.ref} | ${c.name}${c.aliases.length ? ` | ${c.aliases.join(", ")}` : ""}`);
  return `${COMMON_RULES}\n\n${MODE_RULES[mode]}\n\nCatálogo (ref | nombre | alias):\n${lines.join("\n")}`;
}

/** Pide a Gemini que liste los alimentos de una foto o boleta. */
export async function analyzeImage(input: { mode: PhotoMode; base64: string; mimeType: string; catalog: CatalogEntry[] }): Promise<VisionItem[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: input.base64, mimeType: input.mimeType } },
          { text: input.mode === "receipt" ? "Lista los alimentos de esta boleta." : "Lista los alimentos de esta foto." },
        ],
      },
    ],
    config: {
      systemInstruction: systemPrompt(input.mode, input.catalog),
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
    },
  });

  const parsed = ResultSchema.safeParse(JSON.parse(response.text ?? "{}"));
  if (!parsed.success) throw new Error("invalid vision response");
  return parsed.data.items;
}
