-- Recetas propias, versiones personales de las recetas del catálogo y recetas favoritas.
--
-- * Las recetas del catálogo (las del seed) siguen siendo globales y de solo lectura: `family_id` es null.
-- * Una receta propia tiene `family_id` (la familia de quien la creó) y `created_by`.
-- * Editar una receta que no es tuya (del catálogo o de otro integrante) NUNCA la modifica: la primera vez
--   que guardas se crea tu propia versión (`parent_recipe_id` apunta a la original) y las siguientes
--   ediciones actualizan esa misma versión (índice único: una versión por autor y original).
-- * recipe_favorites: favoritas por usuario (no por familia).
--
-- Visibilidad (RLS): catálogo -> todos los usuarios autenticados; recetas propias -> toda la familia del
-- autor (el calendario es compartido: los demás integrantes tienen que poder leer la receta de una comida).
-- Escritura: solo por las funciones `save_recipe` / `delete_recipe` (security definer), que validan
-- permisos, familia y rangos; el cliente no puede escribir en las tablas. Nunca se confía en ids de
-- dueño o familia enviados por el cliente: salen de auth.uid() y de my_family_id().
--
--   * Editar: solo el autor, y solo en su propia receta; los demás obtienen su copia.
--   * Eliminar: el autor y los padres de su familia (moderación, y para limpiar recetas de quien ya
--     no está en la familia). Las recetas del catálogo no se pueden eliminar.
--
-- Seed: supabase/seed.sql solo hace upsert por `slug` de las recetas del catálogo y nunca borra recetas, así
-- que no toca las propias. Los slugs propios llevan un sufijo `_` + 8 hex aleatorios (el CHECK lo exige) y
-- ningún slug del catálogo tiene guion bajo, por lo que tampoco pueden chocar.

-------------------------------------------------------------------------------
-- Columnas nuevas (todas con valor por defecto o null: el seed existente sigue funcionando)
-------------------------------------------------------------------------------
alter table recipes
  add column family_id uuid references families on delete cascade,               -- null = catálogo global
  add column created_by uuid references profiles on delete set null,
  add column parent_recipe_id uuid references recipes on delete set null,         -- original de una versión personal
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

alter table recipes
  -- El catálogo no tiene dueño ni original.
  add constraint recipes_catalog_shape check (family_id is not null or (created_by is null and parent_recipe_id is null)),
  -- Slug de una receta propia: nombre en kebab-case + "_" + 8 hex (los del catálogo nunca llevan "_").
  add constraint recipes_custom_slug check (family_id is null or slug ~ '^[a-z0-9-]{0,60}_[0-9a-f]{8}$'),
  add constraint recipes_not_own_parent check (parent_recipe_id is distinct from id);

-- Una sola versión personal por autor y receta original (evita duplicados al editar varias veces).
create unique index recipes_one_copy_per_author on recipes (created_by, parent_recipe_id) where parent_recipe_id is not null;
create index recipes_family_idx on recipes (family_id) where family_id is not null;
create index recipes_parent_idx on recipes (parent_recipe_id) where parent_recipe_id is not null;

-- Orden de los ingredientes tal como los escribió el autor (el seed no lo usa: queda en 0).
alter table recipe_ingredients add column position int not null default 0;

-------------------------------------------------------------------------------
-- Favoritas
-------------------------------------------------------------------------------
create table recipe_favorites (
  user_id uuid not null references profiles on delete cascade,
  recipe_id uuid not null references recipes on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);
create index on recipe_favorites (recipe_id);

-------------------------------------------------------------------------------
-- RLS y privilegios
-------------------------------------------------------------------------------
alter table recipe_favorites enable row level security;

-- Las recetas solo se leen; se escribe por RPC.
revoke insert, update, delete, truncate on recipes, recipe_ingredients from anon, authenticated;
revoke all on recipe_favorites from anon, authenticated;
grant select, insert, delete on recipe_favorites to authenticated;
grant all on recipe_favorites to service_role;

