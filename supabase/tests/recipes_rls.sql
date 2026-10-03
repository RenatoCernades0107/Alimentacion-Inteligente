-- Pruebas de permisos (RLS + RPC) de recetas propias, versiones personales y favoritas.
--
-- Uso (sobre una base DESECHABLE con las migraciones y el seed aplicados; todo corre en una
-- transacción que termina en ROLLBACK, pero aun así no lo apuntes a datos reales):
--   docker exec -i <contenedor db> psql -v ON_ERROR_STOP=1 -q -U supabase_admin -d postgres < supabase/tests/recipes_rls.sql
-- Si algo falla, psql se detiene con "FALLO: ..." y el resto no se ejecuta.
-- Usa alimentos y recetas del seed ('salt', 'garlic', 'ceviche'); el resto de las aserciones cuenta lo
-- que ve cada usuario de prueba, así que no dependen de otros datos de la base.

\set ON_ERROR_STOP on
\o /dev/null
begin;

-- Ayudantes (se ejecutan con el rol de quien los llama, así se aplican las políticas).
create function public.t_expect_err(stmt text, expected text) returns void language plpgsql as $$
declare ok boolean := false;
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm like '%' || expected || '%' then ok := true;
    else raise exception 'FALLO: error inesperado "%" (se esperaba "%") en: %', sqlerrm, expected, stmt;
    end if;
  end;
  if not ok then raise exception 'FALLO: se esperaba el error "%" en: %', expected, stmt; end if;
end $$;

create function public.t_expect_count(stmt text, n int, label text) returns void language plpgsql as $$
declare c int;
begin
  execute 'select count(*) from (' || stmt || ') s' into c;
  if c <> n then raise exception 'FALLO: % -> se esperaban % filas y hay %', label, n, c; end if;
end $$;

-- Un ingrediente en el formato de save_recipe.
create function public.t_ing(f uuid, q numeric default 100, u text default 'g', opt boolean default false) returns jsonb
language sql as $$ select jsonb_build_object('food_id', f, 'quantity', q, 'unit', u, 'optional', opt) $$;

-- Guarda una receta con valores válidos por defecto (el slug es aleatorio salvo que se pase uno).
create function public.t_save(
  p_id uuid, p_name text, p_ing jsonb, p_slug text default null, p_url text default null,
  p_country text default 'PE', p_meals text[] default array['lunch'], p_servings int default 2
) returns table (recipe_id uuid, recipe_slug text, is_copy boolean) language sql as $$
  select * from save_recipe(
    p_id, coalesce(p_slug, 'test_' || substr(md5(random()::text), 1, 8)), p_country, p_name, p_name, null, null,
    '🍲', p_meals, p_servings, 30, p_url, array['Paso 1'], array['Step 1'], 300, true, p_ing)
$$;

-- Igual, pero espera que falle con ese mensaje.
create function public.t_save_err(
  expected text, p_id uuid, p_name text, p_ing jsonb, p_slug text default null, p_url text default null,
  p_country text default 'PE', p_meals text[] default array['lunch'], p_servings int default 2
) returns void language plpgsql as $$
begin
  begin
    perform * from t_save(p_id, p_name, p_ing, p_slug, p_url, p_country, p_meals, p_servings);
  exception when others then
    if sqlerrm like '%' || expected || '%' then return; end if;
    raise exception 'FALLO: error inesperado "%" (se esperaba "%") al guardar "%"', sqlerrm, expected, p_name;
  end;
  raise exception 'FALLO: se esperaba el error "%" al guardar "%"', expected, p_name;
end $$;
grant execute on function
  public.t_expect_err(text, text), public.t_expect_count(text, int, text), public.t_ing(uuid, numeric, text, boolean),
  public.t_save(uuid, text, jsonb, text, text, text, text[], int), public.t_save_err(text, uuid, text, jsonb, text, text, text, text[], int)
to public;

-- Familia 1: A (padre) y B (hijo). Familia 2: C (padre). D: usuario sin familia.
\set A '''c1000000-0000-0000-0000-00000000000a'''
\set B '''c1000000-0000-0000-0000-00000000000b'''
\set C '''c1000000-0000-0000-0000-00000000000c'''
\set D '''c1000000-0000-0000-0000-00000000000d'''
\set F1 '''f1000000-0000-0000-0000-000000000001'''
\set F2 '''f1000000-0000-0000-0000-000000000002'''

