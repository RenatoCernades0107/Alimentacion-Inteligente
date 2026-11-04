-- Borradores del Chef IA: cada conversación con el Chef (mensajes + plan + preferencias) se guarda
-- como un borrador, al estilo de los chats de ChatGPT, para retomarla o reusarla luego.
--
-- * Son personales: solo los ve y edita quien los creó (y solo mientras pertenece a esa familia).
-- * `data` es el JSON del borrador tal como lo usa la app (`DraftData` en src/lib/chef.ts); la app lo
--   valida con zod al guardar y al leer. El tamaño se limita para que no crezca sin control.
-- * Ni `user_id` ni `family_id` se confían al cliente: los defaults salen de auth.uid() y my_family_id(),
--   y las políticas exigen que coincidan.

create table chef_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  family_id uuid not null default my_family_id() references families on delete cascade,
  title text not null default '' check (char_length(title) <= 80),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chef_drafts_user_idx on chef_drafts (user_id, updated_at desc);

-- updated_at se pone solo en cada cambio.
create or replace function chef_drafts_touch() returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger chef_drafts_touch before update on chef_drafts
  for each row execute function chef_drafts_touch();

alter table chef_drafts enable row level security;

revoke all on chef_drafts from anon, authenticated;
grant select, insert, delete on chef_drafts to authenticated;
-- Solo se editan el título y el contenido (no el dueño ni la familia).
grant update (title, data) on chef_drafts to authenticated;
grant all on chef_drafts to service_role;

create policy "borradores chef: los míos" on chef_drafts for select to authenticated
  using (user_id = (select auth.uid()) and family_id = (select my_family_id()));
create policy "borradores chef: crear los míos" on chef_drafts for insert to authenticated
  with check (user_id = (select auth.uid()) and family_id = (select my_family_id()));
create policy "borradores chef: editar los míos" on chef_drafts for update to authenticated
  using (user_id = (select auth.uid()) and family_id = (select my_family_id()))
  with check (user_id = (select auth.uid()) and family_id = (select my_family_id()));
create policy "borradores chef: borrar los míos" on chef_drafts for delete to authenticated
  using (user_id = (select auth.uid()) and family_id = (select my_family_id()));
