-- Pruebas de permisos (RLS) de los borradores del Chef IA: cada borrador es solo de quien lo creó.
--
-- Uso (sobre una base DESECHABLE con las migraciones aplicadas; todo corre en una transacción que
-- termina en ROLLBACK, pero aun así no lo apuntes a datos reales):
--   docker exec -i <contenedor db> psql -v ON_ERROR_STOP=1 -q -U supabase_admin -d postgres < supabase/tests/chef_drafts_rls.sql
-- Si algo falla, psql se detiene con "FALLO: ..." y el resto no se ejecuta.

\set ON_ERROR_STOP on
\o /dev/null
begin;

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

-- Familia 1: A (padre) y B (hijo). Familia 2: C (padre).
\set A '''d1000000-0000-0000-0000-00000000000a'''
\set B '''d1000000-0000-0000-0000-00000000000b'''
\set C '''d1000000-0000-0000-0000-00000000000c'''
\set F1 '''e1000000-0000-0000-0000-000000000001'''
\set F2 '''e1000000-0000-0000-0000-000000000002'''

insert into auth.users (id, email) values (:A, 'a@drafts.test'), (:B, 'b@drafts.test'), (:C, 'c@drafts.test');
insert into families (id, name) values (:F1, 'Familia 1'), (:F2, 'Familia 2');
update profiles set family_id = :F1, role = 'parent' where id = :A;
update profiles set family_id = :F1, role = 'child' where id = :B;
update profiles set family_id = :F2, role = 'parent' where id = :C;

\echo '== A crea un borrador (dueño y familia salen de la sesión)'
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
insert into chef_drafts (title, data) values ('Semana de A', '{"v":2}') returning id as da \gset
select t_expect_count('select 1 from chef_drafts where id = ' || quote_literal(:'da') || ' and user_id = ' || quote_literal(:A) || ' and family_id = ' || quote_literal(:F1), 1, 'el borrador es de A y de su familia');
-- No puede crear uno a nombre de otro ni en otra familia.
select t_expect_err('insert into chef_drafts (user_id, title) values (' || quote_literal(:B) || ', ''x'')', 'row-level security');
select t_expect_err('insert into chef_drafts (family_id, title) values (' || quote_literal(:F2) || ', ''x'')', 'row-level security');
-- No puede cambiar de dueño (solo título y contenido).
select t_expect_err('update chef_drafts set user_id = ' || quote_literal(:B) || ' where id = ' || quote_literal(:'da'), 'permission denied');
update chef_drafts set title = 'Semana de A (v2)', data = '{"v":2,"x":1}' where id = :'da';
select t_expect_count('select 1 from chef_drafts where id = ' || quote_literal(:'da') || ' and title = ''Semana de A (v2)'' and updated_at >= created_at', 1, 'A edita su borrador');
-- Límites de la tabla.
select t_expect_err('insert into chef_drafts (title, data) values (repeat(''x'', 81), ''{}'')', 'chef_drafts_title_check');
select t_expect_err('insert into chef_drafts (title, data) values (''x'', ''[]'')', 'chef_drafts_data_check');
reset role;

\echo '== B (misma familia) y C (otra familia) no lo ven ni lo tocan'
select set_config('request.jwt.claim.sub', :B, true) \gset
set local role authenticated;
select t_expect_count('select 1 from chef_drafts', 0, 'B no ve el borrador de A');
update chef_drafts set title = 'hackeado' where id = :'da';
delete from chef_drafts where id = :'da';
reset role;
select t_expect_count('select 1 from chef_drafts where id = ' || quote_literal(:'da') || ' and title = ''Semana de A (v2)''', 1, 'B no pudo editarlo ni borrarlo');

select set_config('request.jwt.claim.sub', :C, true) \gset
set local role authenticated;
select t_expect_count('select 1 from chef_drafts', 0, 'C no ve el borrador de A');
reset role;

\echo '== Si A deja la familia, su borrador deja de ser visible'
update profiles set family_id = null, role = null where id = :A;
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
select t_expect_count('select 1 from chef_drafts', 0, 'fuera de la familia no ve sus borradores de esa familia');
reset role;

\echo '== A borra su borrador'
update profiles set family_id = :F1, role = 'parent' where id = :A;
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
delete from chef_drafts where id = :'da';
select t_expect_count('select 1 from chef_drafts', 0, 'A borró su borrador');
reset role;

rollback;
\o
\echo 'TODAS LAS PRUEBAS PASARON'