insert into auth.users (id, email) values (:A, 'a@test'), (:B, 'b@test'), (:C, 'c@test'), (:D, 'd@test');
insert into families (id, name) values (:F1, 'Familia 1'), (:F2, 'Familia 2');
update profiles set family_id = :F1, role = 'parent' where id = :A;
update profiles set family_id = :F1, role = 'child' where id = :B;
update profiles set family_id = :F2, role = 'parent' where id = :C;

select id as f_salt from foods where key = 'salt' \gset
select id as f_garlic from foods where key = 'garlic' \gset
select id as ceviche from recipes where slug = 'ceviche' \gset
select count(*) as n_builtin from recipes where family_id is null \gset
select count(*) as n_ceviche_ing from recipe_ingredients where recipe_id = :'ceviche' \gset
select md5(r::text) as h_ceviche from recipes r where slug = 'ceviche' \gset

-- Restricciones de la tabla (como superusuario: las reglas valen también para quien se salte la RPC).
select t_expect_err('insert into recipes (slug, country, name_es, name_en, family_id) values (''sin-sufijo'', ''PE'', ''x'', ''x'', ' || quote_literal(:F1) || ')', 'recipes_custom_slug');
select t_expect_err('insert into recipes (slug, country, name_es, name_en, created_by) values (''catalogo-con-dueno'', ''PE'', ''x'', ''x'', ' || quote_literal(:A) || ')', 'recipes_catalog_shape');
select t_expect_err('insert into recipes (slug, country, name_es, name_en, parent_recipe_id) values (''catalogo-con-padre'', ''PE'', ''x'', ''x'', ' || quote_literal(:'ceviche') || ')', 'recipes_catalog_shape');

\echo '== Padre A: crea recetas propias'
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
insert into foods (family_id, name_es, name_en, category, default_unit, kcal_100g)
values (:F1, 'Salsa de A', 'A sauce', 'custom', 'g', 120) returning id as f_a \gset
select t_expect_count('select 1 from recipes where family_id is null', :n_builtin, 'A ve todo el catálogo');

select recipe_id as r1, recipe_slug as s1, is_copy as c1
  from t_save(null, 'Tortilla de A', jsonb_build_array(t_ing(:'f_salt', 5), t_ing(:'f_a', 50), t_ing(:'f_garlic', 2, 'unit', true))) \gset
select t_expect_count('select 1 from recipes where id = ' || quote_literal(:'r1') || ' and not ' || quote_literal(:'c1') || ' and created_by = ' || quote_literal(:A) || ' and family_id = ' || quote_literal(:F1) || ' and parent_recipe_id is null and image_url is null', 1, 'R1: receta nueva, de A y de su familia');
select t_expect_count('select 1 from recipe_ingredients where recipe_id = ' || quote_literal(:'r1'), 3, 'R1 tiene sus 3 ingredientes');
select t_expect_count('select 1 from recipe_ingredients where recipe_id = ' || quote_literal(:'r1') || ' and ((position = 0 and food_id = ' || quote_literal(:'f_salt') || ') or (position = 1 and food_id = ' || quote_literal(:'f_a') || ') or (position = 2 and optional))', 3, 'los ingredientes guardan su orden');

-- Editar la propia receta la actualiza en su lugar (mismo id y mismo slug).
select recipe_id as r1b, recipe_slug as s1b, is_copy as c1b
  from t_save(:'r1', 'Tortilla de A (v2)', jsonb_build_array(t_ing(:'f_salt', 6), t_ing(:'f_a', 40)), 'test_deadbeef') \gset
select t_expect_count('select 1 where ' || quote_literal(:'r1b') || ' = ' || quote_literal(:'r1') || ' and ' || quote_literal(:'s1b') || ' = ' || quote_literal(:'s1') || ' and not ' || quote_literal(:'c1b'), 1, 'editar la propia receta no crea otra y no cambia el slug');
select t_expect_count('select 1 from recipes where created_by = ' || quote_literal(:A), 1, 'A sigue teniendo una sola receta');
select t_expect_count('select 1 from recipes where id = ' || quote_literal(:'r1') || ' and name_es = ''Tortilla de A (v2)''', 1, 'la edición se aplicó');
select t_expect_count('select 1 from recipe_ingredients where recipe_id = ' || quote_literal(:'r1'), 2, 'los ingredientes se reemplazaron');

