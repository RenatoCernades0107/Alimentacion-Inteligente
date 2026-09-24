-- Generado por scripts/build-seed.mjs. No editar a mano.

insert into foods (key, name_es, name_en, category, emoji, image_url, shelf_life_days, default_unit, aliases) values
  ('salt', 'Sal', 'Salt', 'basics', '🧂', 'https://www.themealdb.com/images/ingredients/Salt-small.png', 1095, 'g', array[]::text[]),
  ('black_pepper', 'Pimienta negra', 'Black pepper', 'basics', '🫙', 'https://www.themealdb.com/images/ingredients/Black%20Pepper-small.png', 730, 'g', array['pimienta']::text[]),
  ('vegetable_oil', 'Aceite vegetal', 'Vegetable oil', 'basics', '🫗', 'https://www.themealdb.com/images/ingredients/Vegetable%20Oil-small.png', 365, 'l', array['aceite']::text[]),
  ('olive_oil', 'Aceite de oliva', 'Olive oil', 'basics', '🫒', 'https://www.themealdb.com/images/ingredients/Olive%20Oil-small.png', 540, 'l', array[]::text[]),
  ('sugar', 'Azúcar', 'Sugar', 'basics', '🍬', 'https://www.themealdb.com/images/ingredients/Sugar-small.png', 730, 'kg', array[]::text[]),
  ('flour', 'Harina', 'Flour', 'pantry', '🌾', 'https://www.themealdb.com/images/ingredients/Flour-small.png', 365, 'kg', array['harina de trigo']::text[]),
  ('cumin', 'Comino', 'Cumin', 'spices', '🫙', 'https://www.themealdb.com/images/ingredients/Cumin-small.png', 1095, 'g', array[]::text[]),
  ('oregano', 'Orégano', 'Oregano', 'spices', '🌿', 'https://www.themealdb.com/images/ingredients/Oregano-small.png', 1095, 'g', array[]::text[]),
  ('paprika', 'Pimentón / paprika', 'Paprika', 'spices', '🌶️', 'https://www.themealdb.com/images/ingredients/Paprika-small.png', 1095, 'g', array[]::text[]),
  ('cinnamon', 'Canela', 'Cinnamon', 'spices', '🪵', 'https://www.themealdb.com/images/ingredients/Cinnamon-small.png', 1095, 'g', array[]::text[]),
  ('garlic_powder', 'Ajo en polvo', 'Garlic powder', 'spices', '🧄', 'https://www.themealdb.com/images/ingredients/Garlic%20Powder-small.png', 1095, 'g', array[]::text[]),
  ('chili_powder', 'Chile en polvo', 'Chili powder', 'spices', '🌶️', 'https://www.themealdb.com/images/ingredients/Chili%20Powder-small.png', 1095, 'g', array[]::text[]),
  ('bay_leaf', 'Laurel', 'Bay leaf', 'spices', '🍃', 'https://www.themealdb.com/images/ingredients/Bay%20Leaf-small.png', 1095, 'g', array['hoja de laurel']::text[]),
  ('baking_powder', 'Polvo de hornear', 'Baking powder', 'pantry', '🥄', 'https://www.themealdb.com/images/ingredients/Baking%20Powder-small.png', 365, 'g', array['royal']::text[]),
  ('vanilla', 'Esencia de vainilla', 'Vanilla extract', 'pantry', '🍦', 'https://www.themealdb.com/images/ingredients/Vanilla%20Extract-small.png', 1095, 'ml', array['vainilla']::text[]),
  ('yeast', 'Levadura', 'Yeast', 'pantry', '🍞', 'https://www.themealdb.com/images/ingredients/Yeast-small.png', 365, 'g', array[]::text[]),
  ('cornstarch', 'Maicena', 'Cornstarch', 'pantry', '🌽', 'https://www.themealdb.com/images/ingredients/Cornstarch-small.png', 730, 'g', array['fécula de maíz', 'almidón de maíz']::text[]),
  ('soy_sauce', 'Sillao (salsa de soya)', 'Soy sauce', 'pantry', '🥢', 'https://www.themealdb.com/images/ingredients/Soy%20Sauce-small.png', 730, 'ml', array['sillao', 'soya', 'salsa de soja']::text[]),
  ('vinegar', 'Vinagre', 'Vinegar', 'pantry', '🫙', 'https://www.themealdb.com/images/ingredients/Vinegar-small.png', 1095, 'ml', array[]::text[]),
  ('ketchup', 'Kétchup', 'Ketchup', 'pantry', '🍅', 'https://www.themealdb.com/images/ingredients/Tomato%20Ketchup-small.png', 180, 'ml', array['salsa de tomate']::text[]),
  ('mustard', 'Mostaza', 'Mustard', 'pantry', '🟡', 'https://www.themealdb.com/images/ingredients/Mustard-small.png', 365, 'ml', array[]::text[]),
  ('mayonnaise', 'Mayonesa', 'Mayonnaise', 'pantry', '🥚', 'https://www.themealdb.com/images/ingredients/Mayonnaise-small.png', 60, 'g', array['mayo']::text[]),
  ('honey', 'Miel', 'Honey', 'pantry', '🍯', 'https://www.themealdb.com/images/ingredients/Honey-small.png', 730, 'ml', array[]::text[]),
  ('maple_syrup', 'Jarabe de arce', 'Maple syrup', 'pantry', '🍁', 'https://www.themealdb.com/images/ingredients/Maple%20Syrup-small.png', 365, 'ml', array['miel de maple', 'sirope']::text[]),
  ('bbq_sauce', 'Salsa barbacoa', 'BBQ sauce', 'pantry', '🍖', 'https://www.themealdb.com/images/ingredients/Barbeque%20Sauce-small.png', 180, 'ml', array['bbq']::text[]),
  ('tomato_paste', 'Pasta de tomate', 'Tomato paste', 'pantry', '🥫', 'https://www.themealdb.com/images/ingredients/Tomato%20Puree-small.png', 365, 'g', array['puré de tomate']::text[]),
  ('canned_tomatoes', 'Tomate en lata', 'Canned tomatoes', 'pantry', '🥫', 'https://www.themealdb.com/images/ingredients/Canned%20Tomatoes-small.png', 730, 'g', array['tomate triturado']::text[]),
  ('chicken_stock', 'Caldo de pollo', 'Chicken stock', 'pantry', '🍲', 'https://www.themealdb.com/images/ingredients/Chicken%20Stock-small.png', 365, 'l', array['caldo', 'cubito']::text[]),
  ('peanut_butter', 'Mantequilla de maní', 'Peanut butter', 'pantry', '🥜', 'https://www.themealdb.com/images/ingredients/Peanut%20Butter-small.png', 180, 'g', array['crema de cacahuate']::text[]),
  ('evaporated_milk', 'Leche evaporada', 'Evaporated milk', 'pantry', '🥫', 'https://www.themealdb.com/images/ingredients/Evaporated%20Milk-small.png', 365, 'ml', array['leche de tarro']::text[]),
  ('condensed_milk', 'Leche condensada', 'Condensed milk', 'pantry', '🥫', 'https://www.themealdb.com/images/ingredients/Condensed%20Milk-small.png', 365, 'ml', array[]::text[]),
  ('aji_amarillo_paste', 'Pasta de ají amarillo', 'Aji amarillo paste', 'pantry', '🌶️', null, 180, 'g', array['ají amarillo molido', 'crema de ají']::text[]),
  ('aji_panca_paste', 'Pasta de ají panca', 'Aji panca paste', 'pantry', '🌶️', null, 180, 'g', array['ají panca molido']::text[]),
  ('tuna_can', 'Atún en lata', 'Canned tuna', 'pantry', '🐟', 'https://www.themealdb.com/images/ingredients/Tuna-small.png', 1095, 'unit', array['atún']::text[]),
  ('bread_crumbs', 'Pan rallado', 'Breadcrumbs', 'pantry', '🍞', 'https://www.themealdb.com/images/ingredients/Breadcrumbs-small.png', 180, 'g', array['pan molido']::text[]),
  ('soda_crackers', 'Galletas de soda', 'Saltine crackers', 'pantry', '🍘', null, 180, 'unit', array['galletas saladas', 'crackers']::text[]),
  ('cocoa', 'Cacao en polvo', 'Cocoa powder', 'pantry', '🍫', 'https://www.themealdb.com/images/ingredients/Cocoa-small.png', 730, 'g', array['cocoa']::text[]),
  ('chocolate', 'Chocolate', 'Chocolate', 'pantry', '🍫', 'https://www.themealdb.com/images/ingredients/Dark%20Chocolate-small.png', 365, 'g', array[]::text[]),
  ('raisins', 'Pasas', 'Raisins', 'pantry', '🍇', 'https://www.themealdb.com/images/ingredients/Raisins-small.png', 180, 'g', array[]::text[]),
  ('olives', 'Aceitunas', 'Olives', 'pantry', '🫒', 'https://www.themealdb.com/images/ingredients/Black%20Olives-small.png', 365, 'g', array['aceituna de botija']::text[]),
  ('purple_corn', 'Maíz morado', 'Purple corn', 'pantry', '🌽', null, 365, 'kg', array['chicha morada']::text[]),
  ('rice', 'Arroz', 'Rice', 'grains', '🍚', 'https://www.themealdb.com/images/ingredients/Rice-small.png', 730, 'kg', array[]::text[]),
  ('pasta', 'Fideos / tallarines', 'Pasta', 'grains', '🍝', 'https://www.themealdb.com/images/ingredients/Spaghetti-small.png', 730, 'kg', array['spaghetti', 'espagueti', 'tallarín']::text[]),
  ('macaroni', 'Macarrones / coditos', 'Macaroni', 'grains', '🧀', 'https://www.themealdb.com/images/ingredients/Macaroni-small.png', 730, 'kg', array['coditos', 'conchitas']::text[]),
  ('lasagna_sheets', 'Láminas de lasaña', 'Lasagna sheets', 'grains', '🍝', 'https://www.themealdb.com/images/ingredients/Lasagne%20Sheets-small.png', 730, 'kg', array['lasaña']::text[]),
  ('oats', 'Avena', 'Oats', 'grains', '🥣', 'https://www.themealdb.com/images/ingredients/Rolled%20Oats-small.png', 365, 'kg', array['oatmeal']::text[]),
  ('quinoa', 'Quinua', 'Quinoa', 'grains', '🌾', 'https://www.themealdb.com/images/ingredients/Quinoa-small.png', 730, 'kg', array['quinoa']::text[]),
  ('cornmeal', 'Harina de maíz / polenta', 'Cornmeal', 'grains', '🌽', 'https://www.themealdb.com/images/ingredients/Cornmeal-small.png', 365, 'kg', array['polenta', 'grits', 'sémola de maíz']::text[]),
  ('bread', 'Pan', 'Bread', 'grains', '🍞', 'https://www.themealdb.com/images/ingredients/Bread-small.png', 5, 'unit', array['pan francés', 'pan de molde', 'tajada']::text[]),
  ('burger_buns', 'Pan de hamburguesa', 'Burger buns', 'grains', '🍔', null, 7, 'unit', array['bollos']::text[]),
  ('tortillas', 'Tortillas de harina', 'Flour tortillas', 'grains', '🌮', 'https://www.themealdb.com/images/ingredients/Flour%20Tortilla-small.png', 14, 'unit', array['tortilla']::text[]),
  ('canary_beans', 'Frejol canario', 'Canary beans', 'legumes', '🫘', null, 365, 'kg', array['frijol', 'frejoles', 'porotos']::text[]),
  ('kidney_beans', 'Frijol rojo', 'Kidney beans', 'legumes', '🫘', 'https://www.themealdb.com/images/ingredients/Kidney%20Beans-small.png', 365, 'kg', array['frejol rojo', 'red beans']::text[]),
  ('lentils', 'Lentejas', 'Lentils', 'legumes', '🫘', 'https://www.themealdb.com/images/ingredients/Lentils-small.png', 365, 'kg', array[]::text[]),
  ('chickpeas', 'Garbanzos', 'Chickpeas', 'legumes', '🫘', 'https://www.themealdb.com/images/ingredients/Chickpeas-small.png', 365, 'kg', array[]::text[]),
  ('lima_beans', 'Pallares', 'Lima beans', 'legumes', '🫘', 'https://www.themealdb.com/images/ingredients/Butter%20Beans-small.png', 365, 'kg', array['habas blancas']::text[]),
  ('peas', 'Arvejas', 'Peas', 'legumes', '🫛', 'https://www.themealdb.com/images/ingredients/Peas-small.png', 5, 'kg', array['guisantes', 'chícharos']::text[]),
  ('fava_beans', 'Habas', 'Fava beans', 'legumes', '🫛', 'https://www.themealdb.com/images/ingredients/Broad%20Beans-small.png', 5, 'kg', array[]::text[]),
  ('peanuts', 'Maní', 'Peanuts', 'legumes', '🥜', 'https://www.themealdb.com/images/ingredients/Peanuts-small.png', 180, 'g', array['cacahuate']::text[]),
  ('pecans', 'Pecanas / nueces', 'Pecans', 'legumes', '🌰', 'https://www.themealdb.com/images/ingredients/Pecan%20Nuts-small.png', 180, 'g', array['nueces', 'walnuts']::text[]),
  ('potato', 'Papa blanca', 'Potato', 'produce', '🥔', 'https://www.themealdb.com/images/ingredients/Potatoes-small.png', 21, 'kg', array['papa', 'patata']::text[]),
  ('yellow_potato', 'Papa amarilla', 'Yellow potato', 'produce', '🥔', null, 14, 'kg', array[]::text[]),
  ('sweet_potato', 'Camote', 'Sweet potato', 'produce', '🍠', 'https://www.themealdb.com/images/ingredients/Sweet%20Potatoes-small.png', 21, 'kg', array['batata', 'boniato']::text[]),
  ('yuca', 'Yuca', 'Cassava', 'produce', '🥔', null, 7, 'kg', array['mandioca', 'yucca']::text[]),
  ('olluco', 'Olluco', 'Ulluco', 'produce', '🥔', null, 14, 'kg', array[]::text[]),
  ('onion', 'Cebolla', 'Onion', 'produce', '🧅', 'https://www.themealdb.com/images/ingredients/Onion-small.png', 30, 'unit', array['cebolla blanca']::text[]),
  ('red_onion', 'Cebolla roja', 'Red onion', 'produce', '🧅', 'https://www.themealdb.com/images/ingredients/Red%20Onions-small.png', 30, 'unit', array['cebolla morada']::text[]),
  ('green_onion', 'Cebolla china', 'Green onion', 'produce', '🧅', 'https://www.themealdb.com/images/ingredients/Spring%20Onions-small.png', 7, 'unit', array['cebollín', 'cebolla verde', 'cebolleta']::text[]),
  ('garlic', 'Ajo (cabeza)', 'Garlic (head)', 'produce', '🧄', 'https://www.themealdb.com/images/ingredients/Garlic-small.png', 90, 'unit', array['ajos', 'diente de ajo']::text[]),
  ('ginger', 'Kion', 'Ginger', 'produce', '🫚', 'https://www.themealdb.com/images/ingredients/Ginger-small.png', 21, 'g', array['jengibre', 'kión']::text[]),
  ('tomato', 'Tomate', 'Tomato', 'produce', '🍅', 'https://www.themealdb.com/images/ingredients/Tomatoes-small.png', 7, 'unit', array['jitomate']::text[]),
  ('bell_pepper', 'Pimiento', 'Bell pepper', 'produce', '🫑', 'https://www.themealdb.com/images/ingredients/Red%20Pepper-small.png', 10, 'unit', array['morrón', 'pimentón']::text[]),
  ('aji_amarillo', 'Ají amarillo', 'Aji amarillo', 'produce', '🌶️', null, 10, 'unit', array['ají']::text[]),
  ('rocoto', 'Rocoto', 'Rocoto pepper', 'produce', '🌶️', null, 14, 'unit', array[]::text[]),
  ('jalapeno', 'Jalapeño', 'Jalapeño', 'produce', '🌶️', 'https://www.themealdb.com/images/ingredients/Jalapeno-small.png', 10, 'unit', array[]::text[]),
  ('carrot', 'Zanahoria', 'Carrot', 'produce', '🥕', 'https://www.themealdb.com/images/ingredients/Carrots-small.png', 21, 'unit', array[]::text[]),
  ('celery', 'Apio', 'Celery', 'produce', '🥬', 'https://www.themealdb.com/images/ingredients/Celery-small.png', 14, 'unit', array[]::text[]),
  ('lettuce', 'Lechuga', 'Lettuce', 'produce', '🥬', 'https://www.themealdb.com/images/ingredients/Lettuce-small.png', 7, 'unit', array[]::text[]),
  ('spinach', 'Espinaca', 'Spinach', 'produce', '🥬', 'https://www.themealdb.com/images/ingredients/Spinach-small.png', 5, 'g', array[]::text[]),
  ('cabbage', 'Col / repollo', 'Cabbage', 'produce', '🥬', 'https://www.themealdb.com/images/ingredients/Cabbage-small.png', 30, 'unit', array['repollo']::text[]),
  ('broccoli', 'Brócoli', 'Broccoli', 'produce', '🥦', 'https://www.themealdb.com/images/ingredients/Broccoli-small.png', 7, 'unit', array[]::text[]),
  ('corn', 'Choclo', 'Corn on the cob', 'produce', '🌽', 'https://www.themealdb.com/images/ingredients/Sweetcorn-small.png', 5, 'unit', array['elote', 'mazorca', 'maíz']::text[]),
  ('zucchini', 'Zapallito italiano', 'Zucchini', 'produce', '🥒', 'https://www.themealdb.com/images/ingredients/Zucchini-small.png', 7, 'unit', array['calabacín']::text[]),
  ('squash', 'Zapallo', 'Squash', 'produce', '🎃', 'https://www.themealdb.com/images/ingredients/Pumpkin-small.png', 30, 'kg', array['calabaza', 'zapallo macre', 'loche']::text[]),
  ('green_beans', 'Vainitas', 'Green beans', 'produce', '🫛', 'https://www.themealdb.com/images/ingredients/Green%20Beans-small.png', 7, 'kg', array['ejotes', 'judías verdes']::text[]),
  ('mushrooms', 'Champiñones', 'Mushrooms', 'produce', '🍄', 'https://www.themealdb.com/images/ingredients/Mushrooms-small.png', 7, 'g', array['hongos']::text[]),
  ('cucumber', 'Pepino', 'Cucumber', 'produce', '🥒', 'https://www.themealdb.com/images/ingredients/Cucumber-small.png', 7, 'unit', array[]::text[]),
  ('avocado', 'Palta', 'Avocado', 'produce', '🥑', 'https://www.themealdb.com/images/ingredients/Avocado-small.png', 4, 'unit', array['aguacate']::text[]),
  ('cilantro', 'Culantro', 'Cilantro', 'produce', '🌿', 'https://www.themealdb.com/images/ingredients/Cilantro-small.png', 7, 'unit', array['cilantro', 'coriander']::text[]),
  ('parsley', 'Perejil', 'Parsley', 'produce', '🌿', 'https://www.themealdb.com/images/ingredients/Parsley-small.png', 7, 'unit', array[]::text[]),
  ('basil', 'Albahaca', 'Basil', 'produce', '🌿', 'https://www.themealdb.com/images/ingredients/Basil-small.png', 5, 'unit', array[]::text[]),
  ('dill', 'Eneldo', 'Dill', 'produce', '🌿', 'https://www.themealdb.com/images/ingredients/Dill-small.png', 7, 'unit', array[]::text[]),
  ('mint', 'Hierbabuena', 'Mint', 'produce', '🌿', 'https://www.themealdb.com/images/ingredients/Mint-small.png', 7, 'unit', array['menta']::text[]),
  ('huacatay', 'Huacatay', 'Black mint (huacatay)', 'produce', '🌿', null, 7, 'unit', array[]::text[]),
  ('lime', 'Limón', 'Lime', 'fruit', '🍋‍🟩', 'https://www.themealdb.com/images/ingredients/Lime-small.png', 21, 'unit', array['limón sutil', 'lima']::text[]),
  ('lemon', 'Limón amarillo', 'Lemon', 'fruit', '🍋', 'https://www.themealdb.com/images/ingredients/Lemon-small.png', 21, 'unit', array[]::text[]),
  ('banana', 'Plátano', 'Banana', 'fruit', '🍌', 'https://www.themealdb.com/images/ingredients/Banana-small.png', 5, 'unit', array['banana', 'guineo']::text[]),
  ('plantain', 'Plátano de freír', 'Plantain', 'fruit', '🍌', 'https://www.themealdb.com/images/ingredients/Plantain-small.png', 7, 'unit', array['plátano bellaco', 'plátano maduro']::text[]),
  ('apple', 'Manzana', 'Apple', 'fruit', '🍎', 'https://www.themealdb.com/images/ingredients/Apples-small.png', 30, 'unit', array[]::text[]),
  ('orange', 'Naranja', 'Orange', 'fruit', '🍊', 'https://www.themealdb.com/images/ingredients/Orange-small.png', 21, 'unit', array[]::text[]),
  ('strawberries', 'Fresas', 'Strawberries', 'fruit', '🍓', 'https://www.themealdb.com/images/ingredients/Strawberries-small.png', 5, 'g', array['frutillas']::text[]),
  ('blueberries', 'Arándanos', 'Blueberries', 'fruit', '🫐', 'https://www.themealdb.com/images/ingredients/Blueberries-small.png', 7, 'g', array[]::text[]),
  ('mango', 'Mango', 'Mango', 'fruit', '🥭', 'https://www.themealdb.com/images/ingredients/Mango-small.png', 5, 'unit', array[]::text[]),
  ('pineapple', 'Piña', 'Pineapple', 'fruit', '🍍', null, 5, 'unit', array['ananá']::text[]),
  ('peach', 'Durazno', 'Peach', 'fruit', '🍑', 'https://www.themealdb.com/images/ingredients/Peaches-small.png', 5, 'unit', array['melocotón']::text[]),
  ('chicken', 'Pollo (presas)', 'Chicken pieces', 'meat', '🍗', 'https://www.themealdb.com/images/ingredients/Chicken-small.png', 2, 'kg', array['pollo entero', 'gallina']::text[]),
  ('chicken_breast', 'Pechuga de pollo', 'Chicken breast', 'meat', '🍗', 'https://www.themealdb.com/images/ingredients/Chicken%20Breast-small.png', 2, 'kg', array['pechuga']::text[]),
  ('chicken_thighs', 'Pierna / muslo de pollo', 'Chicken thighs', 'meat', '🍗', 'https://www.themealdb.com/images/ingredients/Chicken%20Thighs-small.png', 2, 'kg', array['encuentro', 'muslos']::text[]),
  ('beef_sirloin', 'Lomo de res', 'Beef sirloin', 'meat', '🥩', 'https://www.themealdb.com/images/ingredients/Beef%20Fillet-small.png', 4, 'kg', array['lomo fino', 'bistec', 'steak', 'filete']::text[]),
  ('beef_stew', 'Carne de res para guiso', 'Stewing beef', 'meat', '🥩', 'https://www.themealdb.com/images/ingredients/Beef-small.png', 4, 'kg', array['asado', 'sancochado', 'chuck roast', 'carne de res']::text[]),
  ('ground_beef', 'Carne molida', 'Ground beef', 'meat', '🥩', 'https://www.themealdb.com/images/ingredients/Minced%20Beef-small.png', 2, 'kg', array['carne picada']::text[]),
  ('beef_heart', 'Corazón de res', 'Beef heart', 'meat', '🫀', null, 2, 'kg', array['anticucho']::text[]),
  ('pork', 'Carne de cerdo', 'Pork', 'meat', '🥩', 'https://www.themealdb.com/images/ingredients/Pork-small.png', 4, 'kg', array['chancho', 'panceta', 'pork shoulder']::text[]),
  ('pork_chops', 'Chuletas de cerdo', 'Pork chops', 'meat', '🥩', 'https://www.themealdb.com/images/ingredients/Pork%20Chops-small.png', 4, 'kg', array['chuleta']::text[]),
  ('bacon', 'Tocino', 'Bacon', 'meat', '🥓', 'https://www.themealdb.com/images/ingredients/Bacon-small.png', 7, 'g', array['tocineta', 'panceta ahumada']::text[]),
  ('ham', 'Jamón', 'Ham', 'meat', '🍖', 'https://www.themealdb.com/images/ingredients/Ham-small.png', 5, 'g', array[]::text[]),
  ('sausage', 'Salchicha', 'Sausage', 'meat', '🌭', 'https://www.themealdb.com/images/ingredients/Sausages-small.png', 7, 'unit', array['hot dog', 'hot-dog']::text[]),
  ('chorizo', 'Chorizo', 'Chorizo', 'meat', '🌭', 'https://www.themealdb.com/images/ingredients/Chorizo-small.png', 14, 'unit', array[]::text[]),
  ('turkey', 'Pavo', 'Turkey', 'meat', '🦃', 'https://www.themealdb.com/images/ingredients/Turkey-small.png', 2, 'kg', array[]::text[]),
  ('duck', 'Pato', 'Duck', 'meat', '🦆', 'https://www.themealdb.com/images/ingredients/Duck-small.png', 2, 'kg', array[]::text[]),
  ('white_fish', 'Pescado blanco', 'White fish', 'seafood', '🐟', 'https://www.themealdb.com/images/ingredients/White%20Fish-small.png', 2, 'kg', array['corvina', 'lenguado', 'tilapia', 'merluza', 'bonito', 'perico']::text[]),
  ('salmon', 'Salmón', 'Salmon', 'seafood', '🐟', 'https://www.themealdb.com/images/ingredients/Salmon-small.png', 2, 'kg', array[]::text[]),
  ('trout', 'Trucha', 'Trout', 'seafood', '🐟', 'https://www.themealdb.com/images/ingredients/Trout-small.png', 2, 'kg', array[]::text[]),
  ('shrimp', 'Langostinos / camarones', 'Shrimp', 'seafood', '🦐', 'https://www.themealdb.com/images/ingredients/Prawns-small.png', 2, 'kg', array['camarón', 'gambas', 'langostino']::text[]),
  ('mussels', 'Choros', 'Mussels', 'seafood', '🦪', 'https://www.themealdb.com/images/ingredients/Mussels-small.png', 1, 'kg', array['mejillones', 'choritos']::text[]),
  ('squid', 'Calamar', 'Squid', 'seafood', '🦑', 'https://www.themealdb.com/images/ingredients/Squid-small.png', 2, 'kg', array['pota']::text[]),
  ('eggs', 'Huevos', 'Eggs', 'dairy', '🥚', 'https://www.themealdb.com/images/ingredients/Eggs-small.png', 28, 'unit', array['huevo']::text[]),
  ('milk', 'Leche', 'Milk', 'dairy', '🥛', 'https://www.themealdb.com/images/ingredients/Milk-small.png', 7, 'l', array['leche fresca']::text[]),
  ('butter', 'Mantequilla', 'Butter', 'dairy', '🧈', 'https://www.themealdb.com/images/ingredients/Butter-small.png', 60, 'g', array[]::text[]),
  ('heavy_cream', 'Crema de leche', 'Heavy cream', 'dairy', '🥛', 'https://www.themealdb.com/images/ingredients/Heavy%20Cream-small.png', 10, 'ml', array['nata']::text[]),
  ('sour_cream', 'Crema agria', 'Sour cream', 'dairy', '🥛', 'https://www.themealdb.com/images/ingredients/Sour%20Cream-small.png', 14, 'ml', array[]::text[]),
  ('yogurt', 'Yogur', 'Yogurt', 'dairy', '🥛', 'https://www.themealdb.com/images/ingredients/Yogurt-small.png', 14, 'ml', array['yogurt']::text[]),
  ('fresh_cheese', 'Queso fresco', 'Fresh cheese', 'dairy', '🧀', 'https://www.themealdb.com/images/ingredients/Cheese-small.png', 10, 'g', array['queso']::text[]),
  ('cheddar', 'Queso cheddar', 'Cheddar cheese', 'dairy', '🧀', 'https://www.themealdb.com/images/ingredients/Cheddar%20Cheese-small.png', 28, 'g', array[]::text[]),
  ('parmesan', 'Queso parmesano', 'Parmesan', 'dairy', '🧀', 'https://www.themealdb.com/images/ingredients/Parmesan-small.png', 90, 'g', array[]::text[]),
  ('mozzarella', 'Queso mozzarella', 'Mozzarella', 'dairy', '🧀', 'https://www.themealdb.com/images/ingredients/Mozzarella-small.png', 21, 'g', array[]::text[]),
  ('cream_cheese', 'Queso crema', 'Cream cheese', 'dairy', '🧀', 'https://www.themealdb.com/images/ingredients/Cream%20Cheese-small.png', 21, 'g', array['philadelphia']::text[]),
  ('ricotta', 'Ricota', 'Ricotta', 'dairy', '🧀', 'https://www.themealdb.com/images/ingredients/Ricotta-small.png', 7, 'g', array['requesón']::text[]),
  ('french_fries', 'Papas fritas congeladas', 'Frozen french fries', 'frozen', '🍟', 'https://www.themealdb.com/images/ingredients/Fries-small.png', 180, 'kg', array['papas pre-fritas']::text[]),
  ('coffee', 'Café', 'Coffee', 'beverages', '☕', null, 180, 'g', array[]::text[])
