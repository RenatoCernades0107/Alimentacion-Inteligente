-- Pruebas de permisos (RLS + RPC) de peso, metas y integrantes sin cuenta.
--
-- Uso (sobre una base DESECHABLE con las migraciones y el seed aplicados; todo corre en una
-- transacción que termina en ROLLBACK, pero aun así no lo apuntes a datos reales):
--   psql -v ON_ERROR_STOP=1 -q -U supabase_admin -d postgres -f supabase/tests/body_rls.sql
-- Si algo falla, psql se detiene con "FALLO: ..." y el resto no se ejecuta.
-- Las aserciones cuentan lo que ve cada usuario de prueba, así que no dependen de otros datos de la base.

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
grant execute on function public.t_expect_err(text, text), public.t_expect_count(text, int, text) to public;

-- Familia 1: A y B (padres), C (hijo menor con cuenta), E (hijo con cuenta que ya es adulto).
-- Familia 2: F (padre).
\set A '''a0000000-0000-0000-0000-00000000000a'''
\set B '''a0000000-0000-0000-0000-00000000000b'''
\set C '''a0000000-0000-0000-0000-00000000000c'''
\set E '''a0000000-0000-0000-0000-00000000000e'''
\set F '''a0000000-0000-0000-0000-00000000000f'''

insert into auth.users (id, email) values
  (:A, 'a@test'), (:B, 'b@test'), (:C, 'c@test'), (:E, 'e@test'), (:F, 'f@test');
insert into families (id, name) values
  ('f0000000-0000-0000-0000-000000000001', 'Familia 1'), ('f0000000-0000-0000-0000-000000000002', 'Familia 2');
update profiles set family_id = 'f0000000-0000-0000-0000-000000000001', role = 'parent' where id in (:A, :B);
update profiles set family_id = 'f0000000-0000-0000-0000-000000000001', role = 'child' where id in (:C, :E);
update profiles set family_id = 'f0000000-0000-0000-0000-000000000002', role = 'parent' where id = :F;

\echo '== Padre A: crea dependiente y datos'
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
select add_dependent('Bebe', null, (current_date - interval '2 years')::date, 'female') as dep \gset
select save_body(:A, null, 'male', date '1985-05-05', 178, 'moderate') as body_a \gset
select add_weight(:'body_a', current_date, 85.5, null) as log_a \gset
select set_goal(:'body_a', 78, 'recommended');
select save_body(:C, null, 'female', (current_date - interval '10 years')::date, 140, 'active') as body_c \gset
select add_weight(:'body_c', current_date, 34, 140) as log_c \gset
-- Un hijo con cuenta sin fecha de nacimiento aún lo administran los padres; al poner una fecha de adulto se autogestiona.
select save_body(:E, null, 'female', date '2000-01-01', 165, 'light') as body_e \gset
select save_body(null, :'dep', 'female', (current_date - interval '2 years')::date, 86, 'light') as body_dep \gset
select add_weight(:'body_dep', current_date, 12.4, 86);

-- Ve: su fila, la del hijo menor y la del dependiente. No ve la del hijo adulto.
select t_expect_count('select 1 from body_profiles', 3, 'A ve 3 personas');
select t_expect_count('select 1 from weight_logs', 3, 'A ve los pesajes de esas 3');
select t_expect_count('select 1 from body_profiles where profile_id = ' || quote_literal(:E), 0, 'A no ve al hijo adulto');
-- Validaciones
select t_expect_err('select set_goal(' || quote_literal(:'body_c') || ', 50, ''gentle'')', 'goals are for adults');
select t_expect_err('select set_goal(' || quote_literal(:'body_dep') || ', 50, ''gentle'')', 'goals are for adults');
select t_expect_err('select add_weight(' || quote_literal(:'body_a') || ', current_date, 500)', 'invalid weight');
select t_expect_err('select add_weight(' || quote_literal(:'body_a') || ', current_date + 30, 80)', 'invalid date');
select t_expect_err('select save_body(' || quote_literal(:A) || ', null, ''male'', current_date + 1, 178, ''light'')', 'invalid birth date');
select t_expect_err('select save_body(' || quote_literal(:A) || ', null, ''male'', date ''1985-05-05'', 300, ''light'')', 'invalid height');
select t_expect_err('select save_body(null, null, ''male'', null, null, ''light'')', 'invalid target');
-- Un pesaje el mismo día corrige el anterior (no duplica) y la estatura vigente se actualiza.
select add_weight(:'body_a', current_date, 84.9, 178.5);
select t_expect_count('select 1 from weight_logs where body_id = ' || quote_literal(:'body_a'), 1, 'un pesaje por día');
select t_expect_count('select 1 from body_profiles where id = ' || quote_literal(:'body_a') || ' and height_cm = 178.5', 1, 'estatura vigente');
-- Sin escritura directa a las tablas
select t_expect_err('insert into body_profiles (profile_id) values (' || quote_literal(:B) || ')', 'permission denied');
select t_expect_err('update body_profiles set height_cm = 100', 'permission denied');
select t_expect_err('delete from weight_logs', 'permission denied');
select t_expect_err('insert into dependents (family_id, name) values (''f0000000-0000-0000-0000-000000000001'', ''x'')', 'permission denied');
reset role;

