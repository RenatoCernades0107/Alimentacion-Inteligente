// Recolecta productos de supermercados peruanos (Plaza Vea, Wong, Tottus, Tambo),
// los asocia a un alimento genérico del catálogo y une los repetidos entre cadenas.
// Resultado: supabase/data/pe_store_products.json (luego: node scripts/build-seed.mjs)
//
// Uso:
//   node scripts/scrape-pe-stores.mjs            consulta las tiendas (~5 min) y guarda caché
//   node scripts/scrape-pe-stores.mjs --cached   reprocesa la última consulta (para ajustar reglas)
// No guarda precios.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { foods } from "../supabase/data/foods.mjs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const PER_TERM = 20;
const DELAY_MS = 350;
const CACHE = new URL("../node_modules/.cache/pe-stores-raw.json", import.meta.url);
const ORDER = ["plazavea", "wong", "tottus", "tambo"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ───────────────────────── Normalización ─────────────────────────
const norm = (s) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/&/g, " y ").replace(/[^a-z0-9.,\s]/g, " ").replace(/\s+/g, " ").trim();

const words = (s) => norm(s).replace(/[.,]/g, " ").split(" ").filter(Boolean);

/** Igualdad tolerante a plurales: limon/limones, fresa/fresas, aceituna/aceitunas. */
const sameWord = (a, b) => a === b || a + "s" === b || b + "s" === a || a + "es" === b || b + "es" === a;

/** Tamaño del producto: "Lata 390g" → { quantity: 390, unit: "g" } */
function parseSize(name) {
  const m = norm(name).replace(/(\d),(\d)/g, "$1.$2").match(/(\d+(?:\.\d+)?)\s*(kg|kilos?|gr?|gramos|ml|cc|l|lt|litros?)\b/);
  if (!m) return { quantity: null, unit: null };
  const q = parseFloat(m[1]);
  let u = m[2];
  if (/^k/.test(u)) u = "kg";
  else if (/^g/.test(u)) u = "g";
  else if (u === "ml" || u === "cc") u = "ml";
  else u = "l";
  return { quantity: q, unit: u };
}

/** Cantidad de unidades del pack (sixpack, pack x6, paquete 6un). 1 si no es pack. */
function parsePack(name) {
  const n = norm(name);
  if (/six\s?pack/.test(n)) return 6;
  const m =
    n.match(/(?:pack|paquete|caja)\s*(?:x\s*)?(\d{1,2})\s*(?:un|unid|unidades)?\b/) ||
    n.match(/\b(\d{1,2})\s*(?:un|unid|unidades)\b/) ||
    n.match(/\bx\s?(\d{1,2})\b(?!\s*(?:g|gr|kg|ml|l)\b)/);
  return m ? Number(m[1]) : 1;
}

const toBase = (q, u) => (q == null ? null : u === "kg" || u === "l" ? q * 1000 : q);

// ───────────────────────── Asociar con alimento genérico ─────────────────────────
// Cada alimento aporta frases (nombre y alias en español). Un producto corresponde a la
// frase cuya primera palabra ABRE el nombre del producto ("Leche Gloria Evaporada" → leche
// evaporada), así se evitan sabores y usos: "Lavavajilla Limón", "Gelatina sabor durazno".
const phrases = [];
for (const [key, es, , , , , , , aliases] of foods) {
  const parts = [es, ...es.split(/[/(]/), ...aliases].map((p) => words(p.replace(/\)/g, ""))).filter((w) => w.join(" ").length >= 3);
  const seen = new Set();
  for (const w of parts) {
    const k = w.join(" ");
    if (seen.has(k)) continue;
    seen.add(k);
    phrases.push({ key, words: w, len: k.length });
  }
}
phrases.sort((a, b) => b.words.length - a.words.length || b.len - a.len);

// Palabras que pueden ir antes del alimento sin cambiar lo que es ("Pack 2 …", "Filete de …").
const LEADING = /^(pack\d*|promo|oferta|combo|x\d*|\d+|filete|filetes|trozo|trozos|presa|presas|cubo|cubos|bandeja|de|del|la|el)$/;

// Productos que no son insumos de cocina aunque empiecen con el nombre de uno.
const EXCLUDE = /\b(snacks?|piqueos?|chizitos?|golosinas?|caramelos?|chupetin(es)?|gomitas?|helados?|shampoo|jabon(es)?|detergentes?|limpia\w*|mascotas?|perros?|gatos?|panal(es)?|toallitas?|formula|bebes?|infantil|licor(es)?|cervezas?|vinos?|pisco|ron|vodka|whisky|energizantes?|gaseosas?|juguetes?|velas?|colonias?|desodorantes?|suplementos?|sopa instantanea|ajinomen|galletas? de|resaltador|enchufe|malla protectora|chips|papas? sabor|papas? al hilo|papas? nativas? fritas|papas? fritas sabor)\b/;

