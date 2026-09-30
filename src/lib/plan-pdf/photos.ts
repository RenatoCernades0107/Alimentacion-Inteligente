import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/** Las fotos se recortan a 4:3 y se reducen: el PDF pesa unos KB por foto en vez de cientos. */
export const PHOTO_WIDTH = 480;
export const PHOTO_HEIGHT = 360;

const PUBLIC_DIR = path.join(process.cwd(), "public");
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_CACHED = 200;

/** Fotos ya procesadas (las de las recetas son pocas y no cambian entre pedidos). */
const cache = new Map<string, Promise<Buffer | null>>();

/**
 * Foto lista para incrustar en el PDF, o null si no se puede leer (el PDF sale sin ella).
 * `url` puede ser una ruta de `public/` ("/recipes/ceviche.jpg") o un link https.
 */
export function loadPhoto(url: string | null | undefined, origin?: string): Promise<Buffer | null> {
  if (!url) return Promise.resolve(null);
  let photo = cache.get(url);
  if (!photo) {
    photo = readSource(url, origin)
      .then((source) => (source ? resize(source) : null))
      .catch(() => null)
      .then((buffer) => {
        if (!buffer) cache.delete(url); // un fallo puntual no se recuerda
        return buffer;
      });
    if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
    cache.set(url, photo);
  }
  return photo;
}

async function readSource(url: string, origin?: string): Promise<Buffer | null> {
  if (url.startsWith("/")) {
    const file = path.join(PUBLIC_DIR, decodeURIComponent(url.split("?")[0]));
    if (file.startsWith(PUBLIC_DIR + path.sep)) {
      try {
        return await readFile(file);
      } catch {
        // En algunos despliegues public/ no está en el disco de la función: se pide por HTTP.
      }
    }
    return origin ? download(new URL(url, origin)) : null;
  }
  const remote = new URL(url);
  return remote.protocol === "https:" ? download(remote) : null;
}

async function download(url: URL): Promise<Buffer | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  return bytes.length <= MAX_BYTES ? bytes : null;
}

function resize(source: Buffer) {
  return sharp(source)
    .rotate()
    .resize(PHOTO_WIDTH, PHOTO_HEIGHT, { fit: "cover" })
    .toColourspace("srgb")
    .jpeg({ quality: 78 })
    .toBuffer();
}