\echo '== Padre B (otro padre de la misma familia)'
select set_config('request.jwt.claim.sub', :B, true) \gset
set local role authenticated;
select t_expect_count('select 1 from body_profiles', 2, 'B ve al hijo menor y al dependiente, no al otro padre');
select t_expect_count('select 1 from weight_logs', 2, 'B ve solo esos pesajes');
select t_expect_err('select save_body(' || quote_literal(:A) || ', null, ''male'', date ''1985-05-05'', 170, ''light'')', 'forbidden');
select t_expect_err('select add_weight(' || quote_literal(:'body_a') || ', current_date, 80)', 'forbidden');
select t_expect_err('select set_goal(' || quote_literal(:'body_a') || ', 70, ''fast'')', 'forbidden');
select t_expect_err('select delete_weight(' || quote_literal(:'log_a') || ')', 'forbidden');
select t_expect_count('select 1 from dependents', 1, 'B ve al dependiente');
-- B puede administrar al hijo menor y al dependiente.
select add_weight(:'body_c', current_date - 7, 33.5);
select add_weight(:'body_dep', current_date - 7, 12.1);
-- Y crear lo suyo. Una meta exige tener un peso registrado.
select save_body(:B, null, 'female', date '1988-03-03', 165, 'light') as body_b \gset
select t_expect_err('select set_goal(' || quote_literal(:'body_b') || ', 60, ''recommended'')', 'weight required');
select add_weight(:'body_b', current_date, 72);
select set_goal(:'body_b', 62, 'recommended');
select t_expect_count('select 1 from body_profiles where goal_set_on = current_date and profile_id = ' || quote_literal(:B), 1, 'goal_set_on');
select t_expect_count('select 1 from body_profiles', 3, 'B ahora se ve a sí mismo también');
reset role;

\echo '== Hijo menor con cuenta (C): solo lectura de lo suyo'
select set_config('request.jwt.claim.sub', :C, true) \gset
set local role authenticated;
select t_expect_count('select 1 from body_profiles', 1, 'C ve solo lo suyo');
select t_expect_count('select 1 from weight_logs', 2, 'C ve sus 2 pesajes');
select t_expect_count('select 1 from dependents', 1, 'C ve los nombres de los dependientes');
select t_expect_err('select save_body(' || quote_literal(:C) || ', null, ''female'', (current_date - interval ''10 years'')::date, 140, ''active'')', 'forbidden');
select t_expect_err('select add_weight(' || quote_literal(:'body_c') || ', current_date, 40)', 'forbidden');
select t_expect_err('select add_dependent(''X'', null, null, null)', 'only parents');
reset role;

\echo '== Hijo con cuenta ya adulto (E): se autogestiona y los padres pierden acceso'
select set_config('request.jwt.claim.sub', :E, true) \gset
set local role authenticated;
select t_expect_count('select 1 from body_profiles', 1, 'E ve solo lo suyo');
select add_weight(:'body_e', current_date, 62);
select save_body(:E, null, 'female', date '2000-01-01', 166, 'moderate');
select set_goal(:'body_e', 58, 'gentle');
reset role;
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
select t_expect_count('select 1 from body_profiles where profile_id = ' || quote_literal(:E), 0, 'A sigue sin ver a E');
select t_expect_err('select add_weight(' || quote_literal(:'body_e') || ', current_date, 61)', 'forbidden');
reset role;

