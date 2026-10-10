import "server-only";
import { GoogleGenAI, Modality } from "@google/genai";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/server";

const BUCKET = "dish-images";
/** Si una generación se cuelga, otra pantalla puede reintentar pasado este tiempo. */
const LOCK_MINUTES = 3;

type RecipeForImage = { id: string; name_es: string; name_en: string; description_es: string | null; image_url: string | null };

/**
 * Foto del plato de una receta: si no tiene, la genera con el modelo de imágenes de Gemini, la guarda
 * como WebP en el bucket público `dish-images` y la anota en `recipes.image_url` (con la service role:
 * los usuarios no pueden escribir recetas directamente). Devuelve la URL o null si no se pudo.
 *
 * Quien llama ya verificó con el cliente del usuario (RLS) que la receta es visible para él.
 * `image_requested_at` hace de candado para no generar dos fotos de la misma receta a la vez.
 */
export async function ensureDishImage(recipeId: string, ingredientNames: string[]): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const admin = createAdminClient();

  const { data: claimed } = await admin
    .from("recipes")
    .update({ image_requested_at: new Date().toISOString() })
    .eq("id", recipeId)
    .is("image_url", null)
    .or(`image_requested_at.is.null,image_requested_at.lt.${new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString()}`)
    .select("id, name_es, name_en, description_es, image_url")
    .maybeSingle();
  if (!claimed) {
    // Ya tiene foto, o alguien la está generando ahora mismo.
    const { data } = await admin.from("recipes").select("image_url").eq("id", recipeId).maybeSingle();
    return (data?.image_url as string | null) ?? null;
  }

  try {
    const png = await generate(new GoogleGenAI({ apiKey }), claimed as RecipeForImage, ingredientNames);
    const webp = await sharp(png).resize(768, 768, { fit: "cover" }).webp({ quality: 80 }).toBuffer();
    const file = `${recipeId}-${Date.now().toString(36)}.webp`;
    const { error } = await admin.storage.from(BUCKET).upload(file, webp, { contentType: "image/webp", upsert: true });
    if (error) throw error;
    const url = admin.storage.from(BUCKET).getPublicUrl(file).data.publicUrl;
    await admin.from("recipes").update({ image_url: url }).eq("id", recipeId);
    return url;
  } catch (e) {
    console.error("dish image", recipeId, e);
    // Se libera el candado para que se pueda reintentar más tarde.
    await admin.from("recipes").update({ image_requested_at: null }).eq("id", recipeId);
    return null;
  }
}

async function generate(ai: GoogleGenAI, recipe: RecipeForImage, ingredients: string[]): Promise<Buffer> {
  const prompt = [
    `Fotografía de comida realista y apetitosa del plato "${recipe.name_es}" (${recipe.name_en}).`,
    recipe.description_es ? `Descripción: ${recipe.description_es}.` : "",
    ingredients.length ? `Ingredientes principales: ${ingredients.slice(0, 10).join(", ")}.` : "",
    "Una sola porción servida en un plato casero sobre una mesa de madera clara, vista cenital a 45°, luz natural suave de ventana, fondo desenfocado.",
    "Sin texto, sin letras, sin marcas de agua, sin personas ni manos.",
  ].filter(Boolean).join(" ");

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
    contents: prompt,
    config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio: "1:1" } },
  });
  const data = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!data) throw new Error("no image in response");
  return Buffer.from(data, "base64");
}
