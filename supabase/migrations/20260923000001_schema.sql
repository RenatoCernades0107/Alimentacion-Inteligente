-- Esquema base de Alimentación Inteligente

create extension if not exists pg_trgm with schema public;
create extension if not exists unaccent with schema public;
create extension if not exists pgcrypto with schema extensions;

create type member_role as enum ('parent', 'child');
create type meal_status as enum ('proposed', 'planned', 'completed', 'cancelled');
create type recurrence as enum ('daily', 'weekdays', 'weekly', 'biweekly', 'monthly');
create type meal_slot as enum ('breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner');

-- unaccent() no es IMMUTABLE; este wrapper permite usarlo en índices.
create or replace function f_unaccent(text) returns text
language sql immutable parallel safe strict
as $$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;

-------------------------------------------------------------------------------
-- Familias y miembros
-------------------------------------------------------------------------------
create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meals_per_day int not null default 3 check (meals_per_day between 3 and 5),
  timezone text not null default 'America/Lima',
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  avatar_url text,
  locale text not null default 'es' check (locale in ('es', 'en')),
  family_id uuid references families on delete set null,
  role member_role,
  created_at timestamptz not null default now()
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  family_id uuid not null references families on delete cascade,
  role member_role not null,
  created_by uuid references profiles on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);
create index on invites (family_id, role) where used_at is null;

-------------------------------------------------------------------------------
-- Catálogo de alimentos (genéricos globales + propios de cada familia)
-------------------------------------------------------------------------------
create table foods (
  id uuid primary key default gen_random_uuid(),
  key text unique,                          -- solo genéricos del catálogo
  family_id uuid references families on delete cascade, -- null = catálogo global
  name_es text not null,
  name_en text not null,
  category text not null default 'other',
  emoji text,
  image_url text,
  shelf_life_days int,                      -- vida útil estimada
  default_unit text not null default 'unit' check (default_unit in ('unit', 'g', 'kg', 'ml', 'l')),
  aliases text[] not null default '{}',
  created_by uuid references profiles on delete set null,
  created_at timestamptz not null default now()
);

-- Texto de búsqueda normalizado (sin tildes, minúsculas). IMMUTABLE para poder indexarlo.
create or replace function food_search_text(n_es text, n_en text, a text[]) returns text
language sql immutable parallel safe
as $$ select public.f_unaccent(lower(n_es || ' ' || n_en || ' ' || array_to_string(a, ' '))) $$;

create index foods_search_idx on foods using gin (food_search_text(name_es, name_en, aliases) gin_trgm_ops);

-------------------------------------------------------------------------------
-- Inventario
-------------------------------------------------------------------------------
create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  food_id uuid references foods on delete set null,
  -- Producto empaquetado (Open Food Facts)
  barcode text,
  product_name text,
  brand text,
  image_url text,
  quantity numeric not null default 1 check (quantity >= 0),
  unit text not null default 'unit' check (unit in ('unit', 'g', 'kg', 'ml', 'l')),
  expires_on date,
  expiry_estimated boolean not null default false,
  created_by uuid references profiles on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on inventory_items (family_id, expires_on);

-------------------------------------------------------------------------------
-- Recetas
-------------------------------------------------------------------------------
create table recipes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  country text not null check (country in ('PE', 'US')),
  name_es text not null,
  name_en text not null,
  description_es text,
  description_en text,
  emoji text,
  image_url text,
  meal_types text[] not null default '{lunch,dinner}',
  servings int not null default 4,
  time_minutes int,
  source_url text,
  steps_es text[] not null default '{}',
  steps_en text[] not null default '{}'
);

create table recipe_ingredients (
  recipe_id uuid not null references recipes on delete cascade,
  food_id uuid not null references foods on delete cascade,
  quantity numeric,
  unit text check (unit in ('unit', 'g', 'kg', 'ml', 'l')),
  optional boolean not null default false,
  primary key (recipe_id, food_id)
);

