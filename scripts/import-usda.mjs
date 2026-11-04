// Importa kcal y macronutrientes de USDA FoodData Central "SR Legacy" (dominio público, CC0) para los
// alimentos del catálogo y escribe supabase/data/usda.mjs.
//
// Uso:
//   1. Descargar y descomprimir el CSV de SR Legacy (~6 MB):
//      https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
//   2. node scripts/import-usda.mjs <carpeta con food.csv y food_nutrient.csv>
//   3. node scripts/build-seed.mjs
//
// FDC: cada alimento apunta a una fila de SR Legacy (id de FoodData Central; se ve en
// https://fdc.nal.usda.gov/food-details/<id>/nutrients). Un par [id, factor] escala la fila por la parte
// comestible cuando el alimento se cuenta por peso de compra con hueso (presas de pollo, pato, cordero).
// Los alimentos sin equivalente razonable en USDA (sobre todo peruanos) no están aquí y conservan los
// estimados escritos a mano en supabase/data/nutrition.mjs.
//
// Carbohidratos: "disponibles" (carbohidratos por diferencia menos fibra), como en nutrition.mjs, para que
// 4·P + 4·C + 9·G se acerque a las kcal.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { nutrition } from "../supabase/data/nutrition.mjs";

const FDC = {
  salt: 173468, // Salt, table
  black_pepper: 170931, // Spices, pepper, black
  vegetable_oil: 171411, // Oil, soybean, salad or cooking
  olive_oil: 171413, // Oil, olive, salad or cooking
  sugar: 169655, // Sugars, granulated
  flour: 168894, // Wheat flour, white, all-purpose, enriched, bleached
  cumin: 170923, // Spices, cumin seed
  oregano: 171328, // Spices, oregano, dried
  paprika: 171329, // Spices, paprika
  cinnamon: 171320, // Spices, cinnamon, ground
  garlic_powder: 171325, // Spices, garlic powder
  chili_powder: 171319, // Spices, chili powder
  bay_leaf: 170917, // Spices, bay leaf
  turmeric: 172231, // Spices, turmeric, ground
  cloves: 171321, // Spices, cloves, ground
  nutmeg: 171326, // Spices, nutmeg, ground
  anise: 171316, // Spices, anise seed
  curry: 170924, // Spices, curry powder
  rosemary: 171333, // Spices, rosemary, dried
  thyme: 170938, // Spices, thyme, dried
  // seasoning: sin equivalente en USDA
  baking_powder: 172803, // Leavening agents, baking powder, double-acting, sodium aluminum sulfate
  baking_soda: 175040, // Leavening agents, baking soda
  vanilla: 173471, // Vanilla extract
  yeast: 175043, // Leavening agents, yeast, baker's, active dry
  cornstarch: 169698, // Cornstarch
  // chuno: sin equivalente en USDA
  soy_sauce: 174277, // Soy sauce made from soy and wheat (shoyu)
  oyster_sauce: 174529, // Sauce, oyster, ready-to-serve
  worcestershire: 171610, // Sauce, worcestershire
  vinegar: 172237, // Vinegar, distilled
  ketchup: 168556, // Catsup
  mustard: 172234, // Mustard, prepared, yellow
  mayonnaise: 171009, // Salad dressing, mayonnaise, regular
  dressing: 171019, // Salad dressing, italian dressing, commercial, regular
  // aji_sauce: sin equivalente en USDA
  // huancaina_sauce: sin equivalente en USDA
  pasta_sauce: 171192, // Sauce, pasta, spaghetti/marinara, ready-to-serve
  honey: 169640, // Honey
  maple_syrup: 169661, // Syrups, maple
  jam: 169641, // Jams and preserves
  dulce_de_leche: 173461, // Dulce de Leche
  hazelnut_spread: 168000, // Chocolate-flavored hazelnut spread
  // algarrobina: sin equivalente en USDA
  panela: 168833, // Sugars, brown
  // sweetener: sin equivalente en USDA
  bbq_sauce: 174523, // Sauce, barbecue
  tomato_paste: 170459, // Tomato products, canned, paste, without salt added
  canned_tomatoes: 170051, // Tomatoes, red, ripe, canned, packed in tomato juice
  chicken_stock: 174536, // Soup, chicken broth, ready-to-serve
  instant_soup: 171571, // Soup, chicken noodle, dry, mix
  peanut_butter: 174266, // Peanut butter, smooth style, with salt
  evaporated_milk: 171276, // Milk, canned, evaporated, with added vitamin D and without added vitamin A
  condensed_milk: 171275, // Milk, canned, condensed, sweetened
  // aji_amarillo_paste: sin equivalente en USDA
  // aji_panca_paste: sin equivalente en USDA
  tuna_can: 173708, // Fish, tuna, light, canned in oil, drained solids
  canned_fish: 175139, // Fish, sardine, Atlantic, canned in oil, drained solids with bone
  canned_fruit: 173027, // Fruit cocktail, (peach and pineapple and pear and grape and cherry), canned, light syrup, solids and liquids
  palm_hearts: 168569, // Hearts of palm, canned
  capers: 172238, // Capers, canned
  pickles: 168558, // Pickles, cucumber, dill or kosher dill
  bread_crumbs: 174928, // Bread, crumbs, dry, grated, plain
  soda_crackers: 172746, // Crackers, saltines (includes oyster, soda, soup)
  cocoa: 169593, // Cocoa, dry powder, unsweetened
  chocolate: 170272, // Chocolate, dark, 60-69% cacao solids
  raisins: 168165, // Raisins, dark, seedless
  dried_fruit: 173941, // Apricots, dried, sulfured, uncooked
  olives: 169094, // Olives, ripe, canned (small-extra large)
  purple_corn: 170288, // Corn grain, yellow
  gelatin: 168775, // Gelatin desserts, dry mix
  pudding: 168778, // Puddings, chocolate, ready-to-eat
  baking_mix: 172772, // Pancakes, plain, dry mix, complete (includes buttermilk)
  rice: 168877, // Rice, white, long-grain, regular, raw, enriched
  pasta: 169736, // Pasta, dry, enriched
  macaroni: 169736, // Pasta, dry, enriched
  lasagna_sheets: 169736, // Pasta, dry, enriched
  stuffed_pasta: 169727, // Pasta, fresh-refrigerated, plain, as purchased
  oats: 173904, // Cereals, oats, regular and quick, not fortified, dry
  cereal: 174648, // Cereals ready-to-eat, RALSTON Corn Flakes
  granola: 171646, // Cereals ready-to-eat, granola, homemade
  cereal_bar: 167542, // Snacks, granola bars, hard, plain
  bran: 169722, // Wheat bran, crude
  quinoa: 168874, // Quinoa, uncooked
  kiwicha: 170682, // Amaranth grain, uncooked
  wheat: 168890, // Wheat, hard red winter
  barley: 170284, // Barley, pearled, raw
  semolina: 169715, // Semolina, enriched
  cornmeal: 168867, // Cornmeal, degermed, enriched, yellow
  mote: 168920, // Corn grain, white
  cancha: 168920, // Corn grain, white
  popcorn: 167959, // Snacks, popcorn, air-popped
  bread: 174924, // Bread, white, commercially prepared (includes soft bread crumbs)
  toast: 174977, // Crackers, melba toast, plain
  burger_buns: 172796, // Rolls, hamburger or hotdog, plain
  tortillas: 175037, // Tortillas, ready-to-bake or -fry, flour, refrigerated
  pastries: 174987, // Croissants, butter
  cake: 172704, // Cake, pound, commercially prepared, butter (includes fresh and frozen)
  panettone: 175033, // Sweet rolls, cheese
  // empanadas: sin equivalente en USDA
  pizza: 170317, // Pizza, cheese topping, regular crust, frozen, cooked
  dough: 167932, // Pie crust, refrigerated, regular, unbaked
  canary_beans: 173751, // Beans, yellow, mature seeds, raw
  kidney_beans: 175193, // Beans, kidney, all types, mature seeds, raw
  black_beans: 173734, // Beans, black, mature seeds, raw
  lentils: 172420, // Lentils, raw
  chickpeas: 173756, // Chickpeas (garbanzo beans, bengal gram), mature seeds, raw
  lima_beans: 174252, // Lima beans, large, mature seeds, raw
  peas: 170419, // Peas, green, raw
  fava_beans: 170377, // Broadbeans, immature seeds, raw
  tofu: 172475, // Tofu, raw, firm, prepared with calcium sulfate
  hummus: 174289, // Hummus, commercial
  peanuts: 172430, // Peanuts, all types, raw
  almonds: 170567, // Nuts, almonds
  walnuts: 170187, // Nuts, walnuts, english
  pecans: 170182, // Nuts, pecans
  cashews: 170162, // Nuts, cashew nuts, raw
  brazil_nuts: 170569, // Nuts, brazilnuts, dried, unblanched
  pistachios: 170184, // Nuts, pistachio nuts, raw
  hazelnuts: 170581, // Nuts, hazelnuts or filberts
  macadamia: 170178, // Nuts, macadamia nuts, raw
  mixed_nuts: 170585, // Nuts, mixed nuts, dry roasted, with peanuts, without salt added
  chia: 170554, // Seeds, chia seeds, dried
  flaxseed: 169414, // Seeds, flaxseed
  sesame: 170150, // Seeds, sesame seeds, whole, dried
  seeds: 170562, // Seeds, sunflower seed kernels, dried
  coconut: 170169, // Nuts, coconut meat, raw
  potato: 170026, // Potatoes, flesh and skin, raw
  // yellow_potato: sin equivalente en USDA
  sweet_potato: 168482, // Sweet potato, raw, unprepared
  yuca: 169985, // Cassava, raw
  // olluco: sin equivalente en USDA
  onion: 170000, // Onions, raw
  red_onion: 170000, // Onions, raw
  green_onion: 170005, // Onions, spring or scallions (includes tops and bulb), raw
  garlic: 169230, // Garlic, raw
  ginger: 169231, // Ginger root, raw
  tomato: 170457, // Tomatoes, red, ripe, raw, year round average
  bell_pepper: 170108, // Peppers, sweet, red, raw
  aji_amarillo: 170106, // Peppers, hot chili, red, raw
  aji_limo: 170106, // Peppers, hot chili, red, raw
  dried_chili: 169396, // Peppers, ancho, dried
  rocoto: 170106, // Peppers, hot chili, red, raw
  jalapeno: 168576, // Peppers, jalapeno, raw
  carrot: 170393, // Carrots, raw
  beet: 169145, // Beets, raw
  radish: 169276, // Radishes, raw
  turnip: 170465, // Turnips, raw
  celery: 169988, // Celery, raw
  leek: 169246, // Leeks, (bulb and lower leaf-portion), raw
  fennel: 169385, // Fennel, bulb, raw
  lettuce: 169248, // Lettuce, iceberg (includes crisphead types), raw
  salad_mix: 169249, // Lettuce, green leaf, raw
  spinach: 168462, // Spinach, raw
  chard: 169991, // Chard, swiss, raw
  arugula: 169387, // Arugula, raw
  watercress: 170068, // Watercress, raw
  kale: 168421, // Kale, raw
  cabbage: 169975, // Cabbage, raw
  bok_choy: 170390, // Cabbage, chinese (pak-choi), raw
  broccoli: 170379, // Broccoli, raw
  cauliflower: 169986, // Cauliflower, raw
  artichoke: 169205, // Artichokes, (globe or french), raw
  asparagus: 168389, // Asparagus, raw
  eggplant: 169228, // Eggplant, raw
  // caigua: sin equivalente en USDA
  corn: 169998, // Corn, sweet, yellow, raw
  zucchini: 169291, // Squash, summer, zucchini, includes skin, raw
  squash: 168448, // Pumpkin, raw
  green_beans: 169961, // Beans, snap, green, raw
  snow_peas: 170010, // Peas, edible-podded, raw
  bean_sprouts: 169957, // Mung beans, mature seeds, sprouted, raw
  mushrooms: 169251, // Mushrooms, white, raw
  cucumber: 168409, // Cucumber, with peel, raw
  avocado: 171705, // Avocados, raw, all commercial varieties
  mixed_vegetables: 170471, // Vegetables, mixed, frozen, unprepared
  cilantro: 169997, // Coriander (cilantro) leaves, raw
  parsley: 170416, // Parsley, fresh
  basil: 172232, // Basil, fresh
  dill: 172233, // Dill weed, fresh
  mint: 173475, // Spearmint, fresh
  // huacatay: sin equivalente en USDA
  // maca: sin equivalente en USDA
  lime: 168155, // Limes, raw
  lemon: 167746, // Lemons, raw, without peel
  banana: 173944, // Bananas, raw
  plantain: 169130, // Plantains, yellow, raw
  apple: 171688, // Apples, raw, with skin
  pear: 169118, // Pears, raw
  quince: 168163, // Quinces, raw
  orange: 169097, // Oranges, raw, all commercial varieties
  tangerine: 169105, // Tangerines, (mandarin oranges), raw
  grapefruit: 174673, // Grapefruit, raw, pink and red, all areas
  papaya: 169926, // Papayas, raw
  watermelon: 167765, // Watermelon, raw
  melon: 169092, // Melons, cantaloupe, raw
  grapes: 174683, // Grapes, red or green (European type, such as Thompson seedless), raw
  strawberries: 167762, // Strawberries, raw
  blueberries: 171711, // Blueberries, raw
  raspberries: 167755, // Raspberries, raw
  blackberries: 173946, // Blackberries, raw
  mixed_berries: 168173, // Strawberries, frozen, unsweetened
  cherries: 171719, // Cherries, sweet, raw
  plums: 169949, // Plums, raw
  mango: 169910, // Mangos, raw
  pineapple: 169124, // Pineapple, raw, all varieties
  peach: 169928, // Peaches, yellow, raw
  kiwi: 168153, // Kiwifruit, green, raw
  passion_fruit: 169108, // Passion-fruit, (granadilla), purple, raw
  // granadilla: sin equivalente en USDA
  cherimoya: 173953, // Cherimoya, raw
  // lucuma: sin equivalente en USDA
  goldenberries: 173043, // Groundcherries, (cape-gooseberries or poha), raw
  prickly_pear: 167750, // Prickly pears, raw
  // pitahaya: sin equivalente en USDA
  soursop: 167761, // Soursop, raw
  starfruit: 171715, // Carambola, (starfruit), raw
  pomegranate: 169134, // Pomegranates, raw
  figs: 173021, // Figs, raw
  fruit_pulp: 167785, // Mango nectar, canned
  juice: 169098, // Orange juice, raw
  chicken: [171447, 0.7], // Chicken, broilers or fryers, meat and skin, raw
  chicken_breast: 171077, // Chicken, broiler or fryers, breast, skinless, boneless, meat only, raw
  chicken_thighs: [172385, 0.72], // Chicken, broilers or fryers, thigh, meat and skin, raw
  chicken_wings: [172390, 0.68], // Chicken, broilers or fryers, wing, meat and skin, raw
  offal: 171060, // Chicken, liver, all classes, raw
  beef_sirloin: 168728, // Beef, top sirloin, steak, separable lean and fat, trimmed to 1/8" fat, choice, raw
  beef_steak: 169532, // Beef, round, top round, steak, separable lean and fat, trimmed to 1/8" fat, choice, raw
  beef_stew: 168668, // Beef, chuck, arm pot roast, separable lean and fat, trimmed to 1/8" fat, choice, raw
  ground_beef: 174036, // Beef, ground, 80% lean meat / 20% fat, raw
  beef_heart: 168625, // Beef, variety meats and by-products, heart, raw
  burgers: 174036, // Beef, ground, 80% lean meat / 20% fat, raw
  breaded_chicken: 171512, // Chicken patty, frozen, uncooked
  pork: 167843, // Pork, fresh, shoulder, whole, separable lean and fat, raw
  pork_chops: 168238, // Pork, fresh, loin, center loin (chops), bone-in, separable lean and fat, raw
  bacon: 168277, // Pork, cured, bacon, unprepared
  ham: 173864, // Ham, sliced, regular (approximately 11% fat)
  cold_cuts: 172013, // Bologna, beef and pork
  pate: 172930, // Pate, liver, not specified, canned
  sausage: 172968, // Frankfurter, meat
  chorizo: 173859, // Sausage, pork, chorizo, link or ground, raw
  blood_sausage: 171618, // Blood sausage
  turkey: 171081, // Turkey, whole, meat and skin, raw
  duck: [172408, 0.6], // Duck, domesticated, meat and skin, raw
  lamb: [174370, 0.8], // Lamb, ground, raw
  // guinea_pig: sin equivalente en USDA
  rabbit: 172521, // Game meat, rabbit, domesticated, composite of cuts, raw
  white_fish: 171955, // Fish, cod, Atlantic, raw
  salmon: 175167, // Fish, salmon, Atlantic, farmed, raw
  trout: 173717, // Fish, trout, rainbow, farmed, raw
  fresh_tuna: 175159, // Fish, tuna, fresh, yellowfin, raw
  shrimp: 174210, // Crustaceans, shrimp, mixed species, raw
  mussels: 174216, // Mollusks, mussel, blue, raw
  scallops: 174220, // Mollusks, scallop, mixed species, raw
  clams: 174214, // Mollusks, clam, mixed species, raw
  squid: 174223, // Mollusks, squid, mixed species, raw
  octopus: 174218, // Mollusks, octopus, common, raw
  crab: 174204, // Crustaceans, crab, blue, raw
  mixed_seafood: 174210, // Crustaceans, shrimp, mixed species, raw
  eggs: 171287, // Egg, whole, raw, fresh
  milk: 171265, // Milk, whole, 3.25% milkfat, with added vitamin D
  plant_milk: 175218, // SILK Plain, soymilk
  butter: 173410, // Butter, salted
  margarine: 172346, // Margarine, regular, 80% fat, composite, stick, with salt
  lard: 171401, // Lard
  heavy_cream: 170859, // Cream, fluid, heavy whipping
  sour_cream: 171257, // Cream, sour, cultured
  yogurt: 171284, // Yogurt, plain, whole milk
  fresh_cheese: 172223, // Cheese, fresh, queso fresco
  cheddar: 173414, // Cheese, cheddar
  parmesan: 170848, // Cheese, parmesan, hard
  mozzarella: 170845, // Cheese, mozzarella, whole milk
  cream_cheese: 173418, // Cheese, cream
  ricotta: 170851, // Cheese, ricotta, whole milk
  chips: 169677, // Snacks, potato chips, plain, salted
  cookies: 172715, // Cookies, chocolate chip, commercially prepared, regular, lower fat
  candy: 167990, // Candies, hard
  ice_cream: 167575, // Ice creams, vanilla
  french_fries: 170523, // Potatoes, french fried, all types, salt not added in processing, frozen, as purchased
  frozen_snacks: 170795, // School Lunch, chicken nuggets, whole grain breaded
  ready_meal: 173334, // Lasagna with meat & sauce, frozen entree
  coffee: 171890, // Beverages, coffee, brewed, prepared with tap water
  tea: 173227, // Beverages, tea, black, brewed, prepared with tap water
  chocolate_drink: 174122, // Beverages, Cocoa mix, powder
};