\echo '== Otra familia (F) y usuarios sin sesión'
select set_config('request.jwt.claim.sub', :F, true) \gset
set local role authenticated;
select t_expect_count('select 1 from body_profiles', 0, 'F no ve nada');
select t_expect_count('select 1 from weight_logs', 0, 'F no ve pesajes');
select t_expect_count('select 1 from dependents', 0, 'F no ve dependientes');
select t_expect_err('select add_weight(' || quote_literal(:'body_a') || ', current_date, 80)', 'forbidden');
select t_expect_err('select remove_dependent(' || quote_literal(:'dep') || ')', 'not found');
select t_expect_err('select update_dependent(' || quote_literal(:'dep') || ', ''Hack'', null)', 'not found');
reset role;
set local role anon;
select t_expect_err('select 1 from body_profiles', 'permission denied');
select t_expect_err('select 1 from weight_logs', 'permission denied');
select t_expect_err('select add_weight(' || quote_literal(:'body_a') || ', current_date, 80)', 'permission denied');
reset role;

\echo '== service_role (cliente admin del servidor) ve todo'
set local role service_role;
select t_expect_count(
  'select 1 from body_profiles b left join dependents d on d.id = b.dependent_id where b.profile_id in (' || quote_literal(:A) || ',' || quote_literal(:B) || ',' || quote_literal(:C) || ',' || quote_literal(:E) || ',' || quote_literal(:F) || ') or d.family_id in (''f0000000-0000-0000-0000-000000000001'', ''f0000000-0000-0000-0000-000000000002'')',
  5, 'service_role ve las 5 filas de la prueba (A, B, C, E y el dependiente)');
reset role;

\echo '== Al sacar a C de la familia, los padres pierden el acceso y C conserva lo suyo'
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
select remove_member(:C);
select t_expect_count('select 1 from body_profiles', 2, 'A ve su fila y la del dependiente');
reset role;
select set_config('request.jwt.claim.sub', :C, true) \gset
set local role authenticated;
select t_expect_count('select 1 from body_profiles', 1, 'C conserva su historial');
reset role;

\echo '== Borrar pesajes y dependientes'
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
select delete_weight(:'log_a');
select t_expect_count('select 1 from weight_logs where body_id = ' || quote_literal(:'body_a'), 0, 'pesaje borrado');
select update_dependent(:'dep', 'Bebé Sol', null);
select remove_dependent(:'dep');
select t_expect_count('select 1 from dependents', 0, 'dependiente borrado');
reset role;
select t_expect_count('select 1 from body_profiles where dependent_id = ' || quote_literal(:'dep'), 0, 'su fila corporal se borra en cascada');

\echo '== Alimentos propios con kcal y comidas con escala'
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
insert into foods (family_id, name_es, name_en, category, default_unit, kcal_100g, g_per_unit)
values ('f0000000-0000-0000-0000-000000000001', 'Pan casero', 'Homemade bread', 'custom', 'unit', 250, 60);
select t_expect_err('insert into foods (family_id, name_es, name_en, category, default_unit, kcal_100g) values (''f0000000-0000-0000-0000-000000000001'', ''x'', ''x'', ''custom'', ''g'', 5000)', 'foods_kcal_100g_check');
insert into meals (family_id, date, slot, title, status, kcal_per_serving)
values ('f0000000-0000-0000-0000-000000000001', current_date, 'lunch', 'Comida casera', 'planned', 650);
select t_expect_err('update meals set portion_scale = 0.1', 'meals_portion_scale_check');
update meals set portion_scale = 1.5 where title = 'Comida casera';
reset role;
select set_config('request.jwt.claim.sub', :E, true) \gset
set local role authenticated;
select t_expect_err('insert into foods (family_id, name_es, name_en, category, default_unit) values (''f0000000-0000-0000-0000-000000000001'', ''y'', ''y'', ''custom'', ''g'')', 'row-level security');
reset role;

rollback;
\o
\echo 'TODAS LAS PRUEBAS PASARON'