-------------------------------------------------------------------------------
-- Calendario
-------------------------------------------------------------------------------
create table meal_series (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  recipe_id uuid references recipes on delete set null,
  title text,
  slot meal_slot not null,
  recurrence recurrence not null,
  start_date date not null,
  end_date date,
  materialized_until date not null,
  created_by uuid references profiles on delete set null,
  created_at timestamptz not null default now(),
  check (recipe_id is not null or title is not null)
);

create table meals (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  date date not null,
  slot meal_slot not null,
  recipe_id uuid references recipes on delete set null,
  title text,
  series_id uuid references meal_series on delete cascade,
  is_exception boolean not null default false, -- editada/cancelada individualmente
  status meal_status not null default 'planned',
  proposed_by uuid references profiles on delete set null,
  completed_by uuid references profiles on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (recipe_id is not null or title is not null)
);
create index on meals (family_id, date);
alter table meals add constraint meals_series_date_key unique (series_id, date);

-------------------------------------------------------------------------------
-- Push
-------------------------------------------------------------------------------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table notification_log (
  id bigint generated always as identity primary key,
  dedupe_key text not null unique,
  sent_at timestamptz not null default now()
);

-------------------------------------------------------------------------------
-- Helpers de permisos
-------------------------------------------------------------------------------
create or replace function my_family_id() returns uuid
language sql stable security definer set search_path = public
as $$ select family_id from profiles where id = auth.uid() $$;

create or replace function is_parent() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select role = 'parent' from profiles where id = auth.uid()), false) $$;

-- Perfil automático al registrarse
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-------------------------------------------------------------------------------
-- RLS
-------------------------------------------------------------------------------
alter table families enable row level security;
alter table profiles enable row level security;
alter table invites enable row level security;
alter table foods enable row level security;
alter table inventory_items enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table meal_series enable row level security;
alter table meals enable row level security;
alter table push_subscriptions enable row level security;
alter table notification_log enable row level security;

create policy "familia: ver la propia" on families for select using (id = my_family_id());
create policy "familia: padres editan" on families for update using (id = my_family_id() and is_parent());

create policy "perfiles: ver miembros de mi familia" on profiles for select
  using (id = auth.uid() or family_id = my_family_id());
-- Solo se pueden cambiar datos personales; family_id y role cambian vía RPC.
create policy "perfiles: editar el propio" on profiles for update using (id = auth.uid());
revoke update on profiles from authenticated;
grant update (full_name, locale) on profiles to authenticated;

create policy "invites: padres ven las de su familia" on invites for select
  using (family_id = my_family_id() and is_parent());

create policy "foods: ver catálogo y propios" on foods for select
  using (family_id is null or family_id = my_family_id());
create policy "foods: padres crean propios" on foods for insert
  with check (family_id = my_family_id() and is_parent() and key is null);
create policy "foods: padres editan propios" on foods for update
  using (family_id = my_family_id() and is_parent());
create policy "foods: padres borran propios" on foods for delete
  using (family_id = my_family_id() and is_parent());

create policy "inventario: familia ve" on inventory_items for select using (family_id = my_family_id());
create policy "inventario: padres crean" on inventory_items for insert with check (family_id = my_family_id() and is_parent());
create policy "inventario: padres editan" on inventory_items for update using (family_id = my_family_id() and is_parent());
create policy "inventario: padres borran" on inventory_items for delete using (family_id = my_family_id() and is_parent());

create policy "recetas: todos ven" on recipes for select using (auth.role() = 'authenticated');
create policy "ingredientes: todos ven" on recipe_ingredients for select using (auth.role() = 'authenticated');

create policy "series: familia ve" on meal_series for select using (family_id = my_family_id());
create policy "series: padres gestionan" on meal_series for all
  using (family_id = my_family_id() and is_parent())
  with check (family_id = my_family_id() and is_parent());