// Categorías de la tienda que no son comida.
const BAD_CATEGORY = /limpieza|mascota|bebe|cuidado|belleza|hogar|electro|juguet|librer|licor|cerveza|farmacia|ropa|tecnolog|bazar|ferreter|salud|deporte|automotriz|jardin|bebidas alcoholicas/;
// Tottus: J01 abarrotes, J03 carnes/pescados/fiambres, J04 frutas y verduras, J05 panadería.
const TOTTUS_FOOD = /^J0(1(0[013-9]|[1-9]\d)|3|4|5)/;

function matchFood(item) {
  const n = norm(item.name);
  if (EXCLUDE.test(n)) return null;
  if (item.category && BAD_CATEGORY.test(norm(item.category))) return null;
  if (item.store === "tottus" && item.categoryId && !TOTTUS_FOOD.test(item.categoryId)) return null;

  const w = words(item.name);
  let start = 0;
  while (start < w.length - 1 && start < 3 && LEADING.test(w[start])) start++;

  for (const p of phrases) {
    if (!sameWord(p.words[0], w[start])) continue;
    const rest = w.slice(start + 1);
    if (p.words.slice(1).every((pw) => rest.some((x) => sameWord(pw, x)))) return p.key;
  }
  return null;
}

// ───────────────────────── Tiendas ─────────────────────────
async function getJSON(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
    } catch {}
    await sleep(1500 * (attempt + 1));
  }
  return null;
}

/** Plaza Vea y Wong usan VTEX (API pública de catálogo). */
function vtex(store, host) {
  return async (term) => {
    const data = await getJSON(`https://${host}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(term)}&_from=0&_to=${PER_TERM - 1}`);
    return (data ?? []).map((p) => {
      const item = p.items?.[0] ?? {};
      return {
        store,
        name: p.productName,
        brand: p.brand || null,
        barcode: /^\d{8,14}$/.test(item.ean ?? "") ? item.ean : null,
        image: item.images?.[0]?.imageUrl?.split("?")[0] ?? null,
        url: p.link ?? null,
        category: p.categories?.[0] ?? "",
      };
    });
  };
}

async function tottus(term) {
  const data = await getJSON(`https://www.tottus.com.pe/s/browse/v1/search/pe?Ntt=${encodeURIComponent(term)}`);
  return (data?.data?.results ?? []).slice(0, PER_TERM).map((p) => ({
    store: "tottus",
    name: p.displayName,
    brand: p.brand ? p.brand.charAt(0) + p.brand.slice(1).toLowerCase() : null,
    barcode: null,
    image: p.mediaUrls?.[0] ?? null,
    url: p.url ?? null,
    category: "",
    categoryId: p.merchantCategoryId ?? "",
  }));
}

