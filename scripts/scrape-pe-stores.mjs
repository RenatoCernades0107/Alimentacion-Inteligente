// Recolecta productos de supermercados peruanos (Plaza Vea, Wong, Tottus, Tambo),
// los asocia a un alimento genérico del catálogo y une los repetidos entre cadenas.
// Resultado: supabase/data/pe_store_products.json (luego: node scripts/build-seed.mjs)
//
// Uso:
//   node scripts/scrape-pe-stores.mjs            recorre las categorías de comida (~10 min) y guarda caché
//   node scripts/scrape-pe-stores.mjs --cached   reprocesa la última consulta (para ajustar reglas)
//   … --unmatched                                  además lista los productos sin alimento (para ampliar foods.mjs)
// No guarda precios.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { foods } from "../supabase/data/foods.mjs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
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
// Las palabras de enlace no se exigen: "Galletas de soda" también reconoce "Galletas Soda Field".
const CONNECTORS = new Set("de del la el los las y e en con para al a".split(" "));
const phrases = [];
for (const [key, es, , , , , , , aliases] of foods) {
  const parts = [es, ...es.split(/[/(]/), ...aliases]
    .map((p) => words(p.replace(/\)/g, "")).filter((x, i) => i === 0 || !CONNECTORS.has(x)))
    .filter((w) => w.join(" ").length >= 2);
  const seen = new Set();
  for (const w of parts) {
    const k = w.join(" ");
    if (seen.has(k)) continue;
    seen.add(k);
    phrases.push({ key, words: w, len: k.length });
  }
}
phrases.sort((a, b) => b.words.length - a.words.length || b.len - a.len);

// Palabras que pueden ir antes del alimento sin cambiar lo que es ("Pack 2u …", "Sixpack …", "Filete de …").
const LEADING = /^(pack\w*|sixpack|twopack|tripack|fourpack|twelvepack|multipack|six|duo|mini|minis|mix|promo|oferta|combo|caja|x\d*|\d+\w*|filete|filetes|trozo|trozos|presa|presas|porcion|porciones|tira|tiras|cubo|cubos|bandeja|ahorrador|de|del|la|el|y)$/;

// Lo que no es comida (o no es para la despensa familiar) aunque empiece con el nombre de un alimento.
const EXCLUDE = /\b(shampoo|jalea real|polen|enfagrow|sustagen|jabon(es)?|detergentes?|limpia\w*|mascotas?|(comida|alimento|snacks?) (para )?(perros?|gatos?)|panal(es)?|toallitas?|formula|formulas|infantil|licor(es)?|cervezas?|vinos?|pisco|ron|vodka|whisky|gin|rtd|energizantes?|gaseosas?|juguetes?|velas?|colonias?|desodorantes?|suplementos?|complemento alimenticio|proteina|proteinas|vitaminas?|preservativos?|vapeador|resaltador|enchufe|malla protectora|ramo de flores|arreglo floral|juego de mesa|taza ceramica|papel higienico)\b/;

// Snacks hechos de verduras: "Papas Inka Chips", "Camote frito", "Yuca en hojuelas" no son la verdura.
const SNACK_HINT = /\b(chips|hojuelas|al hilo|sabor|onduladas|ondas|kettle|lays?|pringles|inka|kryzpo|papi|voraz|jappy|tiyapuy|frito|fritos|fritas)\b/;
const SNACKABLE = new Set(["potato", "yellow_potato", "sweet_potato", "yuca", "plantain", "banana"]);

// Categorías de la tienda que no son comida.
const BAD_CATEGORY = /limpieza|mascota|bebe|cuidado|belleza|hogar|electro|juguet|librer|licor|cerveza|farmacia|ropa|tecnolog|bazar|ferreter|salud|deporte|automotriz|jardin|bebidas alcoholicas/;
// Tottus: J01 abarrotes, J03 carnes/pescados, J04 frutas y verduras, J05 lácteos/fiambres/congelados, J06 panadería, J07 cremas.
const TOTTUS_FOOD = /^J0(1(0[013-9]|[1-9]\d)|3|4|5|6|7)/;

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
    if (!p.words.slice(1).every((pw) => rest.some((x) => sameWord(pw, x)))) continue;
    return SNACKABLE.has(p.key) && SNACK_HINT.test(n) && !/congelad|prefrit|pre frit/.test(n) ? "chips" : p.key;
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

// Se recorren completas las categorías de comida de cada cadena (no solo búsquedas por nombre),
// así aparecen también los alimentos que aún no están en el catálogo (ver --unmatched).

/** Plaza Vea y Wong usan VTEX (API pública de catálogo). */
const VTEX_STORES = {
  // Frutas y verduras, abarrotes, desayunos, panadería, quesos y fiambres, carnes, lácteos, congelados.
  plazavea: { host: "www.plazavea.com.pe", categories: [77, 431, 478, 493, 621, 814, 845, 210] },
  // Frutas y verduras, congelados, embutidos, abarrotes, desayuno, carnes, panadería, lácteos.
  wong: { host: "www.wong.pe", categories: [800, 1200, 1400, 1700, 1001253, 1001327, 1001374, 1001436] },
};
const VTEX_MAX = 2500; // la API no pagina más allá: las categorías más grandes se recorren por subcategoría

const vtexItem = (store) => (p) => {
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
};