const dir = process.argv[2];
if (!dir) {
  console.error("Uso: node scripts/import-usda.mjs <carpeta del CSV de SR Legacy>");
  process.exit(1);
}

/** Filas de un CSV con comillas (sin saltos de línea dentro de los campos, como los de FDC). */
function csv(file) {
  return readFileSync(join(dir, file), "utf8").split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
    const out = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") out.push(cur), (cur = "");
      else cur += ch;
    }
    out.push(cur);
    return out;
  });
}

// Nutrientes de FDC: energía (kcal), proteína, carbohidratos por diferencia, grasa total y fibra.
const NUTRIENT = { 1008: "kcal", 1003: "protein", 1005: "carbs", 1004: "fat", 1079: "fiber" };
const wanted = new Set(Object.values(FDC).map((v) => String(Array.isArray(v) ? v[0] : v)));
const rows = new Map([...wanted].map((id) => [id, {}]));
for (const [id, , description] of csv("food.csv")) if (rows.has(id)) rows.get(id).description = description;
for (const [, id, nutrient, amount] of csv("food_nutrient.csv")) {
  const name = NUTRIENT[nutrient];
  if (name && rows.has(id)) rows.get(id)[name] = Number(amount);
}

const round = (v) => Math.round(v * 10) / 10;
const lines = [];
for (const [key, ref] of Object.entries(FDC)) {
  if (!nutrition[key]) throw new Error(`${key} no está en nutrition.mjs`);
  const [id, factor = 1] = Array.isArray(ref) ? ref : [ref];
  const r = rows.get(String(id));
  if (!r?.description || r.kcal == null || r.protein == null || r.fat == null) throw new Error(`${key}: la fila ${id} no tiene kcal, proteína y grasa`);
  const carbs = Math.max(0, (r.carbs ?? 0) - (r.fiber ?? 0));
  const values = [Math.round(r.kcal * factor), round(r.protein * factor), round(carbs * factor), round(r.fat * factor)];
  lines.push(`  ${key}: [${id}, ${values.join(", ")}], // ${r.description}${factor !== 1 ? ` × ${factor}` : ""}`);
}

const out = new URL("../supabase/data/usda.mjs", import.meta.url);
writeFileSync(
  out,
  `// Generado por scripts/import-usda.mjs desde USDA FoodData Central SR Legacy (CC0). No editar a mano.
//
//   clave: [id_fdc, kcal_por_100g, proteína_g, carbohidratos_disponibles_g, grasa_g]
//
// supabase/data/nutrition.mjs usa estos valores en lugar de sus estimados.
export const usda = {
${lines.join("\n")}
};
`,
);
console.log(`${lines.length} alimentos → ${out.pathname}`);
