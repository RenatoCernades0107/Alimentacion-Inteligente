// Contrasta las kcal de supabase/data/nutrition.mjs con USDA FoodData Central (datos CC0).
//
// Uso:  USDA_API_KEY=<tu llave> node scripts/verify-nutrition.mjs [--all] [--threshold 15] [clave ...]
//   - Sin argumentos revisa solo los alimentos que usan las recetas; --all revisa los 284; o pasa claves sueltas.
//   - --threshold: desviación (%) a partir de la cual se marca el alimento (por defecto 15).
//   - La llave es gratuita (https://api.data.gov/signup/). Con DEMO_KEY solo alcanza para probar unos pocos.
//
// Es una ayuda para revisar, no un veredicto: USDA busca por texto en inglés y a veces el primer resultado
// no es el mismo alimento (por ejemplo, cocido en vez de crudo). Se imprime el nombre que encontró para juzgar.
import { foods } from "../supabase/data/foods.mjs";
import { recipes } from "../supabase/data/recipes.mjs";
import { nutrition } from "../supabase/data/nutrition.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const threshold = Number(args[args.indexOf("--threshold") + 1]) || 15;
const explicit = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--threshold");
const apiKey = process.env.USDA_API_KEY;
if (!apiKey) {
  console.error("Falta USDA_API_KEY (gratis en https://api.data.gov/signup/).");
  process.exit(1);
}

const usedInRecipes = new Set(recipes.flatMap((r) => r.ing.map(([key]) => key)));
const targets = foods.filter(([key]) => (explicit.length ? explicit.includes(key) : flag("--all") || usedInRecipes.has(key)));

// Consultas más precisas para los ingredientes que más pesan en las recetas (la búsqueda libre de USDA
// suele traer primero productos procesados). Se buscan nombres de la base "SR Legacy".
const QUERY = {
  rice: "Rice, white, long-grain, regular, raw",
  pasta: "Pasta, dry, enriched",
  macaroni: "Macaroni, dry, enriched",
  eggs: "Egg, whole, raw, fresh",
  butter: "Butter, salted",
  milk: "Milk, whole, 3.25% milkfat",
  flour: "Wheat flour, white, all-purpose, enriched",
  sugar: "Sugars, granulated",
  vegetable_oil: "Oil, soybean, salad or cooking",
  olive_oil: "Oil, olive, salad or cooking",
  chicken_breast: "Chicken, broilers or fryers, breast, meat only, raw",
  chicken_thighs: "Chicken, broilers or fryers, thigh, meat and skin, raw",
  chicken: "Chicken, broilers or fryers, meat and skin, raw",
  beef_sirloin: "Beef, top sirloin, steak, separable lean and fat, trimmed to 0\" fat, raw",
  beef_stew: "Beef, chuck, arm pot roast, separable lean and fat, raw",
  ground_beef: "Beef, ground, 80% lean meat / 20% fat, raw",
  pork: "Pork, fresh, shoulder, whole, separable lean and fat, raw",
  bacon: "Pork, cured, bacon, raw",
  cheddar: "Cheese, cheddar",
  mayonnaise: "Salad dressing, mayonnaise, regular",
  potato: "Potatoes, white, flesh and skin, raw",
  sweet_potato: "Sweet potato, raw, unprepared",
  yuca: "Cassava, raw",
  peanut_butter: "Peanut butter, smooth style, with salt",
  oats: "Cereals, oats, regular and quick, not fortified, dry",
  quinoa: "Quinoa, uncooked",
  white_fish: "Fish, cod, Atlantic, raw",
  salmon: "Fish, salmon, Atlantic, farmed, raw",
  shrimp: "Crustaceans, shrimp, mixed species, raw",
  evaporated_milk: "Milk, canned, evaporated, whole",
  heavy_cream: "Cream, fluid, heavy whipping",
  avocado: "Avocados, raw, all commercial varieties",
  bread: "Bread, white, commercially prepared",
};
const BAD = /cooked|breaded|fried|baby|cracker|tender|dressing|clarified|egg white|yolk|substitute|dehydrated|instant|frozen|canned in|restaurant|fast food/i;

/** kcal por 100 g del mejor resultado de USDA (Foundation o SR Legacy); prefiere alimentos crudos y sin procesar. */
async function lookup(key, en) {
  const query = QUERY[key] ?? en;
  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  url.search = new URLSearchParams({ api_key: apiKey, query, dataType: "Foundation,SR Legacy", pageSize: "8" });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA respondió ${res.status}`);
  const { foods: hits = [] } = await res.json();
  const kcalOf = (f) => f.foodNutrients?.find((n) => n.nutrientNumber === "208" || (n.nutrientId === 1008 && n.unitName === "KCAL"))?.value;
  const score = (f) => (QUERY[key] ? 0 : Number(/raw|dry|uncooked/i.test(f.description)) * 2) - Number(BAD.test(f.description) && !QUERY[key]) * 3
    + Number(f.description.toLowerCase().startsWith(query.split(/[ ,]/)[0].toLowerCase())) * 3;
  const ranked = hits.filter((f) => kcalOf(f) != null).sort((a, b) => score(b) - score(a));
  return ranked.length ? { description: ranked[0].description, kcal: kcalOf(ranked[0]) } : null;
}

let flagged = 0;
for (const [key, , en] of targets) {
  const mine = nutrition[key]?.[0];
  try {
    const hit = await lookup(key, en);
    if (!hit) {
      console.log(`?  ${key.padEnd(22)} sin resultado para "${en}"`);
      continue;
    }
    const diff = mine ? ((mine - hit.kcal) / hit.kcal) * 100 : NaN;
    const bad = !Number.isFinite(diff) || Math.abs(diff) > threshold;
    if (bad) flagged++;
    console.log(`${bad ? "!" : " "}  ${key.padEnd(22)} mío ${String(mine).padStart(4)}  USDA ${String(Math.round(hit.kcal)).padStart(4)}  (${Number.isFinite(diff) ? diff.toFixed(0) + "%" : "—"})  ${hit.description}`);
  } catch (e) {
    console.error(`x  ${key}: ${e.message}`);
    break;
  }
  await new Promise((r) => setTimeout(r, 150)); // cortesía con el límite de USDA
}
console.log(`\n${targets.length} alimentos revisados, ${flagged} fuera de ±${threshold}% (revisa a mano los marcados con "!").`);
