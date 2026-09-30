-- Peso, metas y calorías por integrante + nutrición de alimentos y comidas.
--
-- * foods / recipes: kcal por 100 g, equivalencias a gramos y kcal por porción de cada receta.
-- * meals / meal_series: kcal manual (comidas sin receta) y escala de porciones (comidas con receta).
-- * dependents: integrantes sin cuenta (bebés, niños) que administran los padres.
-- * body_profiles / weight_logs: sexo, fecha de nacimiento, estatura, actividad, meta y pesajes.
--
-- Privacidad: el peso es un dato sensible. Cada persona ve lo suyo; los padres ven y editan a los
-- menores de 18 años (con o sin cuenta) de su familia. Las tablas nuevas solo se leen con RLS y
-- TODA escritura pasa por las funciones de abajo (security definer), que validan permisos y rangos.

-------------------------------------------------------------------------------
-- Nutrición del catálogo, recetas y comidas
-------------------------------------------------------------------------------
alter table foods
  add column kcal_100g numeric check (kcal_100g between 0 and 1000),  -- por 100 g del alimento (crudo/seco); la grasa pura ronda 900
  add column g_per_unit numeric check (g_per_unit > 0 and g_per_unit <= 5000), -- gramos de "1 unidad"
  add column g_per_ml numeric not null default 1 check (g_per_ml > 0);          -- densidad, para ml y l

-- Precalculado en el seed (scripts/build-seed.mjs): kcal por porción con los ingredientes obligatorios.
alter table recipes
  add column kcal_per_serving int check (kcal_per_serving between 0 and 5000),
  add column kcal_complete boolean not null default false;

-- portion_scale: multiplicador de los ingredientes de una comida con receta (1 = como rinde la receta).
-- kcal_per_serving: kcal por porción ingresadas a mano, para comidas sin receta.
alter table meals
  add column portion_scale numeric not null default 1 check (portion_scale between 0.25 and 20),
  add column kcal_per_serving int check (kcal_per_serving between 1 and 3000);
alter table meal_series
  add column kcal_per_serving int check (kcal_per_serving between 1 and 3000);

-------------------------------------------------------------------------------
-- Integrantes sin cuenta, datos corporales y pesajes
-------------------------------------------------------------------------------
create type body_sex as enum ('female', 'male');
create type activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type goal_pace as enum ('gentle', 'recommended', 'fast');

create table dependents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  avatar text check (avatar is null or avatar ~ '^[a-z0-9-]{1,40}$'),
  created_by uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);
create index on dependents (family_id);

create table body_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles on delete cascade,
  dependent_id uuid unique references dependents on delete cascade,
  sex body_sex,
  birth_date date,
  height_cm numeric(4, 1) check (height_cm between 45 and 230),
  activity activity_level not null default 'light',
  goal_weight_kg numeric(5, 2) check (goal_weight_kg between 20 and 300),
  goal_pace goal_pace not null default 'recommended',
  goal_set_on date,
  updated_at timestamptz not null default now(),
  check ((profile_id is null) <> (dependent_id is null))
);

create table weight_logs (
  id uuid primary key default gen_random_uuid(),
  body_id uuid not null references body_profiles on delete cascade,
  logged_on date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 2 and 400),
  height_cm numeric(4, 1) check (height_cm between 45 and 230),   -- opcional: crecimiento de menores
  created_by uuid references profiles on delete set null,
  created_at timestamptz not null default now(),
  unique (body_id, logged_on)
);

-------------------------------------------------------------------------------
-- Permisos
-------------------------------------------------------------------------------

-- Años cumplidos (null si no hay fecha).
create or replace function age_years(p_birth date) returns int
language sql stable
as $$ select case when p_birth is null then null else extract(year from age(current_date, p_birth))::int end $$;

-- Qué puede hacer el usuario actual con los datos corporales de una persona (cuenta o dependiente):
--   'edit' | 'view' | 'none'.
--   * Cuenta propia: la ve siempre; la edita si es padre o si ya cumplió 18 (los hijos menores solo leen).
--   * Cuenta `child` de mi familia: solo los padres, y mientras sea menor de 18 (o sin fecha de nacimiento).
--   * Dependiente: solo los padres de su familia.
create or replace function body_access(p_profile uuid, p_dependent uuid)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_me profiles;
  v_target profiles;
  v_birth date;
