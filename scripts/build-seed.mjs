// Genera supabase/seed.sql a partir de supabase/data/*.mjs
// Uso: node scripts/build-seed.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { foods } from "../supabase/data/foods.mjs";
import { recipes } from "../supabase/data/recipes.mjs";

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replaceAll("'", "''")}'`);
const arr = (a) => `array[${a.map(q).join(", ")}]::text[]`;
const recipeImg = (slug) => (existsSync(new URL(`../public/recipes/${slug}.jpg`, import.meta.url)) ? `/recipes/${slug}.jpg` : null);
const img = (name) => (name ? `https://www.themealdb.com/images/ingredients/${encodeURIComponent(name)}-small.png` : null);

const foodByKey = new Map(foods.map((f) => [f[0], f]));
const errors = [];

let sql = "-- Generado por scripts/build-seed.mjs. No editar a mano.\n\n";

sql += "insert into foods (key, name_es, name_en, category, emoji, image_url, shelf_life_days, default_unit, aliases) values\n";
sql += foods
  .map(([key, es, en, cat, emoji, mealdb, days, unit, aliases]) =>
    `  (${q(key)}, ${q(es)}, ${q(en)}, ${q(cat)}, ${q(emoji)}, ${q(img(mealdb))}, ${days}, ${q(unit)}, ${arr(aliases)})`)
  .join(",\n");
sql += "\non conflict (key) do update set name_es = excluded.name_es, name_en = excluded.name_en, category = excluded.category,\n";
sql += "  emoji = excluded.emoji, image_url = excluded.image_url, shelf_life_days = excluded.shelf_life_days,\n";
sql += "  default_unit = excluded.default_unit, aliases = excluded.aliases;\n\n";

for (const r of recipes) {
  sql += `insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (\n`;
  sql += `  ${q(r.slug)}, ${q(r.country)}, ${q(r.es)}, ${q(r.en)}, ${q(r.descEs)}, ${q(r.descEn)}, ${q(r.emoji)}, ${q(recipeImg(r.slug))}, ${arr(r.meals)}, ${r.servings}, ${r.time ?? "null"}, ${q(r.source)},\n`;
  sql += `  ${arr(r.stepsEs)}, ${arr(r.stepsEn)})\n`;
  sql += "on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,\n";
  sql += "  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,\n";
  sql += "  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,\n";
  sql += "  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;\n";
  sql += `delete from recipe_ingredients where recipe_id = (select id from recipes where slug = ${q(r.slug)});\n`;
  sql += "insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)\n";
  sql += "select r.id, f.id, v.qty, f.default_unit, v.opt from (values\n";
  sql += r.ing
    .map(([key, qty, opt]) => {
      if (!foodByKey.has(key)) errors.push(`${r.slug}: ingrediente desconocido "${key}"`);
      return `  (${q(key)}, ${qty}::numeric, ${opt ? "true" : "false"})`;
    })
    .join(",\n");
  sql += `\n) as v(key, qty, opt)\njoin foods f on f.key = v.key\njoin recipes r on r.slug = ${q(r.slug)};\n\n`;
}

// Productos de supermercados peruanos (scripts/scrape-pe-stores.mjs).
const storeFile = new URL("../supabase/data/pe_store_products.json", import.meta.url);
const storeProducts = existsSync(storeFile) ? JSON.parse(readFileSync(storeFile, "utf8")) : [];
if (storeProducts.length) {
  sql += "delete from store_products where country = 'PE';\n";
  for (let i = 0; i < storeProducts.length; i += 200) {
    sql += "insert into store_products (country, name, brand, barcodes, quantity, unit, pack, image_url, food_id, stores, store_urls)\n";
    sql += "select 'PE', v.name, v.brand, v.barcodes, v.quantity, v.unit, v.pack, v.image_url, f.id, v.stores, v.store_urls::jsonb from (values\n";
    sql += storeProducts
      .slice(i, i + 200)
      .map((p) => {
        if (!foodByKey.has(p.food)) errors.push(`producto "${p.name}": alimento desconocido "${p.food}"`);
        const urls = Object.fromEntries(p.stores.map((s) => [s.store, s.url]));
        return `  (${q(p.name)}, ${q(p.brand)}, ${arr(p.barcodes)}, ${p.quantity ?? "null"}::numeric, ${q(p.unit)}, ${p.pack}, ${q(p.image)}, ${q(p.food)}, ${arr(p.stores.map((s) => s.store))}, ${q(JSON.stringify(urls))})`;
      })
      .join(",\n");
    sql += "\n) as v(name, brand, barcodes, quantity, unit, pack, image_url, food_key, stores, store_urls)\nleft join foods f on f.key = v.food_key;\n\n";
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`seed.sql: ${foods.length} alimentos, ${recipes.length} recetas (${recipes.filter((r) => r.country === "PE").length} PE / ${recipes.filter((r) => r.country === "US").length} US), ${storeProducts.length} productos de supermercados`);