on conflict (key) do update set name_es = excluded.name_es, name_en = excluded.name_en, category = excluded.category,
  emoji = excluded.emoji, image_url = excluded.image_url, shelf_life_days = excluded.shelf_life_days,
  default_unit = excluded.default_unit, aliases = excluded.aliases;

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'ceviche', 'PE', 'Ceviche', 'Ceviche', 'Pescado fresco marinado en limón con cebolla roja, ají y culantro.', 'Fresh fish cured in lime juice with red onion, chili and cilantro.', '🐟', '/recipes/ceviche.jpg', array['lunch']::text[], 4, 30, 'https://www.hora.es/platos-peruanos-caseros/#1-ceviche-peruano',
  array['Corta el pescado en cubos y sazona con sal y ajo.', 'Agrega el jugo de limón recién exprimido, el ají picado y la cebolla en pluma.', 'Deja reposar 2–3 minutos, añade culantro y sirve con camote y choclo.']::text[], array['Cut the fish into cubes and season with salt and garlic.', 'Add freshly squeezed lime juice, chopped chili and thinly sliced onion.', 'Rest 2–3 minutes, add cilantro and serve with sweet potato and corn.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'ceviche');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('white_fish', 0.8::numeric, false),
  ('lime', 15::numeric, false),
  ('red_onion', 1::numeric, false),
  ('aji_amarillo', 1::numeric, false),
  ('cilantro', 0.5::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('salt', 10::numeric, false),
  ('sweet_potato', 0.5::numeric, true),
  ('corn', 2::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'ceviche';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'causa-limena', 'PE', 'Causa limeña', 'Causa limeña', 'Capas de papa amarilla con ají y limón, rellenas de pollo y palta.', 'Layers of yellow potato seasoned with chili and lime, filled with chicken and avocado.', '🥔', '/recipes/causa-limena.jpg', array['lunch', 'dinner']::text[], 4, 45, 'https://www.hora.es/platos-peruanos-caseros/#3-causa-limena',
  array['Sancocha las papas, pélalas y prénsalas en caliente.', 'Mezcla el puré con ají, limón, aceite y sal.', 'Sancocha y deshilacha el pollo; mézclalo con mayonesa.', 'Arma capas: papa, pollo, palta, papa. Decora con huevo y aceituna.']::text[], array['Boil, peel and mash the potatoes while hot.', 'Mix the mash with chili paste, lime, oil and salt.', 'Poach and shred the chicken; mix with mayonnaise.', 'Layer potato, chicken, avocado, potato. Top with egg and olive.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'causa-limena');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('yellow_potato', 1::numeric, false),
  ('aji_amarillo_paste', 60::numeric, false),
  ('lime', 3::numeric, false),
  ('vegetable_oil', 0.05::numeric, false),
  ('chicken_breast', 0.4::numeric, false),
  ('mayonnaise', 150::numeric, false),
  ('avocado', 1::numeric, false),
  ('eggs', 2::numeric, true),
  ('olives', 50::numeric, true),
  ('salt', 5::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'causa-limena';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'papa-a-la-huancaina', 'PE', 'Papa a la huancaína', 'Papa a la huancaína', 'Papas bañadas en una crema de queso fresco y ají amarillo.', 'Potatoes covered in a creamy fresh cheese and yellow chili sauce.', '🥔', '/recipes/papa-a-la-huancaina.jpg', array['lunch', 'dinner', 'snack']::text[], 4, 30, 'https://www.hora.es/platos-peruanos-caseros/#4-papa-a-la-huancaina',
  array['Sancocha las papas y los huevos.', 'Saltea el ají sin venas y licúalo con queso, leche, galletas y aceite.', 'Sirve las papas en rodajas sobre lechuga, cubre con la crema y decora.']::text[], array['Boil the potatoes and eggs.', 'Sauté the deseeded chilies and blend with cheese, milk, crackers and oil.', 'Serve sliced potatoes over lettuce, cover with the sauce and garnish.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'papa-a-la-huancaina');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('yellow_potato', 1::numeric, false),
  ('fresh_cheese', 250::numeric, false),
  ('aji_amarillo', 4::numeric, false),
  ('evaporated_milk', 200::numeric, false),
  ('soda_crackers', 4::numeric, false),
  ('vegetable_oil', 0.05::numeric, false),
  ('eggs', 4::numeric, true),
  ('olives', 50::numeric, true),
  ('lettuce', 1::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'papa-a-la-huancaina';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'lomo-saltado', 'PE', 'Lomo saltado', 'Lomo saltado', 'Salteado de lomo, cebolla y tomate al wok con papas fritas y arroz.', 'Wok-seared beef, onion and tomato with french fries and rice.', '🥩', '/recipes/lomo-saltado.jpg', array['lunch', 'dinner']::text[], 4, 35, 'https://www.hora.es/platos-peruanos-caseros/#31-lomo-saltado',
  array['Corta el lomo en tiras y sazona con sal, pimienta y ajo.', 'Fríe las papas en bastones y prepara el arroz.', 'Saltea la carne a fuego muy alto; agrega cebolla, tomate y ají.', 'Añade sillao y vinagre, termina con culantro y mezcla con las papas.']::text[], array['Cut the beef into strips and season with salt, pepper and garlic.', 'Fry the potatoes as fries and cook the rice.', 'Sear the beef over very high heat; add onion, tomato and chili.', 'Add soy sauce and vinegar, finish with cilantro and toss with the fries.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'lomo-saltado');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('beef_sirloin', 0.6::numeric, false),
  ('red_onion', 2::numeric, false),
  ('tomato', 3::numeric, false),
  ('aji_amarillo', 1::numeric, false),
  ('soy_sauce', 50::numeric, false),
  ('vinegar', 20::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('cilantro', 0.5::numeric, false),
  ('potato', 1::numeric, false),
  ('rice', 0.4::numeric, false),
  ('vegetable_oil', 0.2::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'lomo-saltado';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'aji-de-gallina', 'PE', 'Ají de gallina', 'Ají de gallina', 'Pollo deshilachado en crema de ají amarillo, pan y leche.', 'Shredded chicken in a creamy yellow chili, bread and milk sauce.', '🍛', '/recipes/aji-de-gallina.jpg', array['lunch', 'dinner']::text[], 4, 50, 'https://www.hora.es/platos-peruanos-caseros/#32-aji-de-gallina',
  array['Sancocha la pechuga, deshilacha y guarda el caldo.', 'Remoja el pan en leche y licúa.', 'Haz un aderezo de cebolla, ajo y ají; agrega el pan licuado y caldo.', 'Incorpora el pollo, el parmesano y las pecanas. Sirve con papa y arroz.']::text[], array['Poach the chicken, shred it and save the broth.', 'Soak the bread in milk and blend.', 'Cook onion, garlic and chili paste; add the bread mixture and broth.', 'Stir in chicken, parmesan and pecans. Serve with potato and rice.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'aji-de-gallina');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('chicken_breast', 0.8::numeric, false),
  ('bread', 4::numeric, false),
  ('evaporated_milk', 400::numeric, false),
  ('aji_amarillo_paste', 150::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('parmesan', 50::numeric, false),
  ('pecans', 50::numeric, true),
  ('yellow_potato', 0.6::numeric, false),
  ('rice', 0.4::numeric, false),
  ('eggs', 2::numeric, true),
  ('olives', 50::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'aji-de-gallina';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'arroz-con-pollo', 'PE', 'Arroz con pollo', 'Peruvian green rice with chicken', 'Arroz verde de culantro con presas de pollo y verduras.', 'Cilantro green rice with chicken pieces and vegetables.', '🍗', '/recipes/arroz-con-pollo.jpg', array['lunch']::text[], 4, 60, 'https://www.hora.es/platos-peruanos-caseros/#21-arroz-con-pollo',
  array['Dora las presas de pollo y resérvalas.', 'Licúa el culantro con un poco de caldo.', 'Prepara un aderezo con cebolla, ajo y ají; agrega el culantro, el caldo y el pollo.', 'Añade arroz, arvejas, zanahoria y pimiento; cocina tapado a fuego bajo.']::text[], array['Brown the chicken pieces and set aside.', 'Blend the cilantro with some stock.', 'Cook onion, garlic and chili paste; add the cilantro, stock and chicken.', 'Add rice, peas, carrot and pepper; cook covered over low heat.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'arroz-con-pollo');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('chicken_thighs', 1::numeric, false),
  ('rice', 0.5::numeric, false),
  ('cilantro', 2::numeric, false),
  ('peas', 0.2::numeric, false),
  ('carrot', 1::numeric, false),
  ('bell_pepper', 1::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('aji_amarillo_paste', 30::numeric, false),
  ('chicken_stock', 0.75::numeric, false),
  ('corn', 1::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'arroz-con-pollo';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'arroz-chaufa', 'PE', 'Arroz chaufa', 'Arroz chaufa (Peruvian fried rice)', 'Arroz frito al estilo chifa con pollo, huevo y cebolla china.', 'Chinese-Peruvian fried rice with chicken, egg and green onion.', '🍳', '/recipes/arroz-chaufa.jpg', array['lunch', 'dinner']::text[], 4, 25, 'https://www.hora.es/platos-peruanos-caseros/#24-arroz-chaufa',
  array['Usa arroz cocido del día anterior.', 'Haz una tortilla delgada y córtala en tiras.', 'Saltea el pollo con kion y ajo; agrega el arroz y el sillao.', 'Termina con la tortilla y la cebolla china.']::text[], array['Use cooked, day-old rice.', 'Make a thin omelette and cut into strips.', 'Stir-fry the chicken with ginger and garlic; add rice and soy sauce.', 'Finish with the omelette strips and green onion.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'arroz-chaufa');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('rice', 0.5::numeric, false),
  ('chicken_breast', 0.4::numeric, false),
  ('eggs', 3::numeric, false),
  ('green_onion', 1::numeric, false),
  ('soy_sauce', 60::numeric, false),
  ('ginger', 15::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('vegetable_oil', 0.05::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'arroz-chaufa';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'tallarines-verdes', 'PE', 'Tallarines verdes', 'Peruvian pesto pasta', 'Tallarines con salsa de albahaca, espinaca y queso fresco.', 'Pasta with a basil, spinach and fresh cheese sauce.', '🍝', '/recipes/tallarines-verdes.jpg', array['lunch', 'dinner']::text[], 4, 30, 'https://www.hora.es/platos-peruanos-caseros/#28-tallarines-verdes',
  array['Cocina los tallarines al dente.', 'Blanquea la albahaca y la espinaca.', 'Licúa con queso, leche, cebolla y ajo sofritos.', 'Mezcla con la pasta; acompaña con un bistec si deseas.']::text[], array['Cook the pasta al dente.', 'Blanch the basil and spinach.', 'Blend with cheese, milk and sautéed onion and garlic.', 'Toss with the pasta; serve with a steak if you like.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'tallarines-verdes');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('pasta', 0.5::numeric, false),
  ('basil', 2::numeric, false),
  ('spinach', 200::numeric, false),
  ('fresh_cheese', 150::numeric, false),
  ('evaporated_milk', 200::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('vegetable_oil', 0.05::numeric, false),
  ('beef_sirloin', 0.5::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'tallarines-verdes';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'tallarines-rojos', 'PE', 'Tallarines rojos con pollo', 'Peruvian red spaghetti with chicken', 'Tallarines en salsa de tomate con ají panca y presas de pollo.', 'Spaghetti in a tomato and aji panca sauce with chicken.', '🍝', '/recipes/tallarines-rojos.jpg', array['lunch', 'dinner']::text[], 4, 50, 'https://www.hora.es/platos-peruanos-caseros/#29-tallarines-rojos',
  array['Dora el pollo.', 'Prepara un aderezo con cebolla, ajo y ají panca; agrega tomate licuado, zanahoria y laurel.', 'Cocina el pollo en la salsa 25 minutos.', 'Sirve sobre los tallarines con parmesano.']::text[], array['Brown the chicken.', 'Cook onion, garlic and aji panca; add blended tomato, carrot and bay leaf.', 'Simmer the chicken in the sauce for 25 minutes.', 'Serve over the pasta with parmesan.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'tallarines-rojos');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('pasta', 0.5::numeric, false),
  ('chicken_thighs', 0.8::numeric, false),
  ('tomato', 5::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('carrot', 1::numeric, false),
  ('aji_panca_paste', 30::numeric, false),
  ('bay_leaf', 2::numeric, false),
  ('parmesan', 40::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'tallarines-rojos';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'pollo-a-la-brasa', 'PE', 'Pollo a la brasa (al horno)', 'Peruvian roast chicken', 'Pollo marinado con sillao, comino y ají panca, con papas y ensalada.', 'Chicken marinated in soy sauce, cumin and aji panca, with fries and salad.', '🍗', '/recipes/pollo-a-la-brasa.jpg', array['lunch', 'dinner']::text[], 4, 90, 'https://www.hora.es/platos-peruanos-caseros/#33-pollo-a-la-brasa',
  array['Marina el pollo con sillao, limón, ajo, comino y ají panca (mínimo 4 horas).', 'Hornea a 200 °C por 60–75 minutos, volteando a la mitad.', 'Sirve con papas fritas y ensalada.']::text[], array['Marinate the chicken with soy sauce, lime, garlic, cumin and aji panca (at least 4 hours).', 'Roast at 400 °F for 60–75 minutes, turning halfway.', 'Serve with fries and salad.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'pollo-a-la-brasa');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('chicken', 1.5::numeric, false),
  ('soy_sauce', 60::numeric, false),
  ('lime', 2::numeric, false),
  ('garlic', 0.5::numeric, false),
  ('cumin', 5::numeric, false),
  ('aji_panca_paste', 30::numeric, false),
  ('potato', 1::numeric, false),
  ('lettuce', 1::numeric, true),
  ('tomato', 2::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'pollo-a-la-brasa';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'estofado-de-pollo', 'PE', 'Estofado de pollo', 'Peruvian chicken stew', 'Guiso de pollo con papas, zanahoria y arvejas en salsa de tomate.', 'Chicken stew with potatoes, carrots and peas in tomato sauce.', '🍲', '/recipes/estofado-de-pollo.jpg', array['lunch', 'dinner']::text[], 4, 50, 'https://www.hora.es/platos-peruanos-caseros/#34-estofado-de-pollo',
  array['Dora el pollo.', 'Haz un aderezo con cebolla, ajo, ají panca y tomate licuado.', 'Agrega el pollo, laurel, zanahoria y papas; cocina 30 minutos.', 'Añade las arvejas al final. Sirve con arroz.']::text[], array['Brown the chicken.', 'Cook onion, garlic, aji panca and blended tomato.', 'Add chicken, bay leaf, carrots and potatoes; simmer 30 minutes.', 'Add peas at the end. Serve with rice.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'estofado-de-pollo');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('chicken', 1::numeric, false),
  ('potato', 0.6::numeric, false),
  ('carrot', 2::numeric, false),
  ('peas', 0.2::numeric, false),
  ('tomato', 3::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('aji_panca_paste', 20::numeric, false),
  ('bay_leaf', 2::numeric, false),
  ('rice', 0.4::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'estofado-de-pollo';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'seco-de-res', 'PE', 'Seco de res con frejoles', 'Cilantro beef stew with beans', 'Carne de res guisada en culantro, con frejoles y arroz.', 'Beef braised in cilantro sauce, with beans and rice.', '🍲', '/recipes/seco-de-res.jpg', array['lunch']::text[], 4, 90, 'https://www.hora.es/platos-peruanos-caseros/#39-seco-con-frejoles',
  array['Dora la carne en trozos.', 'Haz un aderezo con cebolla, ajo, ají y culantro licuado.', 'Agrega la carne y el caldo; cocina a fuego bajo 1 hora.', 'Añade zanahoria y arvejas. Sirve con frejoles y arroz.']::text[], array['Brown the beef chunks.', 'Cook onion, garlic, chili and blended cilantro.', 'Add the beef and stock; simmer 1 hour.', 'Add carrot and peas. Serve with beans and rice.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'seco-de-res');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('beef_stew', 0.8::numeric, false),
  ('cilantro', 2::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('aji_amarillo_paste', 30::numeric, false),
  ('peas', 0.2::numeric, false),
  ('carrot', 1::numeric, false),
  ('chicken_stock', 0.5::numeric, false),
  ('canary_beans', 0.3::numeric, true),
  ('rice', 0.4::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'seco-de-res';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'bistec-a-lo-pobre', 'PE', 'Bistec a lo pobre', 'Bistec a lo pobre', 'Bistec con huevo frito, plátano frito, papas fritas y arroz.', 'Steak with fried egg, fried plantain, fries and rice.', '🍳', '/recipes/bistec-a-lo-pobre.jpg', array['lunch']::text[], 4, 35, 'https://www.hora.es/platos-peruanos-caseros/#40-bistec-a-lo-pobre',
  array['Sazona y fríe los bistecs.', 'Fríe papas, plátanos en rodajas y los huevos.', 'Sirve todo junto con arroz blanco.']::text[], array['Season and pan-fry the steaks.', 'Fry potatoes, sliced plantains and the eggs.', 'Serve everything together with white rice.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'bistec-a-lo-pobre');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('beef_sirloin', 0.6::numeric, false),
  ('eggs', 4::numeric, false),
  ('plantain', 2::numeric, false),
  ('potato', 1::numeric, false),
  ('rice', 0.4::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('vegetable_oil', 0.2::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'bistec-a-lo-pobre';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'tacu-tacu', 'PE', 'Tacu tacu', 'Tacu tacu', 'Tortilla crocante de arroz y frejoles, ideal para usar sobras.', 'Crispy rice and bean cake, great for leftovers.', '🫘', '/recipes/tacu-tacu.jpg', array['lunch', 'dinner']::text[], 4, 30, 'https://www.hora.es/platos-peruanos-caseros/#41-tacu-tacu',
  array['Haz un aderezo de cebolla, ajo y ají.', 'Agrega frejoles cocidos y arroz; aplasta y mezcla.', 'Dora en sartén dándole forma de tortilla alargada.', 'Acompaña con huevo y plátano frito.']::text[], array['Cook onion, garlic and chili paste.', 'Add cooked beans and rice; mash and mix.', 'Pan-fry, shaping into an oval cake until crispy.', 'Serve with fried egg and plantain.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'tacu-tacu');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('canary_beans', 0.4::numeric, false),
  ('rice', 0.4::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('aji_amarillo_paste', 20::numeric, false),
  ('vegetable_oil', 0.05::numeric, false),
  ('eggs', 4::numeric, true),
  ('plantain', 2::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'tacu-tacu';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'sopa-criolla', 'PE', 'Sopa criolla', 'Sopa criolla', 'Sopa de carne molida con fideos, leche y huevo.', 'Ground beef soup with noodles, milk and egg.', '🍜', null, array['dinner']::text[], 4, 30, 'https://www.hora.es/platos-peruanos-caseros/#12-sopa-criolla',
  array['Dora la carne con cebolla, ajo, tomate y ají panca.', 'Agrega 1,5 L de agua y hierve.', 'Añade los fideos y cocina 8 minutos.', 'Termina con la leche, orégano y un huevo por plato.']::text[], array['Brown the beef with onion, garlic, tomato and aji panca.', 'Add 1.5 L of water and bring to a boil.', 'Add the noodles and cook 8 minutes.', 'Finish with milk, oregano and an egg per bowl.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'sopa-criolla');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('ground_beef', 0.3::numeric, false),
  ('pasta', 0.15::numeric, false),
  ('evaporated_milk', 200::numeric, false),
  ('eggs', 4::numeric, false),
  ('onion', 1::numeric, false),
  ('tomato', 2::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('aji_panca_paste', 15::numeric, false),
  ('oregano', 2::numeric, false),
  ('bread', 4::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'sopa-criolla';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'aguadito-de-pollo', 'PE', 'Aguadito de pollo', 'Peruvian chicken cilantro soup', 'Sopa espesa de arroz y culantro con pollo y verduras.', 'Hearty cilantro rice soup with chicken and vegetables.', '🍲', '/recipes/aguadito-de-pollo.jpg', array['dinner']::text[], 4, 50, 'https://www.hora.es/platos-peruanos-caseros/#11-aguadito-de-pollo',
  array['Dora el pollo y resérvalo.', 'Aderezo de cebolla, ajo, ají y culantro licuado.', 'Agrega caldo, pollo, arroz y verduras.', 'Cocina hasta que el arroz esté suave.']::text[], array['Brown the chicken and set aside.', 'Cook onion, garlic, chili and blended cilantro.', 'Add stock, chicken, rice and vegetables.', 'Simmer until the rice is tender.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'aguadito-de-pollo');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('chicken', 1::numeric, false),
  ('cilantro', 2::numeric, false),
  ('rice', 0.3::numeric, false),
  ('peas', 0.2::numeric, false),
  ('carrot', 1::numeric, false),
  ('bell_pepper', 1::numeric, false),
  ('potato', 0.5::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('aji_amarillo_paste', 20::numeric, false),
  ('chicken_stock', 1.5::numeric, false),
  ('corn', 1::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'aguadito-de-pollo';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'caldo-de-gallina', 'PE', 'Caldo de gallina', 'Peruvian hen soup', 'Caldo concentrado con fideos, papa amarilla y huevo.', 'Rich chicken broth with noodles, yellow potato and egg.', '🍜', '/recipes/caldo-de-gallina.jpg', array['dinner', 'breakfast']::text[], 4, 120, 'https://www.hora.es/platos-peruanos-caseros/#13-caldo-de-gallina',
  array['Hierve la gallina con kion y sal a fuego bajo por 1,5 horas.', 'Agrega las papas y luego los fideos.', 'Sirve con huevo sancochado, cebolla china y limón.']::text[], array['Simmer the hen with ginger and salt for 1.5 hours.', 'Add the potatoes, then the noodles.', 'Serve with boiled egg, green onion and lime.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'caldo-de-gallina');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('chicken', 1.5::numeric, false),
  ('pasta', 0.2::numeric, false),
  ('yellow_potato', 0.6::numeric, false),
  ('eggs', 4::numeric, false),
  ('ginger', 20::numeric, false),
  ('green_onion', 1::numeric, false),
  ('lime', 2::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'caldo-de-gallina';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'menestron', 'PE', 'Menestrón', 'Menestrón (Peruvian minestrone)', 'Sopa de verduras y carne con pesto de albahaca y queso fresco.', 'Vegetable and beef soup with basil pesto and fresh cheese.', '🥣', '/recipes/menestron.jpg', array['lunch', 'dinner']::text[], 6, 90, 'https://www.hora.es/platos-peruanos-caseros/#15-menestron-peruano',
  array['Hierve la carne 40 minutos.', 'Agrega las verduras en trozos.', 'Licúa albahaca, espinaca y queso; incorpóralo a la sopa.', 'Añade los fideos y cocina hasta que estén listos.']::text[], array['Simmer the beef for 40 minutes.', 'Add chopped vegetables.', 'Blend basil, spinach and cheese; stir into the soup.', 'Add the pasta and cook until done.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'menestron');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('beef_stew', 0.5::numeric, false),
  ('basil', 1::numeric, false),
  ('spinach', 100::numeric, false),
  ('pasta', 0.15::numeric, false),
  ('corn', 1::numeric, false),
  ('potato', 0.4::numeric, false),
  ('squash', 0.3::numeric, false),
  ('carrot', 1::numeric, false),
  ('cabbage', 0.25::numeric, false),
  ('green_beans', 0.1::numeric, false),
  ('fresh_cheese', 100::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'menestron';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'pollo-saltado', 'PE', 'Pollo saltado', 'Pollo saltado', 'Salteado de pollo con cebolla, tomate y papas fritas.', 'Stir-fried chicken with onion, tomato and fries.', '🍗', null, array['lunch', 'dinner']::text[], 4, 30, 'https://www.hora.es/platos-peruanos-caseros/#58-pollo-saltado',
  array['Corta el pollo en tiras y sazónalo.', 'Saltea a fuego alto con ajo; agrega cebolla, tomate y ají.', 'Añade sillao y vinagre; mezcla con papas fritas y culantro.', 'Sirve con arroz.']::text[], array['Cut the chicken into strips and season.', 'Stir-fry over high heat with garlic; add onion, tomato and chili.', 'Add soy sauce and vinegar; toss with fries and cilantro.', 'Serve with rice.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'pollo-saltado');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('chicken_breast', 0.6::numeric, false),
  ('red_onion', 2::numeric, false),
  ('tomato', 3::numeric, false),
  ('aji_amarillo', 1::numeric, false),
  ('soy_sauce', 50::numeric, false),
  ('vinegar', 20::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('cilantro', 0.5::numeric, false),
  ('potato', 1::numeric, false),
  ('rice', 0.4::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'pollo-saltado';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'sudado-de-pescado', 'PE', 'Sudado de pescado', 'Peruvian steamed fish stew', 'Pescado cocido al vapor en un jugo de tomate, cebolla y ají.', 'Fish steamed in a tomato, onion and chili broth.', '🐟', '/recipes/sudado-de-pescado.jpg', array['lunch']::text[], 4, 35, 'https://www.hora.es/platos-peruanos-caseros/#62-sudado-de-pescado',
  array['Haz un aderezo ligero de ajo y ají.', 'Coloca el pescado encima con cebolla y tomate en gajos.', 'Agrega un poco de agua, tapa y cocina 10 minutos.', 'Sirve con yuca sancochada y arroz.']::text[], array['Make a light base of garlic and chili.', 'Place the fish on top with onion and tomato wedges.', 'Add a little water, cover and cook 10 minutes.', 'Serve with boiled cassava and rice.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'sudado-de-pescado');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('white_fish', 0.8::numeric, false),
  ('onion', 1::numeric, false),
  ('tomato', 3::numeric, false),
  ('aji_amarillo', 2::numeric, false),
  ('cilantro', 0.5::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('yuca', 0.5::numeric, false),
  ('rice', 0.4::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'sudado-de-pescado';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'chupe-de-camarones', 'PE', 'Chupe de camarones', 'Peruvian shrimp chowder', 'Sopa cremosa de camarones con papa, choclo, huevo y queso.', 'Creamy shrimp soup with potato, corn, egg and cheese.', '🦐', '/recipes/chupe-de-camarones.jpg', array['lunch', 'dinner']::text[], 4, 60, 'https://www.hora.es/platos-peruanos-caseros/#16-chupe-de-camarones',
  array['Haz un aderezo con cebolla, ajo y ají panca.', 'Agrega agua, papas, choclo, arroz y arvejas.', 'Añade los camarones, luego la leche y el queso.', 'Sirve con un huevo escalfado por plato.']::text[], array['Cook onion, garlic and aji panca.', 'Add water, potatoes, corn, rice and peas.', 'Add the shrimp, then the milk and cheese.', 'Serve with a poached egg per bowl.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'chupe-de-camarones');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('shrimp', 0.5::numeric, false),
  ('potato', 0.5::numeric, false),
  ('corn', 2::numeric, false),
  ('evaporated_milk', 200::numeric, false),
  ('eggs', 4::numeric, false),
  ('fresh_cheese', 150::numeric, false),
  ('rice', 0.1::numeric, false),
  ('peas', 0.1::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('aji_panca_paste', 20::numeric, false),
  ('huacatay', 1::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'chupe-de-camarones';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'anticuchos', 'PE', 'Anticuchos', 'Anticuchos (beef heart skewers)', 'Brochetas de corazón marinado en ají panca, a la parrilla.', 'Grilled beef heart skewers marinated in aji panca.', '🍢', '/recipes/anticuchos.jpg', array['dinner', 'snack']::text[], 4, 40, 'https://www.hora.es/platos-peruanos-caseros/#51-anticuchos',
  array['Corta el corazón en cubos y marina con ají panca, vinagre, ajo, comino y orégano (3 h).', 'Ensarta en palitos.', 'Asa a la parrilla, pintando con la marinada.', 'Sirve con papa dorada y choclo.']::text[], array['Cube the heart and marinate with aji panca, vinegar, garlic, cumin and oregano (3 h).', 'Thread onto skewers.', 'Grill, basting with the marinade.', 'Serve with golden potatoes and corn.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'anticuchos');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('beef_heart', 1::numeric, false),
  ('aji_panca_paste', 100::numeric, false),
  ('vinegar', 60::numeric, false),
  ('garlic', 0.5::numeric, false),
  ('cumin', 5::numeric, false),
  ('oregano', 2::numeric, false),
  ('potato', 0.6::numeric, false),
  ('corn', 2::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'anticuchos';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'papa-rellena', 'PE', 'Papa rellena', 'Papa rellena (stuffed potato)', 'Croquetas de papa rellenas de carne molida, fritas.', 'Fried potato croquettes stuffed with ground beef.', '🥔', '/recipes/papa-rellena.jpg', array['lunch', 'snack']::text[], 4, 60, 'https://www.hora.es/platos-peruanos-caseros/#9-papa-rellena',
  array['Sancocha y prensa las papas.', 'Cocina la carne con cebolla, ajo y ají; añade huevo picado, pasas y aceitunas.', 'Rellena porciones de papa y dales forma.', 'Pasa por harina y fríe hasta dorar.']::text[], array['Boil and mash the potatoes.', 'Cook the beef with onion, garlic and chili; add chopped egg, raisins and olives.', 'Stuff portions of potato and shape them.', 'Dredge in flour and fry until golden.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'papa-rellena');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('potato', 1::numeric, false),
  ('ground_beef', 0.4::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('aji_panca_paste', 20::numeric, false),
  ('eggs', 2::numeric, false),
  ('flour', 0.05::numeric, false),
  ('vegetable_oil', 0.3::numeric, false),
  ('raisins', 30::numeric, true),
  ('olives', 40::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'papa-rellena';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'locro-de-zapallo', 'PE', 'Locro de zapallo', 'Peruvian squash stew', 'Guiso cremoso de zapallo con papa, choclo y queso fresco.', 'Creamy squash stew with potato, corn and fresh cheese.', '🎃', '/recipes/locro-de-zapallo.jpg', array['lunch', 'dinner']::text[], 4, 45, 'https://www.hora.es/platos-peruanos-caseros/#45-locro-de-zapallo',
  array['Haz un aderezo con cebolla, ajo y ají.', 'Agrega el zapallo y las papas en trozos con un poco de agua.', 'Cocina hasta deshacer el zapallo; añade choclo y arvejas.', 'Termina con leche y queso. Sirve con arroz.']::text[], array['Cook onion, garlic and chili paste.', 'Add chopped squash and potatoes with a little water.', 'Cook until the squash breaks down; add corn and peas.', 'Finish with milk and cheese. Serve with rice.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'locro-de-zapallo');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('squash', 1::numeric, false),
  ('potato', 0.5::numeric, false),
  ('corn', 1::numeric, false),
  ('peas', 0.1::numeric, false),
  ('fresh_cheese', 150::numeric, false),
  ('evaporated_milk', 100::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('aji_amarillo_paste', 20::numeric, false),
  ('huacatay', 1::numeric, true),
  ('rice', 0.4::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'locro-de-zapallo';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'pan-con-chicharron', 'PE', 'Pan con chicharrón', 'Pan con chicharrón', 'Pan con chicharrón de cerdo, camote frito y sarsa criolla.', 'Bread roll with crispy pork, fried sweet potato and onion relish.', '🥪', '/recipes/pan-con-chicharron.jpg', array['breakfast']::text[], 4, 90, 'https://www.hora.es/platos-peruanos-caseros/#54-chicharron-de-cerdo',
  array['Hierve el cerdo en agua con sal hasta que se evapore y dórelo en su grasa.', 'Fríe el camote en rodajas.', 'Prepara la sarsa: cebolla en pluma, ají, limón y sal.', 'Arma el pan con chicharrón, camote y sarsa.']::text[], array['Boil the pork in salted water until it evaporates, then crisp it in its fat.', 'Fry sliced sweet potato.', 'Make the relish: sliced onion, chili, lime and salt.', 'Fill the roll with pork, sweet potato and relish.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'pan-con-chicharron');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('bread', 4::numeric, false),
  ('pork', 0.8::numeric, false),
  ('sweet_potato', 0.5::numeric, false),
  ('red_onion', 1::numeric, false),
  ('lime', 2::numeric, false),
  ('aji_amarillo', 1::numeric, true),
  ('vegetable_oil', 0.1::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'pan-con-chicharron';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'pan-con-palta-y-huevo', 'PE', 'Pan con palta y huevo', 'Avocado and egg toast', 'Desayuno rápido de pan con palta y huevo.', 'Quick breakfast of bread with avocado and egg.', '🥑', '/recipes/pan-con-palta-y-huevo.jpg', array['breakfast', 'snack']::text[], 4, 10, null,
  array['Tuesta el pan.', 'Machaca la palta con sal.', 'Cocina los huevos al gusto y arma el pan.']::text[], array['Toast the bread.', 'Mash the avocado with salt.', 'Cook the eggs to taste and assemble.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'pan-con-palta-y-huevo');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('bread', 4::numeric, false),
  ('avocado', 2::numeric, false),
  ('eggs', 4::numeric, false),
  ('salt', 2::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'pan-con-palta-y-huevo';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'quinua-con-manzana', 'PE', 'Quinua con manzana', 'Quinoa apple drink', 'Bebida caliente de quinua con manzana y canela.', 'Warm quinoa drink with apple and cinnamon.', '🥣', '/recipes/quinua-con-manzana.jpg', array['breakfast', 'snack']::text[], 4, 30, null,
  array['Lava bien la quinua.', 'Hierve con 1,5 L de agua, manzana picada y canela por 25 minutos.', 'Endulza y sirve caliente o licuada.']::text[], array['Rinse the quinoa well.', 'Boil with 1.5 L water, chopped apple and cinnamon for 25 minutes.', 'Sweeten and serve warm or blended.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'quinua-con-manzana');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('quinoa', 0.15::numeric, false),
  ('apple', 2::numeric, false),
  ('cinnamon', 5::numeric, false),
  ('sugar', 0.08::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'quinua-con-manzana';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'avena-con-leche', 'PE', 'Avena con leche', 'Oats with milk', 'Avena caliente con leche y canela, clásica del desayuno.', 'Warm oats cooked with milk and cinnamon.', '🥣', '/recipes/avena-con-leche.jpg', array['breakfast']::text[], 4, 15, null,
  array['Hierve la leche con canela.', 'Agrega la avena y cocina 5 minutos moviendo.', 'Endulza al gusto.']::text[], array['Heat the milk with cinnamon.', 'Add the oats and cook 5 minutes, stirring.', 'Sweeten to taste.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'avena-con-leche');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('oats', 0.12::numeric, false),
  ('milk', 1::numeric, false),
  ('cinnamon', 5::numeric, false),
  ('sugar', 0.06::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'avena-con-leche';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'pancakes', 'US', 'Pancakes', 'Pancakes', 'Panqueques esponjosos con miel de maple.', 'Fluffy pancakes with maple syrup.', '🥞', '/recipes/pancakes.jpg', array['breakfast']::text[], 4, 20, 'https://www.bbcgoodfood.com/recipes/2907669/easy-pancakes',
  array['Mezcla harina, polvo de hornear y azúcar.', 'Agrega huevos, leche y mantequilla derretida.', 'Cocina porciones en sartén caliente hasta que salgan burbujas; voltea.', 'Sirve con maple y frutas.']::text[], array['Mix flour, baking powder and sugar.', 'Add eggs, milk and melted butter.', 'Cook ladlefuls on a hot pan until bubbles form; flip.', 'Serve with maple syrup and fruit.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'pancakes');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('flour', 0.2::numeric, false),
  ('eggs', 2::numeric, false),
  ('milk', 0.3::numeric, false),
  ('butter', 30::numeric, false),
  ('sugar', 0.02::numeric, false),
  ('baking_powder', 10::numeric, false),
  ('maple_syrup', 60::numeric, true),
  ('blueberries', 100::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'pancakes';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'eggs-and-bacon', 'US', 'Huevos revueltos con tocino', 'Scrambled eggs and bacon', 'Desayuno clásico americano con tostadas.', 'Classic American breakfast with toast.', '🍳', '/recipes/eggs-and-bacon.jpg', array['breakfast']::text[], 4, 15, null,
  array['Dora el tocino en sartén.', 'Bate los huevos y cocínalos a fuego bajo con mantequilla.', 'Sirve con tostadas.']::text[], array['Crisp the bacon in a skillet.', 'Whisk the eggs and cook over low heat with butter.', 'Serve with toast.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'eggs-and-bacon');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('eggs', 8::numeric, false),
  ('bacon', 200::numeric, false),
  ('butter', 20::numeric, false),
  ('bread', 4::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'eggs-and-bacon';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'buttermilk-biscuits', 'US', 'Biscuits caseros', 'Buttermilk biscuits', 'Panecillos esponjosos de mantequilla.', 'Flaky, buttery homemade biscuits.', '🥐', '/recipes/buttermilk-biscuits.jpg', array['breakfast', 'snack']::text[], 6, 30, 'https://www.theanthonykitchen.com/homemade-buttermilk-biscuits/',
  array['Mezcla harina, polvo de hornear y sal.', 'Integra la mantequilla fría en trocitos.', 'Agrega la leche, dobla la masa y corta.', 'Hornea a 220 °C por 12–15 minutos.']::text[], array['Mix flour, baking powder and salt.', 'Cut in cold butter.', 'Add milk, fold the dough and cut rounds.', 'Bake at 425 °F for 12–15 minutes.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'buttermilk-biscuits');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('flour', 0.3::numeric, false),
  ('butter', 100::numeric, false),
  ('milk', 0.2::numeric, false),
  ('baking_powder', 15::numeric, false),
  ('salt', 5::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'buttermilk-biscuits';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'oatmeal', 'US', 'Oatmeal con frutas', 'Oatmeal with fruit', 'Avena cocida con plátano, arándanos y miel de maple.', 'Oatmeal topped with banana, blueberries and maple syrup.', '🥣', '/recipes/oatmeal.jpg', array['breakfast']::text[], 4, 10, null,
  array['Cocina la avena con la leche 5 minutos.', 'Sirve con plátano, arándanos y maple.']::text[], array['Cook the oats with milk for 5 minutes.', 'Top with banana, blueberries and maple syrup.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'oatmeal');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('oats', 0.2::numeric, false),
  ('milk', 0.8::numeric, false),
  ('banana', 2::numeric, false),
  ('blueberries', 100::numeric, true),
  ('maple_syrup', 40::numeric, true),
  ('peanut_butter', 40::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'oatmeal';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'meatloaf', 'US', 'Pastel de carne (meatloaf)', 'Meatloaf', 'Pan de carne horneado con glaseado de kétchup.', 'Classic baked meatloaf with a ketchup glaze.', '🍖', '/recipes/meatloaf.jpg', array['dinner', 'lunch']::text[], 6, 75, 'https://www.theanthonykitchen.com/traditional-meatloaf-recipe/',
  array['Mezcla carne, pan rallado, huevos, cebolla picada y leche.', 'Forma un pan en un molde.', 'Cubre con kétchup, mostaza y azúcar.', 'Hornea a 180 °C por 1 hora. Acompaña con puré.']::text[], array['Mix beef, breadcrumbs, eggs, chopped onion and milk.', 'Shape into a loaf pan.', 'Top with ketchup, mustard and sugar.', 'Bake at 350 °F for 1 hour. Serve with mashed potatoes.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'meatloaf');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('ground_beef', 0.9::numeric, false),
  ('bread_crumbs', 80::numeric, false),
  ('eggs', 2::numeric, false),
  ('onion', 1::numeric, false),
  ('milk', 0.12::numeric, false),
  ('ketchup', 150::numeric, false),
  ('mustard', 15::numeric, false),
  ('sugar', 0.02::numeric, false),
  ('garlic_powder', 3::numeric, false),
  ('potato', 1::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'meatloaf';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'pot-roast', 'US', 'Asado a la olla (pot roast)', 'Pot roast', 'Carne de res cocida lentamente con papas y zanahorias.', 'Slow-braised beef with potatoes and carrots.', '🥩', '/recipes/pot-roast.jpg', array['dinner', 'lunch']::text[], 6, 210, 'https://www.theanthonykitchen.com/tak-39-s-pot-roast-roast-beef-recipe/',
  array['Sella la carne por todos lados.', 'Agrega cebolla, ajo, caldo y laurel.', 'Tapa y hornea a 160 °C por 2,5 horas.', 'Añade papas y zanahorias la última hora.']::text[], array['Sear the roast on all sides.', 'Add onion, garlic, stock and bay leaf.', 'Cover and bake at 325 °F for 2.5 hours.', 'Add potatoes and carrots for the last hour.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'pot-roast');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('beef_stew', 1.5::numeric, false),
  ('potato', 0.8::numeric, false),
  ('carrot', 4::numeric, false),
  ('onion', 2::numeric, false),
  ('chicken_stock', 0.5::numeric, false),
  ('garlic', 0.5::numeric, false),
  ('bay_leaf', 2::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'pot-roast';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'texas-chili', 'US', 'Chili de Texas', 'Texas chili', 'Guiso picante de carne sin frijoles.', 'Bold, bean-free beef chili.', '🌶️', '/recipes/texas-chili.jpg', array['dinner', 'lunch']::text[], 6, 150, 'https://www.theanthonykitchen.com/texas-chili-recipe/',
  array['Dora la carne en cubos por tandas.', 'Sofríe cebolla, ajo y especias.', 'Agrega tomate y caldo; cocina a fuego bajo 2 horas.', 'Sirve con cheddar.']::text[], array['Brown the cubed beef in batches.', 'Sauté onion, garlic and spices.', 'Add tomatoes and stock; simmer 2 hours.', 'Serve with cheddar.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'texas-chili');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('beef_stew', 1::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.5::numeric, false),
  ('chili_powder', 30::numeric, false),
  ('cumin', 10::numeric, false),
  ('canned_tomatoes', 400::numeric, false),
  ('chicken_stock', 0.5::numeric, false),
  ('jalapeno', 2::numeric, true),
  ('cheddar', 100::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'texas-chili';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'mac-and-cheese', 'US', 'Macarrones con queso', 'Mac and cheese', 'Pasta en salsa cremosa de cheddar.', 'Pasta in a creamy cheddar sauce.', '🧀', '/recipes/mac-and-cheese.jpg', array['lunch', 'dinner']::text[], 4, 30, 'https://www.theanthonykitchen.com/shells-and-cheese-homemade-macaroni-recipe/',
  array['Cocina la pasta.', 'Derrite mantequilla, agrega harina y luego la leche hasta espesar.', 'Incorpora el queso y mezcla con la pasta.']::text[], array['Cook the pasta.', 'Melt butter, whisk in flour, then milk until thick.', 'Stir in the cheese and toss with the pasta.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'mac-and-cheese');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('macaroni', 0.45::numeric, false),
  ('cheddar', 300::numeric, false),
  ('milk', 0.5::numeric, false),
  ('butter', 50::numeric, false),
  ('flour', 0.03::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'mac-and-cheese';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'fried-chicken', 'US', 'Pollo frito sureño', 'Buttermilk fried chicken', 'Pollo marinado en leche y frito crocante.', 'Chicken marinated in buttermilk and fried until crispy.', '🍗', '/recipes/fried-chicken.jpg', array['lunch', 'dinner']::text[], 4, 60, 'https://www.theanthonykitchen.com/buttermilk-fried-chicken/',
  array['Marina el pollo en leche con sal (mínimo 2 h).', 'Pasa por huevo y harina sazonada con paprika y ajo.', 'Fríe en aceite a 170 °C por 12–15 minutos.']::text[], array['Marinate the chicken in buttermilk and salt (2 h+).', 'Dip in egg and flour seasoned with paprika and garlic.', 'Fry at 340 °F for 12–15 minutes.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'fried-chicken');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('chicken_thighs', 1.2::numeric, false),
  ('flour', 0.3::numeric, false),
  ('milk', 0.5::numeric, false),
  ('eggs', 2::numeric, false),
  ('paprika', 10::numeric, false),
  ('garlic_powder', 5::numeric, false),
  ('vegetable_oil', 1::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'fried-chicken';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'chicken-pot-pie', 'US', 'Pastel de pollo (pot pie)', 'Chicken pot pie', 'Relleno cremoso de pollo y verduras con masa hojaldrada.', 'Creamy chicken and vegetable filling under a flaky crust.', '🥧', '/recipes/chicken-pot-pie.jpg', array['dinner']::text[], 6, 75, 'https://www.theanthonykitchen.com/homemade-chicken-pot-pie-real-ingredients-perfect-crust-recipe/',
  array['Prepara la masa con harina, mantequilla fría y agua.', 'Cocina las verduras en mantequilla, agrega harina, caldo y leche.', 'Añade el pollo cocido en cubos.', 'Cubre con la masa y hornea a 200 °C por 35 minutos.']::text[], array['Make the crust with flour, cold butter and water.', 'Cook the vegetables in butter, add flour, stock and milk.', 'Add cubed cooked chicken.', 'Top with crust and bake at 400 °F for 35 minutes.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'chicken-pot-pie');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('chicken_breast', 0.6::numeric, false),
  ('carrot', 2::numeric, false),
  ('peas', 0.2::numeric, false),
  ('celery', 2::numeric, false),
  ('onion', 1::numeric, false),
  ('butter', 150::numeric, false),
  ('flour', 0.4::numeric, false),
  ('milk', 0.25::numeric, false),
  ('chicken_stock', 0.5::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'chicken-pot-pie';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'chicken-and-dumplings', 'US', 'Pollo con dumplings', 'Chicken and dumplings', 'Sopa cremosa de pollo con bolitas de masa.', 'Creamy chicken soup with soft dumplings.', '🍲', '/recipes/chicken-and-dumplings.jpg', array['dinner']::text[], 6, 60, 'https://www.theanthonykitchen.com/creamy-chicken-and-dumplings/',
  array['Cocina el pollo en caldo con verduras.', 'Mezcla harina, polvo de hornear, leche y mantequilla.', 'Deja caer cucharadas de masa sobre la sopa hirviendo.', 'Tapa y cocina 15 minutos.']::text[], array['Simmer the chicken in stock with vegetables.', 'Mix flour, baking powder, milk and butter.', 'Drop spoonfuls of dough onto the simmering soup.', 'Cover and cook 15 minutes.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'chicken-and-dumplings');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('chicken_thighs', 0.8::numeric, false),
  ('flour', 0.25::numeric, false),
  ('baking_powder', 10::numeric, false),
  ('milk', 0.2::numeric, false),
  ('butter', 60::numeric, false),
  ('carrot', 2::numeric, false),
  ('celery', 2::numeric, false),
  ('onion', 1::numeric, false),
  ('chicken_stock', 1.5::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'chicken-and-dumplings';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'beef-stew', 'US', 'Guiso de res americano', 'Beef stew', 'Estofado de res con papas y zanahorias.', 'Hearty beef stew with potatoes and carrots.', '🍲', '/recipes/beef-stew.jpg', array['dinner', 'lunch']::text[], 6, 150, 'https://www.theanthonykitchen.com/dutch-oven-beef-stew/',
  array['Enharina y dora la carne.', 'Sofríe cebolla y apio con pasta de tomate.', 'Agrega caldo, laurel y carne; cocina 1,5 horas.', 'Añade papas y zanahorias y cocina 45 minutos más.']::text[], array['Dust the beef with flour and brown it.', 'Sauté onion and celery with tomato paste.', 'Add stock, bay leaf and beef; simmer 1.5 hours.', 'Add potatoes and carrots and cook 45 more minutes.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'beef-stew');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('beef_stew', 1::numeric, false),
  ('potato', 0.6::numeric, false),
  ('carrot', 3::numeric, false),
  ('onion', 1::numeric, false),
  ('celery', 2::numeric, false),
  ('tomato_paste', 30::numeric, false),
  ('flour', 0.02::numeric, false),
  ('chicken_stock', 1::numeric, false),
  ('bay_leaf', 2::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'beef-stew';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'spaghetti-meatballs', 'US', 'Espaguetis con albóndigas', 'Spaghetti and meatballs', 'Albóndigas de res en salsa de tomate sobre espaguetis.', 'Beef meatballs in tomato sauce over spaghetti.', '🍝', '/recipes/spaghetti-meatballs.jpg', array['dinner', 'lunch']::text[], 4, 50, 'https://www.theanthonykitchen.com/easy-spaghetti-meatballs-recipe/',
  array['Mezcla carne, pan rallado, huevo, parmesano y ajo; forma albóndigas.', 'Dóralas en sartén.', 'Cocínalas en salsa de tomate con cebolla 20 minutos.', 'Sirve sobre los espaguetis.']::text[], array['Mix beef, breadcrumbs, egg, parmesan and garlic; shape meatballs.', 'Brown them in a skillet.', 'Simmer in tomato sauce with onion for 20 minutes.', 'Serve over spaghetti.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'spaghetti-meatballs');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('pasta', 0.5::numeric, false),
  ('ground_beef', 0.5::numeric, false),
  ('bread_crumbs', 50::numeric, false),
  ('eggs', 1::numeric, false),
  ('parmesan', 50::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('canned_tomatoes', 800::numeric, false),
  ('onion', 1::numeric, false),
  ('basil', 1::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'spaghetti-meatballs';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'lasagna', 'US', 'Lasaña', 'Lasagna', 'Capas de pasta, salsa de carne y quesos.', 'Layers of pasta, meat sauce and cheese.', '🍝', '/recipes/lasagna.jpg', array['dinner']::text[], 8, 90, 'https://www.theanthonykitchen.com/lazy-homemade-lasagna-recipe/',
  array['Prepara una salsa de carne con cebolla, ajo y tomate.', 'Arma capas de pasta, salsa, ricota y mozzarella.', 'Termina con queso y parmesano.', 'Hornea tapado a 190 °C por 45 minutos y 10 sin tapar.']::text[], array['Make a meat sauce with onion, garlic and tomatoes.', 'Layer pasta, sauce, ricotta and mozzarella.', 'Finish with cheese and parmesan.', 'Bake covered at 375 °F for 45 minutes, then 10 uncovered.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'lasagna');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('lasagna_sheets', 0.35::numeric, false),
  ('ground_beef', 0.5::numeric, false),
  ('canned_tomatoes', 800::numeric, false),
  ('mozzarella', 300::numeric, false),
  ('ricotta', 250::numeric, false),
  ('parmesan', 60::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'lasagna';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'cheeseburgers', 'US', 'Hamburguesas con queso', 'Skillet cheeseburgers', 'Hamburguesas caseras a la sartén con cheddar.', 'Homemade skillet burgers with cheddar.', '🍔', '/recipes/cheeseburgers.jpg', array['lunch', 'dinner']::text[], 4, 25, 'https://www.theanthonykitchen.com/skillet-cheese-burgers-with-a-smoky-mustard-sauce-recipe/',
  array['Forma 4 hamburguesas y sazona.', 'Cocina en sartén caliente 4 minutos por lado.', 'Pon el queso encima para que se derrita.', 'Arma con pan, lechuga, tomate y salsas.']::text[], array['Shape 4 patties and season.', 'Cook in a hot skillet 4 minutes per side.', 'Top with cheese to melt.', 'Assemble with buns, lettuce, tomato and sauces.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'cheeseburgers');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('ground_beef', 0.7::numeric, false),
  ('burger_buns', 4::numeric, false),
  ('cheddar', 120::numeric, false),
  ('mustard', 20::numeric, false),
  ('lettuce', 1::numeric, true),
  ('tomato', 1::numeric, true),
  ('onion', 1::numeric, true),
  ('ketchup', 40::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'cheeseburgers';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'grilled-cheese', 'US', 'Sándwich de queso a la plancha', 'Grilled cheese', 'Pan dorado con mantequilla y queso derretido.', 'Buttery golden bread with melted cheese.', '🥪', '/recipes/grilled-cheese.jpg', array['lunch', 'snack', 'dinner']::text[], 4, 15, 'https://www.theanthonykitchen.com/havarti-and-cheddar-grilled-cheese-sandwich-recipe/',
  array['Unta mantequilla por fuera del pan.', 'Rellena con queso.', 'Dora a fuego medio 3 minutos por lado.']::text[], array['Butter the outside of the bread.', 'Fill with cheese.', 'Cook over medium heat 3 minutes per side.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'grilled-cheese');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('bread', 8::numeric, false),
  ('cheddar', 200::numeric, false),
  ('butter', 40::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'grilled-cheese';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'tomato-soup', 'US', 'Sopa cremosa de tomate', 'Creamy tomato soup', 'Sopa de tomate suave, ideal con grilled cheese.', 'Smooth tomato soup, perfect with grilled cheese.', '🍅', '/recipes/tomato-soup.jpg', array['dinner', 'lunch']::text[], 4, 35, 'https://www.theanthonykitchen.com/creamy-tomato-soup-recipe/',
  array['Sofríe cebolla y ajo en mantequilla.', 'Agrega tomate y caldo; cocina 20 minutos.', 'Licúa y termina con la crema.']::text[], array['Sauté onion and garlic in butter.', 'Add tomatoes and stock; simmer 20 minutes.', 'Blend and finish with cream.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'tomato-soup');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('canned_tomatoes', 800::numeric, false),
  ('onion', 1::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('heavy_cream', 200::numeric, false),
  ('chicken_stock', 0.5::numeric, false),
  ('butter', 30::numeric, false),
  ('basil', 1::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'tomato-soup';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'pulled-pork', 'US', 'Cerdo deshilachado BBQ', 'BBQ pulled pork sandwiches', 'Cerdo cocido lento con salsa barbacoa, en pan.', 'Slow-cooked pork with BBQ sauce on buns.', '🐖', '/recipes/pulled-pork.jpg', array['lunch', 'dinner']::text[], 8, 480, 'https://www.theanthonykitchen.com/bbq-pulled-pork-in-the-slow-cooker/',
  array['Frota el cerdo con paprika, azúcar y sal.', 'Cocina lento con cebolla por 8 horas (o 3 h a presión).', 'Deshilacha y mezcla con salsa BBQ.', 'Sirve en pan con ensalada de col.']::text[], array['Rub the pork with paprika, sugar and salt.', 'Slow-cook with onion for 8 hours (or 3 h pressure).', 'Shred and mix with BBQ sauce.', 'Serve on buns with coleslaw.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'pulled-pork');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('pork', 1.5::numeric, false),
  ('bbq_sauce', 300::numeric, false),
  ('burger_buns', 8::numeric, false),
  ('onion', 1::numeric, false),
  ('paprika', 10::numeric, false),
  ('sugar', 0.03::numeric, false),
  ('cabbage', 0.5::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'pulled-pork';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'smothered-pork-chops', 'US', 'Chuletas en salsa de cebolla', 'Smothered pork chops', 'Chuletas de cerdo en salsa cremosa de cebolla.', 'Pork chops in a creamy onion gravy.', '🥩', '/recipes/smothered-pork-chops.jpg', array['dinner']::text[], 4, 45, 'https://www.theanthonykitchen.com/smothered-pork-chops/',
  array['Enharina y dora las chuletas.', 'Sofríe la cebolla en la misma sartén.', 'Agrega caldo y crema, vuelve las chuletas y cocina 20 minutos.']::text[], array['Dredge and brown the chops.', 'Cook the onions in the same pan.', 'Add stock and cream, return the chops and simmer 20 minutes.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'smothered-pork-chops');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('pork_chops', 0.8::numeric, false),
  ('onion', 2::numeric, false),
  ('flour', 0.03::numeric, false),
  ('chicken_stock', 0.5::numeric, false),
  ('heavy_cream', 100::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('rice', 0.3::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'smothered-pork-chops';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'steak-fajitas', 'US', 'Fajitas de res', 'Steak fajitas', 'Tiras de res con pimientos y cebolla en tortillas.', 'Seared steak strips with peppers and onion in tortillas.', '🌮', '/recipes/steak-fajitas.jpg', array['dinner', 'lunch']::text[], 4, 40, 'https://www.theanthonykitchen.com/steak-fajitas/',
  array['Marina la carne con limón, ajo y especias.', 'Sella la carne a fuego alto y córtala en tiras.', 'Saltea pimientos y cebolla.', 'Sirve en tortillas calientes.']::text[], array['Marinate the steak with lime, garlic and spices.', 'Sear over high heat and slice.', 'Sauté peppers and onion.', 'Serve in warm tortillas.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'steak-fajitas');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('beef_sirloin', 0.7::numeric, false),
  ('bell_pepper', 3::numeric, false),
  ('onion', 1::numeric, false),
  ('tortillas', 8::numeric, false),
  ('lime', 2::numeric, false),
  ('cumin', 5::numeric, false),
  ('chili_powder', 5::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('sour_cream', 100::numeric, true),
  ('avocado', 1::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'steak-fajitas';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'shrimp-and-grits', 'US', 'Camarones con polenta (grits)', 'Shrimp and grits', 'Camarones salteados sobre sémola de maíz cremosa con queso.', 'Sautéed shrimp over creamy cheese grits.', '🦐', '/recipes/shrimp-and-grits.jpg', array['dinner', 'breakfast']::text[], 4, 35, 'https://www.theanthonykitchen.com/shrimp-and-grits/',
  array['Cocina la sémola en leche y agua hasta espesar; agrega queso y mantequilla.', 'Dora el tocino y saltea los camarones con ajo en su grasa.', 'Sirve los camarones sobre los grits con cebolla china.']::text[], array['Cook the grits in milk and water until thick; stir in cheese and butter.', 'Crisp the bacon, then sauté the shrimp with garlic in its fat.', 'Serve shrimp over grits with green onion.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'shrimp-and-grits');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('shrimp', 0.5::numeric, false),
  ('cornmeal', 0.25::numeric, false),
  ('cheddar', 100::numeric, false),
  ('butter', 40::numeric, false),
  ('milk', 0.5::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('green_onion', 1::numeric, false),
  ('bacon', 100::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'shrimp-and-grits';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'salmon-dill', 'US', 'Salmón con salsa de eneldo', 'Salmon with dill sauce', 'Salmón al horno con salsa fresca de eneldo y limón.', 'Baked salmon with a fresh dill and lemon sauce.', '🐟', '/recipes/salmon-dill.jpg', array['dinner']::text[], 4, 25, 'https://www.theanthonykitchen.com/salmon-with-dill-sauce/',
  array['Sazona el salmón con sal, pimienta y aceite.', 'Hornea a 200 °C por 12–15 minutos.', 'Mezcla crema agria, eneldo y limón; sirve encima.']::text[], array['Season the salmon with salt, pepper and oil.', 'Bake at 400 °F for 12–15 minutes.', 'Mix sour cream, dill and lemon; spoon over.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'salmon-dill');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('salmon', 0.7::numeric, false),
  ('sour_cream', 150::numeric, false),
  ('lemon', 1::numeric, false),
  ('dill', 1::numeric, false),
  ('olive_oil', 0.02::numeric, false),
  ('broccoli', 1::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'salmon-dill';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'oven-baked-chicken', 'US', 'Pollo al horno', 'Oven baked chicken', 'Presas de pollo sazonadas y horneadas, jugosas y fáciles.', 'Juicy, easy seasoned baked chicken.', '🍗', '/recipes/oven-baked-chicken.jpg', array['dinner', 'lunch']::text[], 4, 45, 'https://www.theanthonykitchen.com/oven-baked-chicken/',
  array['Seca el pollo y úntalo con aceite y especias.', 'Hornea a 220 °C por 35–40 minutos.', 'Acompaña con verduras asadas.']::text[], array['Pat the chicken dry and rub with oil and spices.', 'Bake at 425 °F for 35–40 minutes.', 'Serve with roasted vegetables.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'oven-baked-chicken');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('chicken_thighs', 1::numeric, false),
  ('paprika', 5::numeric, false),
  ('garlic_powder', 5::numeric, false),
  ('olive_oil', 0.03::numeric, false),
  ('broccoli', 1::numeric, true),
  ('potato', 0.6::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'oven-baked-chicken';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'red-beans-and-rice', 'US', 'Frijoles rojos con arroz', 'Red beans and rice', 'Clásico de Luisiana con salchicha ahumada.', 'Louisiana classic with smoked sausage.', '🫘', '/recipes/red-beans-and-rice.jpg', array['lunch', 'dinner']::text[], 6, 180, 'https://www.theanthonykitchen.com/slow-cooker-red-beans-and-rice/',
  array['Remoja los frijoles la noche anterior.', 'Sofríe cebolla, pimiento, apio y ajo.', 'Cocina con frijoles, caldo y laurel 2–3 horas.', 'Agrega la salchicha y sirve sobre arroz.']::text[], array['Soak the beans overnight.', 'Sauté onion, pepper, celery and garlic.', 'Simmer with beans, stock and bay leaf 2–3 hours.', 'Add the sausage and serve over rice.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'red-beans-and-rice');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('kidney_beans', 0.45::numeric, false),
  ('sausage', 4::numeric, false),
  ('onion', 1::numeric, false),
  ('bell_pepper', 1::numeric, false),
  ('celery', 2::numeric, false),
  ('garlic', 0.25::numeric, false),
  ('rice', 0.4::numeric, false),
  ('bay_leaf', 2::numeric, false),
  ('chicken_stock', 1::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'red-beans-and-rice';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'chicken-broccoli-rice-casserole', 'US', 'Gratinado de pollo, brócoli y arroz', 'Cheesy chicken, broccoli and rice casserole', 'Arroz horneado con pollo, brócoli y cheddar.', 'Baked rice with chicken, broccoli and cheddar.', '🥦', '/recipes/chicken-broccoli-rice-casserole.jpg', array['dinner']::text[], 6, 60, 'https://www.theanthonykitchen.com/cheesy-chicken-broccoli-and-rice-casserole-recipe/',
  array['Mezcla arroz crudo, caldo, crema y cebolla en una fuente.', 'Agrega el pollo en cubos y el brócoli.', 'Tapa y hornea a 190 °C por 45 minutos.', 'Cubre con cheddar y gratina.']::text[], array['Mix raw rice, stock, cream and onion in a baking dish.', 'Add cubed chicken and broccoli.', 'Cover and bake at 375 °F for 45 minutes.', 'Top with cheddar and broil.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'chicken-broccoli-rice-casserole');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('chicken_breast', 0.6::numeric, false),
  ('rice', 0.3::numeric, false),
  ('cheddar', 150::numeric, false),
  ('broccoli', 1::numeric, false),
  ('chicken_stock', 0.6::numeric, false),
  ('onion', 1::numeric, false),
  ('heavy_cream', 150::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'chicken-broccoli-rice-casserole';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'club-sandwich', 'US', 'Club sándwich', 'Club sandwich', 'Sándwich triple de jamón, tocino, lechuga y tomate.', 'Triple-decker sandwich with ham, bacon, lettuce and tomato.', '🥪', '/recipes/club-sandwich.jpg', array['lunch', 'snack']::text[], 2, 20, 'https://www.theanthonykitchen.com/the-ultimate-club-sandwich-recipe/',
  array['Tuesta el pan y dora el tocino.', 'Unta mayonesa y arma capas con jamón, tocino, lechuga y tomate.', 'Corta en triángulos.']::text[], array['Toast the bread and crisp the bacon.', 'Spread mayo and layer ham, bacon, lettuce and tomato.', 'Cut into triangles.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'club-sandwich');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('bread', 6::numeric, false),
  ('ham', 150::numeric, false),
  ('bacon', 100::numeric, false),
  ('lettuce', 0.5::numeric, false),
  ('tomato', 1::numeric, false),
  ('mayonnaise', 40::numeric, false),
  ('cheddar', 60::numeric, true)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'club-sandwich';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'potato-salad', 'US', 'Ensalada de papa', 'Old-fashioned potato salad', 'Papa, huevo y apio en aderezo de mayonesa y mostaza.', 'Potato, egg and celery in a mayo-mustard dressing.', '🥗', '/recipes/potato-salad.jpg', array['lunch', 'snack']::text[], 6, 40, 'https://www.theanthonykitchen.com/old-fashioned-potato-salad-recipe/',
  array['Sancocha papas y huevos; córtalos en cubos.', 'Mezcla mayonesa, mostaza, apio y cebolla.', 'Integra todo y refrigera 1 hora.']::text[], array['Boil potatoes and eggs; cube them.', 'Mix mayo, mustard, celery and onion.', 'Combine and chill 1 hour.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'potato-salad');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('potato', 1::numeric, false),
  ('eggs', 4::numeric, false),
  ('mayonnaise', 200::numeric, false),
  ('mustard', 20::numeric, false),
  ('celery', 1::numeric, false),
  ('red_onion', 0.5::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'potato-salad';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'cornbread', 'US', 'Pan de maíz (cornbread)', 'Cornbread', 'Pan dulce de harina de maíz horneado.', 'Slightly sweet baked cornbread.', '🌽', '/recipes/cornbread.jpg', array['snack', 'breakfast']::text[], 8, 35, 'https://www.theanthonykitchen.com/co-cornbread-recipe/',
  array['Mezcla los secos y aparte los húmedos.', 'Une sin batir demasiado.', 'Hornea a 200 °C por 20–25 minutos.']::text[], array['Mix the dry and wet ingredients separately.', 'Combine without overmixing.', 'Bake at 400 °F for 20–25 minutes.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'cornbread');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('cornmeal', 0.2::numeric, false),
  ('flour', 0.15::numeric, false),
  ('milk', 0.25::numeric, false),
  ('eggs', 2::numeric, false),
  ('butter', 60::numeric, false),
  ('sugar', 0.05::numeric, false),
  ('baking_powder', 15::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'cornbread';

insert into recipes (slug, country, name_es, name_en, description_es, description_en, emoji, image_url, meal_types, servings, time_minutes, source_url, steps_es, steps_en) values (
  'peanut-butter-cookies', 'US', 'Galletas de mantequilla de maní', 'Peanut butter cookies', 'Galletas de 3 ingredientes.', 'Easy 3-ingredient cookies.', '🍪', '/recipes/peanut-butter-cookies.jpg', array['snack']::text[], 12, 20, 'https://tasty.co/recipe/3-ingredient-peanut-butter-cookies',
  array['Mezcla todo.', 'Forma bolitas y aplástalas con un tenedor.', 'Hornea a 180 °C por 10 minutos.']::text[], array['Mix everything.', 'Roll into balls and press with a fork.', 'Bake at 350 °F for 10 minutes.']::text[])
on conflict (slug) do update set country = excluded.country, name_es = excluded.name_es, name_en = excluded.name_en,
  description_es = excluded.description_es, description_en = excluded.description_en, emoji = excluded.emoji, image_url = excluded.image_url,
  meal_types = excluded.meal_types, servings = excluded.servings, time_minutes = excluded.time_minutes,
  source_url = excluded.source_url, steps_es = excluded.steps_es, steps_en = excluded.steps_en;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'peanut-butter-cookies');
insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional)
select r.id, f.id, v.qty, f.default_unit, v.opt from (values
  ('peanut_butter', 250::numeric, false),
  ('sugar', 0.2::numeric, false),
  ('eggs', 1::numeric, false)
) as v(key, qty, opt)
join foods f on f.key = v.key
join recipes r on r.slug = 'peanut-butter-cookies';

