import "server-only";
import { z } from "zod";
import { completeJson, requireModel } from "./ai";
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

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          raw_text: { type: "string", description: "Texto tal cual en la boleta, o descripción breve de lo que se ve en la foto." },
          name: { type: "string", description: "Nombre normalizado en español, sin marca ni tamaño. Ej: \"Leche evaporada\"." },
          brand: { type: ["string", "null"], description: "Marca si se conoce (GLORIA, LAIVE, BELL'S…)." },
          search_query: {
            type: ["string", "null"],
            description: "Solo para productos de marca: palabras para buscarlo en un supermercado peruano, sin abreviaturas ni tamaño. Ej: \"leche evaporada gloria\".",
          },
          food_ref: { type: ["string", "null"], description: "ref del catálogo que corresponde a este alimento, o null si ninguno encaja." },
          count: { type: "number", description: "Cuántos paquetes o piezas. 1 si es un producto a granel pesado." },
          size: { type: ["number", "null"], description: "Contenido de cada paquete, o el peso total si es a granel. null si no se sabe." },
          size_unit: { type: ["string", "null"], enum: [...UNIT_VALUES, null], description: "Unidad de size." },
          packaged: { type: "boolean", description: "true si es un producto envasado de marca." },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          emoji: { type: ["string", "null"], description: "Un emoji que represente al alimento." },
        },
        required: ["raw_text", "name", "count", "packaged", "confidence"],
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

/** Pide al modelo de visión que liste los alimentos de una foto o boleta. */
export async function analyzeImage(input: { mode: PhotoMode; base64: string; mimeType: string; catalog: CatalogEntry[] }): Promise<VisionItem[]> {
  const reply = await completeJson({
    model: requireModel("INFERHUB_VISION_MODEL"),
    messages: [
      { role: "system", content: systemPrompt(input.mode, input.catalog) },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${input.mimeType};base64,${input.base64}`, detail: "high" } },
          { type: "text", text: input.mode === "receipt" ? "Lista los alimentos de esta boleta." : "Lista los alimentos de esta foto." },
        ],
      },
    ],
    name: "food_items",
    schema: RESPONSE_SCHEMA,
  });

  const parsed = ResultSchema.safeParse(reply);
  if (!parsed.success) throw new Error("invalid vision response");
  return parsed.data.items;
}
