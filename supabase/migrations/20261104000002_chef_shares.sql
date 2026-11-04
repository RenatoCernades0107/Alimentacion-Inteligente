-- Links para compartir un plan del Chef IA (como "compartir chat" de ChatGPT o Claude).
--
-- * Compartir guarda una FOTO del borrador (plan + conversación + ajustes) en `chef_shares`; lo que se
--   cambie después en el borrador no se ve en el link hasta que el dueño lo actualice.
-- * El id de la fila es el token del link (/s/<id>): un uuid aleatorio, imposible de adivinar.
-- * Quien tenga el link puede verlo (incluso sin cuenta) con `get_chef_share`, que devuelve solo la foto
--   y el primer nombre del dueño. Para seguir editando, la app copia la foto como un borrador propio.
-- * `dishes` guarda nombre, foto, kcal y macros de los platos del plan, para mostrarlos aunque quien
--   mira no tenga acceso a esas recetas (ej. recetas propias de otra familia). Nunca el inventario.
-- * Solo el dueño del borrador crea, actualiza o borra su link. Borrar el borrador borra el link.

create table chef_shares (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null unique references chef_drafts on delete cascade,
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  family_id uuid not null default my_family_id() references families on delete cascade,
  title text not null default '' check (char_length(title) <= 80),
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 262144),
  dishes jsonb not null default '{}'::jsonb check (jsonb_typeof(dishes) = 'object' and pg_column_size(dishes) <= 131072),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chef_shares_user_idx on chef_shares (user_id);

create trigger chef_shares_touch before update on chef_shares
  for each row execute function chef_drafts_touch();

alter table chef_shares enable row level security;

revoke all on chef_shares from anon, authenticated;
grant select, insert, delete on chef_shares to authenticated;
grant update (title, data, dishes) on chef_shares to authenticated;
grant all on chef_shares to service_role;

create policy "links chef: los míos" on chef_shares for select to authenticated
  using (user_id = (select auth.uid()));
-- Solo se comparte un borrador propio y de la familia actual.
create policy "links chef: crear de mis borradores" on chef_shares for insert to authenticated
  with check (
    user_id = (select auth.uid()) and family_id = (select my_family_id())
    and exists (select 1 from chef_drafts d where d.id = draft_id and d.user_id = (select auth.uid()))
  );
create policy "links chef: actualizar los míos" on chef_shares for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "links chef: borrar los míos" on chef_shares for delete to authenticated
  using (user_id = (select auth.uid()));

-- Leer un link compartido (cualquiera con el token, con o sin cuenta). `is_mine` y `draft_id` permiten
-- que el dueño vuelva a su borrador en vez de crear una copia; a los demás no se les da el draft_id.
create or replace function get_chef_share(p_id uuid)
returns table (id uuid, title text, data jsonb, dishes jsonb, owner_name text, updated_at timestamptz, is_mine boolean, draft_id uuid)
language sql stable security definer set search_path = public
as $$
  select s.id, s.title, s.data, s.dishes,
         nullif(split_part(coalesce(p.full_name, ''), ' ', 1), ''),
         s.updated_at,
         s.user_id = auth.uid(),
         case when s.user_id = auth.uid() then s.draft_id end
  from chef_shares s
  left join profiles p on p.id = s.user_id
  where s.id = p_id
$$;

revoke execute on function get_chef_share(uuid) from public;
grant execute on function get_chef_share(uuid) to anon, authenticated, service_role;