/** Tambo (plataforma Justo): los productos vienen embebidos en las páginas de categoría. */
const TAMBO_CATEGORIES = ["despensa/5gSmKE2b3w48nYSsX", "marcas-tambo/He6rbj2uKojnCkZ9Z", "originales-de-tambo/PQ2XHZ4jJLnMHaWek"];
async function tamboAll() {
  const out = new Map();
  for (const cat of TAMBO_CATEGORIES) {
    let html = "";
    try {
      html = await (await fetch(`https://www.tambo.pe/pedir/categoria/${cat}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) })).text();
    } catch {
      continue;
    }
    const re = /"_id":"([A-Za-z0-9]{17})","name":"((?:[^"\\]|\\.)+)","description":/g;
    let m;
    while ((m = re.exec(html))) {
      const chunk = html.slice(m.index, m.index + 5000);
      if (!chunk.includes('"externalId"')) continue;
      const cats = [...chunk.matchAll(/\{"_id":"\w+","name":"([^"]+)","index"/g)].map((x) => x[1]).join("/");
      out.set(m[1], {
        store: "tambo",
        name: JSON.parse(`"${m[2]}"`),
        brand: null,
        barcode: null,
        image: chunk.match(/"smallURL":"([^"]+)"/)?.[1] ?? null,
        url: "https://www.tambo.pe/pedir",
        category: cats,
      });
    }
    await sleep(DELAY_MS);
  }
  return [...out.values()];
}

async function fetchAll() {
  const terms = [...new Set(foods.map(([, es]) => norm(es.split(/[/(]/)[0])))];
  const sources = [
    ["plazavea", vtex("plazavea", "www.plazavea.com.pe")],
    ["wong", vtex("wong", "www.wong.pe")],
    ["tottus", tottus],
  ];
  console.log(`Buscando ${terms.length} términos en ${sources.length} tiendas + Tambo…`);
  const raw = [];
  await Promise.all(
    sources.map(async ([store, search]) => {
      let n = 0;
      for (const term of terms) {
        raw.push(...(await search(term)));
        if (++n % 20 === 0) console.log(`  ${store}: ${n}/${terms.length}`);
        await sleep(DELAY_MS);
      }
    }),
  );
  raw.push(...(await tamboAll()));
  return raw;
}

// ───────────────────────── Unir repetidos ─────────────────────────
const STOP = new Set(
  "de la el los las con sin en x y para tipo marca lata botella bolsa caja paquete pack sixpack doypack frasco sachet tetrapack tetra pak unidad unidades un und gr g kg ml l lt litro litros gramos kilo bandeja malla granel precio envase".split(" "),
);

function tokens(name, brand) {
  const b = new Set(words(brand ?? ""));
  return new Set(words(name).filter((t) => t.length > 1 && !STOP.has(t) && !b.has(t) && !/\d/.test(t)));
}

function similar(a, b) {
  let inter = 0;
  for (const t of a) if ([...b].some((x) => sameWord(t, x))) inter++;
  return inter / (a.size + b.size - inter || 1);
}

/** Marca inferida del nombre (Tambo no la envía): alguna marca conocida que aparezca en el nombre. */
function inferBrand(name, knownBrands) {
  const n = ` ${words(name).join(" ")} `;
  return knownBrands.find((b) => n.includes(` ${b} `)) ?? null;
}

function merge(items) {
  // Primero las tiendas con datos más completos (código de barras, marca): su nombre e imagen se usan.
  items.sort((a, b) => ORDER.indexOf(a.store) - ORDER.indexOf(b.store));
  const knownBrands = [...new Set(items.map((r) => words(r.brand ?? "").join(" ")).filter((b) => b.length >= 3))].sort((a, b) => b.length - a.length);
  const groups = [];
  const byBarcode = new Map();

  for (const r of items) {
    const brandKey = r.brand ? words(r.brand).join(" ") : inferBrand(r.name, knownBrands);
    const size = parseSize(r.name);
    const item = { ...r, brandKey, size, base: toBase(size.quantity, size.unit), pack: parsePack(r.name), toks: tokens(r.name, brandKey) };

    let group = item.barcode ? byBarcode.get(item.barcode) : undefined;
    group ??= groups.find((g) => {
      if (!g.brandKey || g.brandKey !== item.brandKey || g.pack !== item.pack) return false;
      if (g.stores.has(item.store)) return false; // una tienda no repite el mismo producto
      const sim = similar(g.toks, item.toks);
      if (g.base !== null && item.base !== null) return g.base === item.base && sim >= 0.5;
      return sim >= 0.75; // si a uno le falta el tamaño, se exige más parecido
    });
    if (!group) {
      group = { ...item, stores: new Map(), barcodes: new Set() };
      groups.push(group);
    }
    if (item.barcode) {
      group.barcodes.add(item.barcode);
      byBarcode.set(item.barcode, group);
    }
    if (!group.stores.has(item.store)) group.stores.set(item.store, item.url);
    group.image ??= item.image;
    group.brand ??= item.brand;
    if (group.base === null && item.base !== null) Object.assign(group, { size: item.size, base: item.base });
  }

  return groups.map((g) => ({
    name: g.name.replace(/\s+/g, " ").trim(),
    brand: g.brand ?? (g.brandKey ? g.brandKey.replace(/\b\w/g, (c) => c.toUpperCase()) : null),
    barcodes: [...g.barcodes],
    quantity: g.size.quantity,
    unit: g.size.unit,
    pack: g.pack,
    image: g.image,
    food: g.food,
    stores: ORDER.filter((s) => g.stores.has(s)).map((s) => ({ store: s, url: g.stores.get(s) })),
  }));
}

// ───────────────────────── Main ─────────────────────────
let raw;
if (process.argv.includes("--cached") && existsSync(CACHE)) {
  raw = JSON.parse(readFileSync(CACHE, "utf8"));
  console.log(`Usando caché: ${raw.length} resultados`);
} else {
  raw = await fetchAll();
  mkdirSync(new URL(".", CACHE), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(raw));
}

// Asociar a un alimento y quitar duplicados exactos (mismo producto encontrado con dos términos).
const seen = new Set();
const matched = [];
for (const r of raw) {
  const k = `${r.store}|${r.barcode ?? norm(r.name)}`;
  if (seen.has(k)) continue;
  seen.add(k);
  const food = matchFood(r);
  if (food) matched.push({ ...r, food });
}

const products = merge(matched).sort((a, b) => b.stores.length - a.stores.length || a.name.localeCompare(b.name));
writeFileSync(new URL("../supabase/data/pe_store_products.json", import.meta.url), JSON.stringify(products, null, 1));

const perStore = {};
for (const r of matched) perStore[r.store] = (perStore[r.store] ?? 0) + 1;
const byCount = {};
for (const p of products) byCount[p.stores.length] = (byCount[p.stores.length] ?? 0) + 1;
console.log("Productos por tienda:", perStore);
console.log(`${products.length} productos únicos. Por número de cadenas:`, byCount);