-- Validaciones
select t_save_err('invalid slug', null, 'X', jsonb_build_array(t_ing(:'f_salt')), 'sin-sufijo');
select t_save_err('invalid slug', null, 'X', jsonb_build_array(t_ing(:'f_salt')), 'ceviche');
select t_save_err('invalid slug', null, 'X', jsonb_build_array(t_ing(:'f_salt')), 'Mayus_0123abcd');
select t_save_err('invalid country', null, 'X', jsonb_build_array(t_ing(:'f_salt')), p_country => 'ES');
select t_save_err('invalid name', null, '   ', jsonb_build_array(t_ing(:'f_salt')));
select t_save_err('invalid name', null, repeat('x', 81), jsonb_build_array(t_ing(:'f_salt')));
select t_save_err('invalid source url', null, 'X', jsonb_build_array(t_ing(:'f_salt')), p_url => 'javascript:alert(1)');
select t_save_err('invalid source url', null, 'X', jsonb_build_array(t_ing(:'f_salt')), p_url => 'https://a b.com');
select t_save_err('invalid meal types', null, 'X', jsonb_build_array(t_ing(:'f_salt')), p_meals => array[]::text[]);
select t_save_err('invalid meal types', null, 'X', jsonb_build_array(t_ing(:'f_salt')), p_meals => array['brunch']);
select t_save_err('invalid servings', null, 'X', jsonb_build_array(t_ing(:'f_salt')), p_servings => 0);
select t_save_err('invalid ingredients', null, 'X', '[]'::jsonb);
select t_save_err('invalid ingredients', null, 'X', '{"a":1}'::jsonb);
select t_save_err('duplicate ingredient', null, 'X', jsonb_build_array(t_ing(:'f_salt'), t_ing(:'f_salt', 3)));
select t_save_err('invalid ingredient', null, 'X', jsonb_build_array(t_ing(:'f_salt', 0)));
select t_save_err('invalid ingredient', null, 'X', jsonb_build_array(t_ing(:'f_salt', 5, 'cup')));
select t_save_err('invalid ingredient', null, 'X', jsonb_build_array(jsonb_build_object('food_id', :'f_salt', 'quantity', 5)));
select t_save_err('unknown food', null, 'X', jsonb_build_array(t_ing('c1000000-0000-0000-0000-0000000000ff')));
select t_expect_err('select save_recipe(null, ''test_0123abcd'', ''PE'', ''X'', ''X'', null, null, null, array[''lunch''], 2, 30, null, array[repeat(''x'', 601)], array[''a''], 300, true, ''[{"food_id":"' || :'f_salt' || '","quantity":5,"unit":"g"}]''::jsonb)', 'invalid steps');
select t_expect_err('select save_recipe(null, ''test_0123abcd'', ''PE'', ''X'', ''X'', null, null, null, array[''lunch''], 2, 30, null, array[''a''], array[''a''], 6000, true, ''[{"food_id":"' || :'f_salt' || '","quantity":5,"unit":"g"}]''::jsonb)', 'invalid kcal');
-- Un slug repetido choca con la restricción de unicidad (la app reintenta con otro sufijo).
select t_expect_err('select * from t_save(null, ''X'', jsonb_build_array(t_ing(' || quote_literal(:'f_salt') || ')), ' || quote_literal(:'s1') || ')', 'recipes_slug_key');
select t_expect_count('select 1 from recipes where created_by = ' || quote_literal(:A), 1, 'las validaciones no dejaron recetas a medias');

-- Sin escritura directa a las tablas
select t_expect_err('insert into recipes (slug, country, name_es, name_en) values (''x_0123abcd'', ''PE'', ''x'', ''x'')', 'permission denied');
select t_expect_err('update recipes set name_es = ''hack'' where family_id is null', 'permission denied');
select t_expect_err('delete from recipes', 'permission denied');
select t_expect_err('insert into recipe_ingredients (recipe_id, food_id) values (' || quote_literal(:'r1') || ', ' || quote_literal(:'f_garlic') || ')', 'permission denied');
select t_expect_err('update recipe_ingredients set quantity = 1', 'permission denied');
select t_expect_err('delete from recipe_ingredients', 'permission denied');
reset role;

