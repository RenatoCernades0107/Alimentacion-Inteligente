-- Pruebas de permisos (RLS + función) de los links para compartir planes del Chef IA.
--
-- Uso (sobre una base DESECHABLE con las migraciones aplicadas; todo corre en una transacción que
-- termina en ROLLBACK, pero aun así no lo apuntes a datos reales):
--   docker exec -i <contenedor db> psql -v ON_ERROR_STOP=1 -q -U supabase_admin -d postgres < supabase/tests/chef_shares_rls.sql
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
\set A '''d2000000-0000-0000-0000-00000000000a'''
\set B '''d2000000-0000-0000-0000-00000000000b'''
\set C '''d2000000-0000-0000-0000-00000000000c'''
\set F1 '''e2000000-0000-0000-0000-000000000001'''
\set F2 '''e2000000-0000-0000-0000-000000000002'''

insert into auth.users (id, email) values (:A, 'a@shares.test'), (:B, 'b@shares.test'), (:C, 'c@shares.test');
insert into families (id, name) values (:F1, 'Familia 1'), (:F2, 'Familia 2');
update profiles set family_id = :F1, role = 'parent' where id = :A;
update profiles set family_id = :F1, role = 'child' where id = :B;
update profiles set family_id = :F2, role = 'parent' where id = :C;

\echo '== A crea un borrador y lo comparte'
update profiles set full_name = 'Ana Pérez' where id = :A;
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
insert into chef_drafts (title, data) values ('Semana de A', '{"v":2}') returning id as da \gset
insert into chef_shares (draft_id, title, data) values (:'da', 'Semana de A', '{"v":2}') returning id as sa \gset
select t_expect_count('select 1 from chef_shares where id = ' || quote_literal(:'sa') || ' and user_id = ' || quote_literal(:A), 1, 'el link es de A');
select t_expect_count('select 1 from get_chef_share(' || quote_literal(:'sa') || ') where is_mine and draft_id = ' || quote_literal(:'da'), 1, 'A ve que es suyo y su borrador');
-- Un borrador solo tiene un link.
select t_expect_err('insert into chef_shares (draft_id, data) values (' || quote_literal(:'da') || ', ''{}'')', 'duplicate key');
-- No se cambia de borrador ni de dueño; sí la foto.
select t_expect_err('update chef_shares set draft_id = gen_random_uuid() where id = ' || quote_literal(:'sa'), 'permission denied');
update chef_shares set title = 'Semana de A v2', data = '{"v":2,"x":1}' where id = :'sa';
reset role;

\echo '== B (misma familia) no puede compartir ni tocar el borrador de A'
select set_config('request.jwt.claim.sub', :B, true) \gset
set local role authenticated;
select t_expect_err('insert into chef_shares (draft_id, data) values (' || quote_literal(:'da') || ', ''{}'')', 'row-level security');
select t_expect_count('select 1 from chef_shares', 0, 'B no lista los links de A');
update chef_shares set title = 'hackeado' where id = :'sa';
delete from chef_shares where id = :'sa';
-- Pero con el link sí lo ve (sin draft_id y sin is_mine).
select t_expect_count('select 1 from get_chef_share(' || quote_literal(:'sa') || ') where title = ''Semana de A v2'' and owner_name = ''Ana'' and not is_mine and draft_id is null', 1, 'B abre el link');
reset role;

\echo '== Sin cuenta (anon) y de otra familia: solo con el link'
select set_config('request.jwt.claim.sub', '', true) \gset
set local role anon;
select t_expect_count('select 1 from get_chef_share(' || quote_literal(:'sa') || ') where draft_id is null', 1, 'anon abre el link');
select t_expect_count('select 1 from get_chef_share(gen_random_uuid())', 0, 'un token inventado no devuelve nada');
select t_expect_err('select * from chef_shares', 'permission denied');
reset role;
select set_config('request.jwt.claim.sub', :C, true) \gset
set local role authenticated;
select t_expect_count('select 1 from get_chef_share(' || quote_literal(:'sa') || ')', 1, 'C (otra familia) abre el link');
select t_expect_count('select 1 from chef_shares', 0, 'C no lista links ajenos');
reset role;

\echo '== Dejar de compartir y borrar el borrador'
select set_config('request.jwt.claim.sub', :A, true) \gset
set local role authenticated;
delete from chef_shares where id = :'sa';
select t_expect_count('select 1 from get_chef_share(' || quote_literal(:'sa') || ')', 0, 'el link dejó de funcionar');
insert into chef_shares (draft_id, data) values (:'da', '{"v":2}') returning id as sb \gset
delete from chef_drafts where id = :'da';
select t_expect_count('select 1 from get_chef_share(' || quote_literal(:'sb') || ')', 0, 'borrar el borrador borra su link');
reset role;

rollback;
\o
\echo 'TODAS LAS PRUEBAS PASARON'
