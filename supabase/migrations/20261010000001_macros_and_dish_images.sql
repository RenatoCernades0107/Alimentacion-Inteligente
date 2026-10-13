-- Macronutrientes de los alimentos y fotos de los platos generadas con IA.
--
-- * foods.protein_100g / carbs_100g / fat_100g: gramos por 100 g, en el mismo estado que kcal_100g
--   (crudo o seco). Los del catálogo vienen del seed (supabase/data/nutrition.mjs); los alimentos
--   propios quedan en null. Los macros de una receta NO se guardan: la app los calcula de sus
--   ingredientes al leerla (src/lib/nutrition.ts, macrosPerServing), igual para recetas propias.
-- * recipes.image_requested_at: candado para que la foto de un plato se genere una sola vez aunque
--   varias pantallas la pidan a la vez (src/lib/dish-image.ts). Solo lo escribe el servidor con la
--   service role; las políticas de recipes no cambian (los usuarios siguen sin poder escribirla).
-- * Bucket público dish-images: las fotos generadas (WebP). Se leen por URL pública; solo la service
--   role sube archivos (no hay políticas de escritura para usuarios).

alter table foods
  add column protein_100g numeric check (protein_100g between 0 and 100),
  add column carbs_100g numeric check (carbs_100g between 0 and 100),
  add column fat_100g numeric check (fat_100g between 0 and 100);

alter table recipes
  add column image_requested_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-images', 'dish-images', true, 2097152, array['image/webp'])
on conflict (id) do nothing;