\echo '== Padre A: editar una receta del catálogo crea su versión (la original no cambia)'
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
select recipe_id as cv1, recipe_slug as cvs1, is_copy as cvc1
  from t_save(:'ceviche', 'Ceviche de A', jsonb_build_array(t_ing(:'f_salt', 3))) \gset
select t_expect_count('select 1 from recipes where id = ' || quote_literal(:'cv1') || ' and ' || quote_literal(:'cvc1') || ' and parent_recipe_id = ' || quote_literal(:'ceviche') || ' and created_by = ' || quote_literal(:A) || ' and family_id = ' || quote_literal(:F1) || ' and image_url is null', 1, 'se creó la versión de A, ligada a la original');
-- Editar otra vez la misma original actualiza la misma versión (sin duplicados).
select recipe_id as cv2, is_copy as cvc2
  from t_save(:'ceviche', 'Ceviche de A (v2)', jsonb_build_array(t_ing(:'f_salt', 4), t_ing(:'f_garlic', 1, 'unit'))) \gset
select t_expect_count('select 1 where ' || quote_literal(:'cv2') || ' = ' || quote_literal(:'cv1') || ' and ' || quote_literal(:'cvc2'), 1, 'segunda edición: misma versión');
select t_expect_count('select 1 from recipes where parent_recipe_id = ' || quote_literal(:'ceviche'), 1, 'una sola versión por autor y original');
select t_expect_count('select 1 from recipe_ingredients where recipe_id = ' || quote_literal(:'cv1'), 2, 'la versión tiene los ingredientes nuevos');
-- Editar la versión directamente la actualiza en su lugar.
select recipe_id as cv3, is_copy as cvc3 from t_save(:'cv1', 'Ceviche de A (v3)', jsonb_build_array(t_ing(:'f_salt', 4))) \gset
select t_expect_count('select 1 where ' || quote_literal(:'cv3') || ' = ' || quote_literal(:'cv1') || ' and not ' || quote_literal(:'cvc3'), 1, 'editar la versión directamente: en su lugar');
select t_expect_count('select 1 from recipes where parent_recipe_id = ' || quote_literal(:'ceviche'), 1, 'sigue habiendo una sola versión');
select t_expect_count('select 1 from recipes where family_id is null', :n_builtin, 'el catálogo conserva sus recetas');
select t_expect_count('select 1 from recipes r where slug = ''ceviche'' and md5(r::text) = ' || quote_literal(:'h_ceviche'), 1, 'la receta original no cambió');
select t_expect_count('select 1 from recipe_ingredients where recipe_id = ' || quote_literal(:'ceviche'), :n_ceviche_ing, 'los ingredientes originales no cambiaron');
-- El catálogo no se elimina.
select t_expect_err('select delete_recipe(' || quote_literal(:'ceviche') || ')', 'forbidden');
reset role;