drop policy "recetas: todos ven" on recipes;
drop policy "ingredientes: todos ven" on recipe_ingredients;

create policy "recetas: catálogo y las de mi familia" on recipes for select to authenticated
  using (family_id is null or family_id = (select my_family_id()));

-- Los ingredientes se ven si se ve la receta (la subconsulta aplica la política de recipes).
create policy "ingredientes: los de las recetas que veo" on recipe_ingredients for select to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id));

create policy "favoritas: ver las propias" on recipe_favorites for select to authenticated
  using (user_id = auth.uid());
-- Solo se puede marcar como favorita una receta que se puede ver.
create policy "favoritas: marcar las propias" on recipe_favorites for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from recipes r where r.id = recipe_favorites.recipe_id));
create policy "favoritas: quitar las propias" on recipe_favorites for delete to authenticated
  using (user_id = auth.uid());

-------------------------------------------------------------------------------
-- Eliminar una receta: las comidas del calendario que la usan se quedan con su nombre
-------------------------------------------------------------------------------
-- meals y meal_series exigen `recipe_id` o `title`, y la FK es "on delete set null": sin esto, borrar una
-- receta programada fallaría. Antes de borrarla, las comidas y series que la usan guardan su nombre (y
-- las kcal por porción) como si fueran comidas escritas a mano. Es un trigger para que valga también
-- cuando la receta se borra en cascada (familia, administración).
create or replace function recipes_keep_meal_titles() returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_kcal int := case when old.kcal_per_serving between 1 and 3000 then old.kcal_per_serving end;
begin
  update meals
     set title = coalesce(title, old.name_es), kcal_per_serving = coalesce(kcal_per_serving, v_kcal)
   where recipe_id = old.id;
  update meal_series
     set title = coalesce(title, old.name_es), kcal_per_serving = coalesce(kcal_per_serving, v_kcal)
   where recipe_id = old.id;
  return old;
end $$;

create trigger recipes_keep_meal_titles before delete on recipes
  for each row execute function recipes_keep_meal_titles();

revoke execute on function recipes_keep_meal_titles() from public, anon, authenticated;

-------------------------------------------------------------------------------
-- RPCs
-------------------------------------------------------------------------------