begin
  select * into v_me from profiles where id = auth.uid();
  if not found then return 'none'; end if;

  if p_profile is not null then
    select birth_date into v_birth from body_profiles where profile_id = p_profile;
    if p_profile = auth.uid() then
      if v_me.role = 'parent' or coalesce(age_years(v_birth), 0) >= 18 then return 'edit'; end if;
      return 'view';
    end if;
    select * into v_target from profiles where id = p_profile;
    if found and v_me.role = 'parent' and v_me.family_id is not null
       and v_target.family_id = v_me.family_id and v_target.role = 'child'
       and (v_birth is null or age_years(v_birth) < 18) then
      return 'edit';
    end if;
    return 'none';
  end if;

  if p_dependent is not null and v_me.role = 'parent' and v_me.family_id is not null
     and exists (select 1 from dependents d where d.id = p_dependent and d.family_id = v_me.family_id) then
    return 'edit';
  end if;
  return 'none';
end $$;

revoke execute on function age_years(date), body_access(uuid, uuid) from public, anon;
grant execute on function age_years(date), body_access(uuid, uuid) to authenticated, service_role;

-------------------------------------------------------------------------------
-- RLS y privilegios: las tablas nuevas solo se leen; se escribe por RPC
-------------------------------------------------------------------------------
alter table dependents enable row level security;
alter table body_profiles enable row level security;
alter table weight_logs enable row level security;

revoke all on dependents, body_profiles, weight_logs from anon, authenticated;
grant select on dependents, body_profiles, weight_logs to authenticated;
grant all on dependents, body_profiles, weight_logs to service_role;

create policy "dependientes: familia ve" on dependents for select using (family_id = my_family_id());

create policy "cuerpo: ver los que me corresponden" on body_profiles for select
  using (body_access(profile_id, dependent_id) <> 'none');

-- Se apoya en la política de body_profiles: quien no ve la persona no ve sus pesajes.
create policy "pesajes: ver los que me corresponden" on weight_logs for select
  using (exists (select 1 from body_profiles b where b.id = weight_logs.body_id));

-------------------------------------------------------------------------------
-- RPCs
-------------------------------------------------------------------------------

-- Un padre agrega a un integrante sin cuenta (con su fila de datos corporales).
create or replace function add_dependent(p_name text, p_avatar text, p_birth date, p_sex body_sex)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_name text := trim(p_name);
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not is_parent() then raise exception 'only parents'; end if;
  if v_name is null or char_length(v_name) not between 1 and 40 then raise exception 'invalid name'; end if;
  if p_birth is not null and (p_birth > current_date or p_birth < current_date - interval '120 years') then
    raise exception 'invalid birth date';
  end if;
  insert into dependents (family_id, name, avatar, created_by)
  values (my_family_id(), v_name, p_avatar, auth.uid())
  returning id into v_id;
  insert into body_profiles (dependent_id, sex, birth_date) values (v_id, p_sex, p_birth);
  return v_id;
end $$;