\echo '== Hijo B: ve las de su familia; editar la de A crea su versión'
select set_config('request.jwt.claim.sub', :B, true) \gset
set local role authenticated;
select t_expect_count('select 1 from recipes where family_id is null', :n_builtin, 'B ve el catálogo');
select t_expect_count('select 1 from recipes where family_id = ' || quote_literal(:F1), 2, 'B ve las 2 recetas propias de su familia (R1 y la versión de A)');
select t_expect_count('select 1 from recipe_ingredients where recipe_id = ' || quote_literal(:'r1'), 2, 'B ve los ingredientes de R1');
select recipe_id as bv1, is_copy as bvc1 from t_save(:'r1', 'Tortilla de B', jsonb_build_array(t_ing(:'f_salt', 1))) \gset
select t_expect_count('select 1 from recipes where id = ' || quote_literal(:'bv1') || ' and ' || quote_literal(:'bvc1') || ' and parent_recipe_id = ' || quote_literal(:'r1') || ' and created_by = ' || quote_literal(:B), 1, 'B obtuvo su versión de R1');
select t_expect_count('select 1 from recipes where id = ' || quote_literal(:'r1') || ' and name_es = ''Tortilla de A (v2)'' and created_by = ' || quote_literal(:A), 1, 'R1 sigue igual');
select t_expect_count('select 1 from recipe_ingredients where recipe_id = ' || quote_literal(:'r1'), 2, 'los ingredientes de R1 siguen igual');
select recipe_id as bv2 from t_save(:'r1', 'Tortilla de B (v2)', jsonb_build_array(t_ing(:'f_salt', 2))) \gset
select t_expect_count('select 1 where ' || quote_literal(:'bv2') || ' = ' || quote_literal(:'bv1'), 1, 'B edita otra vez: misma versión');
select t_expect_count('select 1 from recipes where parent_recipe_id = ' || quote_literal(:'r1'), 1, 'una sola versión de B');
-- B puede editar su propia versión directamente, pero no eliminar lo de A.
select t_expect_err('select delete_recipe(' || quote_literal(:'r1') || ')', 'forbidden');
select t_expect_err('select delete_recipe(' || quote_literal(:'cv1') || ')', 'forbidden');
select t_expect_err('select delete_recipe(' || quote_literal(:'ceviche') || ')', 'forbidden');
-- Favoritas: solo las propias.
insert into recipe_favorites (user_id, recipe_id) values (:B, :'r1'), (:B, :'bv1'), (:B, :'ceviche');
select t_expect_err('insert into recipe_favorites (user_id, recipe_id) values (' || quote_literal(:A) || ', ' || quote_literal(:'cv1') || ')', 'row-level security');
select t_expect_err('insert into recipe_favorites (user_id, recipe_id) values (' || quote_literal(:B) || ', ' || quote_literal(:'r1') || ')', 'duplicate key');
insert into recipe_favorites (user_id, recipe_id) values (:B, :'r1') on conflict do nothing;
select t_expect_count('select 1 from recipe_favorites', 3, 'B ve sus 3 favoritas');
select t_expect_err('update recipe_favorites set user_id = ' || quote_literal(:A), 'permission denied');
reset role;

\echo '== Padre A: sus favoritas y la moderación de recetas de la familia'
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
select t_expect_count('select 1 from recipes where created_by = ' || quote_literal(:B), 1, 'A ve la versión de B (misma familia)');
insert into recipe_favorites (user_id, recipe_id) values (:A, :'r1'), (:A, :'cv1');
select t_expect_count('select 1 from recipe_favorites', 2, 'A ve solo sus 2 favoritas (no las de B)');
delete from recipe_favorites where recipe_id = :'r1';
select t_expect_count('select 1 from recipe_favorites', 1, 'A quitó una favorita');
-- Quitar la favorita de otro no hace nada (RLS filtra la fila).
select t_expect_count('select 1 from recipe_favorites where user_id = ' || quote_literal(:B), 0, 'A no ve las favoritas de B');
delete from recipe_favorites where user_id = :B;
reset role;
select t_expect_count('select 1 from recipe_favorites where user_id = ' || quote_literal(:B), 3, 'las favoritas de B siguen intactas');

-- Un padre puede eliminar la versión de un hijo; su favorita se va en cascada.
set local role authenticated;
select delete_recipe(:'bv1');
select t_expect_count('select 1 from recipes where created_by = ' || quote_literal(:B), 0, 'A eliminó la versión de B');
reset role;
select t_expect_count('select 1 from recipe_favorites where recipe_id = ' || quote_literal(:'bv1'), 0, 'la favorita de esa versión se eliminó en cascada');

\echo '== Otra familia (C), usuario sin familia (D) y sin sesión'
select set_config('request.jwt.claim.sub', :C, true) \gset
set local role authenticated;
select t_expect_count('select 1 from recipes where family_id is null', :n_builtin, 'C ve el catálogo');
select t_expect_count('select 1 from recipes where family_id is not null', 0, 'C no ve recetas de otra familia');
select t_expect_count('select 1 from recipe_ingredients where recipe_id in (' || quote_literal(:'r1') || ', ' || quote_literal(:'cv1') || ')', 0, 'C no ve sus ingredientes');
select t_expect_err('select * from t_save(' || quote_literal(:'r1') || ', ''Robo'', jsonb_build_array(t_ing(' || quote_literal(:'f_salt') || ')))', 'not found');
select t_expect_err('select delete_recipe(' || quote_literal(:'r1') || ')', 'not found');
select t_expect_err('insert into recipe_favorites (user_id, recipe_id) values (' || quote_literal(:C) || ', ' || quote_literal(:'r1') || ')', 'row-level security');
-- No puede usar un alimento propio de otra familia como ingrediente.
select t_save_err('unknown food', null, 'X', jsonb_build_array(t_ing(:'f_a')));
select recipe_id as rc1 from t_save(null, 'Receta de C', jsonb_build_array(t_ing(:'f_salt', 5))) \gset
select t_expect_count('select 1 from recipes where family_id = ' || quote_literal(:F2), 1, 'C solo ve la suya');
reset role;
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
select t_expect_count('select 1 from recipes where id = ' || quote_literal(:'rc1'), 0, 'A no ve la receta de C');
reset role;