create policy "comidas: familia ve" on meals for select using (family_id = my_family_id());
create policy "comidas: padres gestionan" on meals for all
  using (family_id = my_family_id() and is_parent())
  with check (family_id = my_family_id() and is_parent());
-- Hijos: solo pueden proponer comidas sueltas
create policy "comidas: hijos proponen" on meals for insert
  with check (
    family_id = my_family_id() and not is_parent()
    and status = 'proposed' and series_id is null and proposed_by = auth.uid()
  );

create policy "push: propias" on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-------------------------------------------------------------------------------
-- RPCs
-------------------------------------------------------------------------------

-- Crea la familia y deja al usuario como padre.
create or replace function create_family(p_name text, p_meals_per_day int, p_timezone text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_family uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if (select family_id from profiles where id = auth.uid()) is not null then
    raise exception 'already in a family';
  end if;
  insert into families (name, meals_per_day, timezone)
  values (p_name, p_meals_per_day, coalesce(nullif(p_timezone, ''), 'America/Lima'))
  returning id into v_family;
  update profiles set family_id = v_family, role = 'parent' where id = auth.uid();
  return v_family;
end $$;

-- Devuelve el link activo del rol, creando uno nuevo si no existe o venció.
create or replace function get_active_invite(p_role member_role)
returns invites
language plpgsql security definer set search_path = public
as $$
declare v invites;
begin
  if not is_parent() then raise exception 'only parents can invite'; end if;
  select * into v from invites
   where family_id = my_family_id() and role = p_role and used_at is null and expires_at > now()
   order by created_at desc limit 1;
  if not found then
    insert into invites (family_id, role, created_by)
    values (my_family_id(), p_role, auth.uid())
    returning * into v;
  end if;
  return v;
end $$;

-- Info pública de una invitación (para mostrar antes de iniciar sesión).
create or replace function invite_info(p_token text)
returns table (family_name text, role member_role, valid boolean)
language sql stable security definer set search_path = public
as $$
  select f.name, i.role, (i.used_at is null and i.expires_at > now())
  from invites i join families f on f.id = i.family_id
  where i.token = p_token
$$;
grant execute on function invite_info(text) to anon;

-- Acepta la invitación: el link queda usado y se crea uno nuevo para ese rol.
create or replace function accept_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v invites;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v from invites where token = p_token for update;
  if not found or v.used_at is not null or v.expires_at <= now() then
    raise exception 'invalid invite';
  end if;
  if (select family_id from profiles where id = auth.uid()) is not null then
    raise exception 'already in a family';
  end if;
  update invites set used_at = now(), used_by = auth.uid() where id = v.id;
  update profiles set family_id = v.family_id, role = v.role where id = auth.uid();
  insert into invites (family_id, role, created_by) values (v.family_id, v.role, v.created_by);
  return v.family_id;
end $$;

-- Un padre saca a un miembro de la familia.
create or replace function remove_member(p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not is_parent() then raise exception 'only parents'; end if;
  if p_user = auth.uid() then raise exception 'cannot remove yourself'; end if;
  update profiles set family_id = null, role = null
   where id = p_user and family_id = my_family_id();
end $$;

-- Búsqueda difusa en el catálogo (tolera tildes y errores de tipeo).
create or replace function search_foods(p_query text, p_limit int default 12)
returns setof foods
language sql stable
as $$
  with q as (select f_unaccent(lower(trim(p_query))) as t)
  select f.* from foods f, q
  where (f.family_id is null or f.family_id = my_family_id())
    and (
      food_search_text(f.name_es, f.name_en, f.aliases) like '%' || q.t || '%'
      or word_similarity(q.t, food_search_text(f.name_es, f.name_en, f.aliases)) > 0.4
    )
  order by
    (f_unaccent(lower(f.name_es)) like q.t || '%' or lower(f.name_en) like q.t || '%') desc,
    word_similarity(q.t, food_search_text(f.name_es, f.name_en, f.aliases)) desc,
    length(f.name_es)
  limit p_limit
$$;