async function vtexAll(store) {
  const { host, categories } = VTEX_STORES[store];
  const tree = (await getJSON(`https://${host}/api/catalog_system/pub/category/tree/3`)) ?? [];
  const findNode = (nodes, id) => {
    for (const n of nodes) {
      const found = n.id === id ? n : findNode(n.children ?? [], id);
      if (found) return found;
    }
    return null;
  };
  const out = [];
  async function crawl(path, id) {
    const base = `https://${host}/api/catalog_system/pub/products/search?fq=C:${path}`;
    for (let from = 0; from < VTEX_MAX; from += 50) {
      const page = await getJSON(`${base}&_from=${from}&_to=${from + 49}`);
      await sleep(DELAY_MS);
      if (!page?.length) return;
      out.push(...page.map(vtexItem(store)));
      if (page.length < 50) return;
    }
    // Llegó al límite: seguir por subcategorías.
    const children = findNode(tree, id)?.children ?? [];
    if (!children.length) console.warn(`  ${store}: ${path} supera ${VTEX_MAX} productos y no tiene subcategorías`);
    for (const c of children) await crawl(`${path}${c.id}/`, c.id);
  }
  for (const id of categories) {
    await crawl(`/${id}/`, id);
    console.log(`  ${store}: categoría ${id} → ${out.length} productos acumulados`);
  }
  return out;
}

/** Tottus: listado por categoría (48 por página). */
// Frutas y verduras, abarrotes, carnes, desayunos, huevos y fiambres, lácteos, panadería, congelados, repostería, snacks.
const TOTTUS_CATEGORIES = ["CATG16050", "CATG16066", "CATG16076", "CATG16065", "CATG16060", "CATG16061", "CATG16071", "CATG16062", "CATG16056", "CATG16058"];
async function tottusAll() {
  const out = [];
  for (const cat of TOTTUS_CATEGORIES) {
    for (let page = 1; ; page++) {
      const data = await getJSON(`https://www.tottus.com.pe/s/browse/v1/listing/pe?categoryId=${cat}&page=${page}`);
      await sleep(DELAY_MS);
      const results = data?.data?.results ?? [];
      out.push(
        ...results.map((p) => ({
          store: "tottus",
          name: p.displayName,
          brand: p.brand ? p.brand.charAt(0) + p.brand.slice(1).toLowerCase() : null,
          barcode: null,
          image: p.mediaUrls?.[0] ?? null,
          url: p.url ?? null,
          category: "",
          categoryId: p.merchantCategoryId ?? "",
        })),
      );
      const { count = 0, perPage = 48 } = data?.data?.pagination ?? {};
      if (!results.length || page * perPage >= count) break;
    }
    console.log(`  tottus: ${cat} → ${out.length} productos acumulados`);
  }
  return out;
}

/** Tambo (plataforma Justo): los productos vienen embebidos en las páginas de categoría. */
const TAMBO_CATEGORIES = ["despensa/5gSmKE2b3w48nYSsX", "marcas-tambo/He6rbj2uKojnCkZ9Z", "originales-de-tambo/PQ2XHZ4jJLnMHaWek", "snacks-confiteria/jPBNxZZ8qwwMrdrKb"];
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
      // Sin categoría: en el HTML las categorías de un producto se mezclan con las del siguiente
      // ("Yogurt Gloria" aparecía en "Mascotas"); basta con que el nombre empiece con un alimento.
      out.set(m[1], {
        store: "tambo",
        name: JSON.parse(`"${m[2]}"`),
        brand: null,
        barcode: null,
        image: chunk.match(/"smallURL":"([^"]+)"/)?.[1] ?? null,
        url: "https://www.tambo.pe/pedir",
        category: "",
      });
    }
    await sleep(DELAY_MS);
  }
  return [...out.values()];
}

async function fetchAll() {
  console.log("Recorriendo las categorías de comida de Plaza Vea, Wong, Tottus y Tambo…");
  const parts = await Promise.all([vtexAll("plazavea"), vtexAll("wong"), tottusAll(), tamboAll()]);
  return parts.flat();
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
const unmatched = [];
for (const r of raw) {
  const k = `${r.store}|${r.barcode ?? norm(r.name)}`;
  if (seen.has(k)) continue;
  seen.add(k);
  const food = matchFood(r);
  if (food) matched.push({ ...r, food });
  else unmatched.push(r);
}

// --unmatched: lista los productos sin alimento, agrupados por la palabra con que empiezan,
// para descubrir alimentos que faltan en supabase/data/foods.mjs.
if (process.argv.includes("--unmatched")) {
  const byWord = new Map();
  for (const r of unmatched) {
    const w = words(r.name)[0] ?? "";
    if (!byWord.has(w)) byWord.set(w, []);
    byWord.get(w).push(`${r.store}\t${r.category || r.categoryId || ""}\t${r.name}`);
  }
  const lines = [...byWord].sort((a, b) => b[1].length - a[1].length).flatMap(([w, list]) => [`## ${w} (${list.length})`, ...list.slice(0, 8)]);
  const file = new URL("../node_modules/.cache/pe-stores-unmatched.txt", import.meta.url);
  writeFileSync(file, lines.join("\n"));
  writeFileSync(new URL("../node_modules/.cache/pe-stores-unmatched.json", import.meta.url), JSON.stringify(unmatched));
  console.log(`${unmatched.length} productos sin alimento → ${file.pathname}`);
}

const products = merge(matched).sort((a, b) => b.stores.length - a.stores.length || a.name.localeCompare(b.name));
writeFileSync(new URL("../supabase/data/pe_store_products.json", import.meta.url), JSON.stringify(products, null, 1));

const perStore = {};
for (const r of matched) perStore[r.store] = (perStore[r.store] ?? 0) + 1;
const byCount = {};
for (const p of products) byCount[p.stores.length] = (byCount[p.stores.length] ?? 0) + 1;
console.log("Productos por tienda:", perStore);
console.log(`${products.length} productos únicos. Por número de cadenas:`, byCount);