select set_config('request.jwt.claim.sub', :D, true) \gset
set local role authenticated;
select t_expect_count('select 1 from recipes where family_id is null', :n_builtin, 'D (sin familia) ve el catálogo');
select t_expect_count('select 1 from recipes where family_id is not null', 0, 'D no ve recetas propias');
select t_save_err('no family', null, 'X', jsonb_build_array(t_ing(:'f_salt')));
select t_expect_err('select delete_recipe(' || quote_literal(:'r1') || ')', 'not found');
reset role;

set local role anon;
select t_expect_count('select 1 from recipes', 0, 'sin sesión no se ve ninguna receta');
select t_expect_count('select 1 from recipe_ingredients', 0, 'ni sus ingredientes');
select t_expect_err('select 1 from recipe_favorites', 'permission denied');
select t_expect_err('select * from t_save(null, ''X'', jsonb_build_array(t_ing(' || quote_literal(:'f_salt') || ')))', 'permission denied');
select t_expect_err('select delete_recipe(' || quote_literal(:'r1') || ')', 'permission denied');
reset role;

\echo '== service_role (cliente admin del servidor) ve todo'
set local role service_role;
select t_expect_count('select 1 from recipes where family_id in (' || quote_literal(:F1) || ', ' || quote_literal(:F2) || ')', 3, 'service_role ve las 3 recetas propias de la prueba (R1, versión de A y la de C)');
reset role;

\echo '== Eliminar una receta programada en el calendario'
select set_config('request.jwt.claim.sub', :B, true) \gset
set local role authenticated;
-- B vuelve a hacer su versión de R1, que además se va a quedar sin original.
select recipe_id as bv3 from t_save(:'r1', 'Tortilla de B (v3)', jsonb_build_array(t_ing(:'f_salt', 2))) \gset
reset role;
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
-- Una comida y una recurrencia con R1, sin título (el calendario muestra el nombre de la receta).
insert into meals (family_id, date, slot, recipe_id, status) values (:F1, current_date, 'lunch', :'r1', 'planned');
insert into meals (family_id, date, slot, recipe_id, status) values (:F1, current_date + 1, 'dinner', :'r1', 'completed');
insert into meal_series (family_id, recipe_id, slot, recurrence, start_date, materialized_until)
values (:F1, :'r1', 'lunch', 'weekly', current_date, current_date);
-- Una comida que ya tiene título propio no lo pierde.
insert into meals (family_id, date, slot, recipe_id, title, status) values (:F1, current_date + 2, 'lunch', :'cv1', 'Mi nombre', 'planned');
select delete_recipe(:'r1');
select t_expect_count('select 1 from recipes where id = ' || quote_literal(:'r1'), 0, 'R1 eliminada');
select t_expect_count('select 1 from meals where recipe_id is null and title = ''Tortilla de A (v2)'' and kcal_per_serving = 300', 2, 'las comidas conservan el nombre y las kcal de la receta');
select t_expect_count('select 1 from meal_series where recipe_id is null and title = ''Tortilla de A (v2)'' and kcal_per_serving = 300', 1, 'la recurrencia también');
select t_expect_count('select 1 from meals where recipe_id = ' || quote_literal(:'cv1') || ' and title = ''Mi nombre''', 1, 'otras comidas no se tocan');
select t_expect_count('select 1 from recipe_ingredients where recipe_id = ' || quote_literal(:'r1'), 0, 'sus ingredientes se eliminaron');
select t_expect_count('select 1 from recipe_favorites where recipe_id = ' || quote_literal(:'r1'), 0, 'y sus favoritas');
reset role;
select t_expect_count('select 1 from recipes where id = ' || quote_literal(:'bv3') || ' and parent_recipe_id is null and created_by = ' || quote_literal(:B), 1, 'la versión de B sigue existiendo, sin original');
select t_expect_count('select 1 from recipe_favorites where recipe_id = ' || quote_literal(:'cv1'), 1, 'las favoritas de otras recetas no se tocan');