-- Crea o edita una receta propia. `p_id` es la receta que se está editando (null = receta nueva):
--   * es mía (mi familia, creada por mí)  -> se actualiza en su lugar;
--   * es del catálogo o de otro integrante -> se actualiza MI versión de esa receta, y si aún no existe
--     se crea (parent_recipe_id = p_id). La original no se toca.
-- Devuelve la receta guardada y si es una versión personal distinta de `p_id` (`is_copy`).
-- `p_slug` es solo un candidato (se usa al insertar): debe tener el formato exigido y ser único; el
-- servidor reintenta con otro sufijo si choca. Las kcal las calcula el servidor de la app con
-- src/lib/nutrition.ts (igual que el seed); aquí solo se validan los rangos.
create or replace function save_recipe(
  p_id uuid, p_slug text, p_country text,
  p_name_es text, p_name_en text, p_description_es text, p_description_en text,
  p_emoji text, p_meal_types text[], p_servings int, p_time_minutes int, p_source_url text,
  p_steps_es text[], p_steps_en text[], p_kcal_per_serving int, p_kcal_complete boolean,
  p_ingredients jsonb
)
returns table (recipe_id uuid, recipe_slug text, is_copy boolean)
language plpgsql security definer set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_family uuid;
  v_src recipes;
  v_target uuid;
  v_copy boolean := false;
  v_name_es text := btrim(p_name_es);
  v_name_en text := btrim(p_name_en);
  v_desc_es text := nullif(btrim(p_description_es), '');
  v_desc_en text := nullif(btrim(p_description_en), '');
  v_emoji text := nullif(btrim(p_emoji), '');
  v_url text := nullif(btrim(p_source_url), '');
  v_meal_types text[];
  v_steps_es text[];
  v_steps_en text[];
  v_n int;
  v_distinct int;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  v_family := my_family_id();
  if v_family is null then raise exception 'no family'; end if;

  -- Validación (el cliente no es de fiar: estos rangos también los exige el formulario).
  if p_country is null or p_country not in ('PE', 'US') then raise exception 'invalid country'; end if;
  if v_name_es is null or char_length(v_name_es) not between 1 and 80
     or v_name_en is null or char_length(v_name_en) not between 1 and 80 then
    raise exception 'invalid name';
  end if;
  if char_length(v_desc_es) > 400 or char_length(v_desc_en) > 400 then raise exception 'invalid description'; end if;
  if char_length(v_emoji) > 16 then raise exception 'invalid emoji'; end if;
  if p_meal_types is null or cardinality(p_meal_types) not between 1 and 4
     or not (p_meal_types <@ array['breakfast', 'lunch', 'dinner', 'snack']) then
    raise exception 'invalid meal types';
  end if;
  v_meal_types := array(select m from unnest(array['breakfast', 'lunch', 'dinner', 'snack']) m where m = any (p_meal_types));
  if p_servings is null or p_servings not between 1 and 100 then raise exception 'invalid servings'; end if;
  if p_time_minutes is not null and p_time_minutes not between 1 and 1440 then raise exception 'invalid time'; end if;
  -- Solo http(s): el link se muestra como <a href>, no puede ser javascript: ni similares.
  if v_url is not null and (char_length(v_url) > 500 or v_url !~* '^https?://[^[:space:]]+$') then
    raise exception 'invalid source url';
  end if;
  if p_steps_es is null or p_steps_en is null or cardinality(p_steps_es) > 40 or cardinality(p_steps_en) > 40 then
    raise exception 'invalid steps';
  end if;
  select coalesce(array_agg(btrim(s) order by o), '{}') into v_steps_es from unnest(p_steps_es) with ordinality as t(s, o);
  select coalesce(array_agg(btrim(s) order by o), '{}') into v_steps_en from unnest(p_steps_en) with ordinality as t(s, o);
  if exists (select 1 from unnest(v_steps_es || v_steps_en) s where s is null or s = '' or char_length(s) > 600) then
    raise exception 'invalid steps';
  end if;
  if p_kcal_per_serving is not null and p_kcal_per_serving not between 0 and 5000 then raise exception 'invalid kcal'; end if;
  if p_kcal_complete is null then raise exception 'invalid kcal'; end if;

  if p_ingredients is null or jsonb_typeof(p_ingredients) <> 'array'
     or jsonb_array_length(p_ingredients) not between 1 and 60 then
    raise exception 'invalid ingredients';
  end if;
  select count(*), count(distinct x.food_id) into v_n, v_distinct
    from jsonb_to_recordset(p_ingredients) as x(food_id uuid, quantity numeric, unit text, optional boolean);
  if v_n <> v_distinct then raise exception 'duplicate ingredient'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_ingredients) as x(food_id uuid, quantity numeric, unit text, optional boolean)
    where x.food_id is null
       or (x.quantity is null) <> (x.unit is null)             -- ambos o ninguno ("al gusto")
       or x.quantity <= 0 or x.quantity > 100000
       or (x.unit is not null and x.unit not in ('unit', 'g', 'kg', 'ml', 'l'))
  ) then
    raise exception 'invalid ingredient';
  end if;
  -- Esta función ignora RLS: los alimentos tienen que ser del catálogo o de mi familia.
  if exists (
    select 1 from jsonb_to_recordset(p_ingredients) as x(food_id uuid, quantity numeric, unit text, optional boolean)
    where not exists (select 1 from foods f where f.id = x.food_id and (f.family_id is null or f.family_id = v_family))
  ) then
    raise exception 'unknown food';
  end if;

  -- ¿Qué receta se actualiza?
  if p_id is null then
    v_target := null;
  else
    select * into v_src from recipes where id = p_id;
    -- Se ve el catálogo y las recetas de mi familia, nada más.
    if not found or not (v_src.family_id is null or v_src.family_id = v_family) then raise exception 'not found'; end if;
    if v_src.family_id = v_family and v_src.created_by = v_me then
      perform 1 from recipes where id = v_src.id for update;
      v_target := v_src.id;
    else
      -- Una sola versión por autor y original, aunque dos guardados lleguen a la vez.
      perform pg_advisory_xact_lock(hashtextextended('recipe-copy:' || v_me::text || ':' || v_src.id::text, 0));
      select r.id into v_target from recipes r where r.created_by = v_me and r.parent_recipe_id = v_src.id;
      v_copy := true;
    end if;
  end if;

  if v_target is null then
    if (select count(*) from recipes where created_by = v_me) >= 300 then raise exception 'too many recipes'; end if;
    if p_slug is null or p_slug !~ '^[a-z0-9-]{0,60}_[0-9a-f]{8}$' then raise exception 'invalid slug'; end if;
    -- Las versiones personales no heredan la foto de la original (la atribución de la foto es del catálogo).
    insert into recipes (
      slug, country, name_es, name_en, description_es, description_en, emoji, meal_types, servings, time_minutes,
      source_url, steps_es, steps_en, kcal_per_serving, kcal_complete, family_id, created_by, parent_recipe_id
    ) values (
      p_slug, p_country, v_name_es, v_name_en, v_desc_es, v_desc_en, v_emoji, v_meal_types, p_servings, p_time_minutes,
      v_url, v_steps_es, v_steps_en, p_kcal_per_serving, p_kcal_complete, v_family, v_me, p_id
    ) returning id into v_target;
  else
    update recipes set
      country = p_country, name_es = v_name_es, name_en = v_name_en, description_es = v_desc_es,
      description_en = v_desc_en, emoji = v_emoji, meal_types = v_meal_types, servings = p_servings,
      time_minutes = p_time_minutes, source_url = v_url, steps_es = v_steps_es, steps_en = v_steps_en,
      kcal_per_serving = p_kcal_per_serving, kcal_complete = p_kcal_complete, updated_at = now()
    where id = v_target;
    delete from recipe_ingredients where recipe_ingredients.recipe_id = v_target;
  end if;

  insert into recipe_ingredients (recipe_id, food_id, quantity, unit, optional, position)
  select v_target, x.food_id, x.quantity, x.unit, coalesce(x.optional, false), (x.o - 1)::int
    from rows from (jsonb_to_recordset(p_ingredients) as (food_id uuid, quantity numeric, unit text, optional boolean))
         with ordinality as x(food_id, quantity, unit, optional, o);

  return query select r.id, r.slug, v_copy from recipes r where r.id = v_target;
end $$;

-- Elimina una receta propia (el autor, o un padre de su familia). Las comidas del calendario que la
-- usan se quedan con su nombre (ver el trigger de arriba); las favoritas se quitan en cascada y las
-- versiones personales que otros hicieron de ella quedan sin original.
create or replace function delete_recipe(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v recipes;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v from recipes where id = p_id;
  -- (is not distinct from: un usuario sin familia no ve las recetas de ninguna.)
  if not found or not (v.family_id is null or v.family_id is not distinct from my_family_id()) then raise exception 'not found'; end if;
  -- Las del catálogo no se eliminan.
  if v.family_id is null then raise exception 'forbidden'; end if;
  if v.created_by is distinct from auth.uid() and not is_parent() then raise exception 'forbidden'; end if;
  delete from recipes where id = p_id;
end $$;

revoke execute on function
  save_recipe(uuid, text, text, text, text, text, text, text, text[], int, int, text, text[], text[], int, boolean, jsonb),
  delete_recipe(uuid)
from public, anon;
grant execute on function
  save_recipe(uuid, text, text, text, text, text, text, text, text[], int, int, text, text[], text[], int, boolean, jsonb),
  delete_recipe(uuid)
to authenticated, service_role;