create or replace function update_dependent(p_id uuid, p_name text, p_avatar text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_name text := trim(p_name);
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not is_parent() then raise exception 'only parents'; end if;
  if v_name is null or char_length(v_name) not between 1 and 40 then raise exception 'invalid name'; end if;
  update dependents set name = v_name, avatar = p_avatar where id = p_id and family_id = my_family_id();
  if not found then raise exception 'not found'; end if;
end $$;

create or replace function remove_dependent(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not is_parent() then raise exception 'only parents'; end if;
  delete from dependents where id = p_id and family_id = my_family_id();
  if not found then raise exception 'not found'; end if;
end $$;

-- Crea o actualiza los datos corporales de una persona (exactamente una de las dos referencias).
create or replace function save_body(
  p_profile uuid, p_dependent uuid, p_sex body_sex, p_birth date, p_height numeric, p_activity activity_level
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_minor boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if (p_profile is null) = (p_dependent is null) then raise exception 'invalid target'; end if;
  if body_access(p_profile, p_dependent) <> 'edit' then raise exception 'forbidden'; end if;
  if p_birth is not null and (p_birth > current_date or p_birth < current_date - interval '120 years') then
    raise exception 'invalid birth date';
  end if;
  if p_height is not null and p_height not between 45 and 230 then raise exception 'invalid height'; end if;

  v_minor := p_birth is not null and age_years(p_birth) < 18;

  if p_profile is not null then
    select id into v_id from body_profiles where profile_id = p_profile;
  else
    select id into v_id from body_profiles where dependent_id = p_dependent;
  end if;

  if v_id is null then
    insert into body_profiles (profile_id, dependent_id, sex, birth_date, height_cm, activity)
    values (p_profile, p_dependent, p_sex, p_birth, p_height, coalesce(p_activity, 'light'))
    returning id into v_id;
  else
    update body_profiles set
      sex = p_sex, birth_date = p_birth, height_cm = p_height, activity = coalesce(p_activity, activity),
      -- Los menores no tienen meta de peso.
      goal_weight_kg = case when v_minor then null else goal_weight_kg end,
      goal_set_on = case when v_minor then null else goal_set_on end,
      updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end $$;

-- Fija (o quita, con null) la meta de peso de un adulto. Requiere haber registrado su peso.
create or replace function set_goal(p_body uuid, p_goal numeric, p_pace goal_pace)
returns void
language plpgsql security definer set search_path = public
as $$
declare v body_profiles;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v from body_profiles where id = p_body;
  if not found then raise exception 'not found'; end if;
  if body_access(v.profile_id, v.dependent_id) <> 'edit' then raise exception 'forbidden'; end if;
  if p_goal is not null then
    if p_goal not between 20 and 300 then raise exception 'invalid goal'; end if;
    if coalesce(age_years(v.birth_date), 0) < 18 then raise exception 'goals are for adults'; end if;
    if not exists (select 1 from weight_logs where body_id = p_body) then raise exception 'weight required'; end if;
  end if;
  update body_profiles set
    goal_weight_kg = p_goal,
    goal_pace = coalesce(p_pace, goal_pace),
    goal_set_on = case
      when p_goal is null then null
      when goal_weight_kg is distinct from p_goal or goal_set_on is null then current_date
      else goal_set_on
    end,
    updated_at = now()
  where id = p_body;
end $$;

-- Registra (o corrige, si ya hay uno ese día) un pesaje. `p_cm` opcional actualiza la estatura vigente.
create or replace function add_weight(p_body uuid, p_on date, p_kg numeric, p_cm numeric default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v body_profiles;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v from body_profiles where id = p_body;
  if not found then raise exception 'not found'; end if;
  if body_access(v.profile_id, v.dependent_id) <> 'edit' then raise exception 'forbidden'; end if;
  if p_kg is null or p_kg not between 2 and 400 then raise exception 'invalid weight'; end if;
  if p_cm is not null and p_cm not between 45 and 230 then raise exception 'invalid height'; end if;
  -- +1 día de holgura por husos horarios adelantados a UTC.
  if p_on is null or p_on > current_date + 1 or p_on < current_date - interval '120 years'
     or (v.birth_date is not null and p_on < v.birth_date) then
    raise exception 'invalid date';
  end if;

  insert into weight_logs (body_id, logged_on, weight_kg, height_cm, created_by)
  values (p_body, p_on, p_kg, p_cm, auth.uid())
  on conflict (body_id, logged_on) do update
    set weight_kg = excluded.weight_kg,
        height_cm = coalesce(excluded.height_cm, weight_logs.height_cm),
        created_by = auth.uid()
  returning id into v_id;

  -- Si es el pesaje más reciente y trae estatura, esa pasa a ser la vigente.
  if p_cm is not null and p_on >= (select max(logged_on) from weight_logs where body_id = p_body) then
    update body_profiles set height_cm = p_cm, updated_at = now() where id = p_body;
  end if;
  return v_id;
end $$;

create or replace function delete_weight(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v body_profiles;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select b.* into v from weight_logs w join body_profiles b on b.id = w.body_id where w.id = p_id;
  if not found then raise exception 'not found'; end if;
  if body_access(v.profile_id, v.dependent_id) <> 'edit' then raise exception 'forbidden'; end if;
  delete from weight_logs where id = p_id;
end $$;

revoke execute on function
  add_dependent(text, text, date, body_sex), update_dependent(uuid, text, text), remove_dependent(uuid),
  save_body(uuid, uuid, body_sex, date, numeric, activity_level), set_goal(uuid, numeric, goal_pace),
  add_weight(uuid, date, numeric, numeric), delete_weight(uuid)
from public, anon;
grant execute on function
  add_dependent(text, text, date, body_sex), update_dependent(uuid, text, text), remove_dependent(uuid),
  save_body(uuid, uuid, body_sex, date, numeric, activity_level), set_goal(uuid, numeric, goal_pace),
  add_weight(uuid, date, numeric, numeric), delete_weight(uuid)
to authenticated, service_role;