-- Volver a cargar el seed no toca las recetas propias: igual que supabase/seed.sql, hace upsert por
-- slug del catálogo y nunca borra recetas.
insert into recipes (slug, country, name_es, name_en, meal_types, servings)
values ('ceviche', 'PE', 'Ceviche (re-seed)', 'Ceviche', array['lunch'], 4)
on conflict (slug) do update set name_es = excluded.name_es, name_en = excluded.name_en,
  meal_types = excluded.meal_types, servings = excluded.servings;
delete from recipe_ingredients where recipe_id = (select id from recipes where slug = 'ceviche');
select t_expect_count('select 1 from recipes where family_id = ' || quote_literal(:F2) || ' or id in (' || quote_literal(:'bv3') || ', ' || quote_literal(:'cv1') || ')', 3, 'las recetas propias siguen ahí tras volver a cargar el seed');
select t_expect_count('select 1 from recipes where id = ' || quote_literal(:'cv1') || ' and parent_recipe_id = ' || quote_literal(:'ceviche'), 1, 'la versión de A sigue ligada a su original');
select t_expect_count('select 1 from recipes where slug = ''ceviche'' and family_id is null and name_es = ''Ceviche (re-seed)''', 1, 'el catálogo sí se actualiza');

-- La comida de A con título propio lo conserva cuando se elimina su receta.
set local role authenticated;
select delete_recipe(:'cv1');
select t_expect_count('select 1 from meals where recipe_id is null and title = ''Mi nombre''', 1, 'la comida con título propio lo conserva');
reset role;

\echo '== Quitar a un integrante, borrar la cuenta de un autor y borrar una familia'
-- B sale de la familia: ya no ve las recetas propias de F1 ni puede cambiar o eliminar la suya.
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
select remove_member(:B);
reset role;
select set_config('request.jwt.claim.sub', :B, true) \gset
set local role authenticated;
select t_expect_count('select 1 from recipes where family_id is not null', 0, 'B, fuera de la familia, no ve recetas propias');
select t_expect_err('select delete_recipe(' || quote_literal(:'bv3') || ')', 'not found');
select t_expect_err('select * from t_save(' || quote_literal(:'bv3') || ', ''X'', jsonb_build_array(t_ing(' || quote_literal(:'f_salt') || ')))', 'no family');
reset role;
-- La receta de B sigue en la familia: A la ve y, como padre, puede limpiarla.
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
select t_expect_count('select 1 from recipes where id = ' || quote_literal(:'bv3'), 1, 'A sigue viendo la receta de B');
select delete_recipe(:'bv3');
select t_expect_count('select 1 from recipes where id = ' || quote_literal(:'bv3'), 0, 'A eliminó la receta de quien ya no está en la familia');
reset role;

-- Una familia con recetas propias programadas se puede borrar (cascada) sin que falle el CHECK de meals.
select set_config('request.jwt.claim.sub', :C, true) \gset
set local role authenticated;
insert into meals (family_id, date, slot, recipe_id, status) values (:F2, current_date, 'lunch', :'rc1', 'planned');
insert into meal_series (family_id, recipe_id, slot, recurrence, start_date, materialized_until)
values (:F2, :'rc1', 'dinner', 'daily', current_date, current_date);
reset role;
delete from families where id = :F2;
select t_expect_count('select 1 from recipes where family_id = ' || quote_literal(:F2), 0, 'las recetas de la familia borrada se eliminaron');
select t_expect_count('select 1 from meals where family_id = ' || quote_literal(:F2), 0, 'y sus comidas');

-- Si se borra la cuenta del autor, sus recetas quedan en la familia, sin autor.
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
select recipe_id as ra1 from t_save(null, 'Receta de A', jsonb_build_array(t_ing(:'f_salt'))) \gset
reset role;
delete from auth.users where id = :A;
select t_expect_count('select 1 from recipes where id = ' || quote_literal(:'ra1') || ' and created_by is null and family_id = ' || quote_literal(:F1), 1, 'la receta sigue en la familia, sin autor');

rollback;
\o
\echo 'TODAS LAS PRUEBAS PASARON'
