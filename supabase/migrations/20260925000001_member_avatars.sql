-- Avatares animados para los miembros de la familia.
-- `avatar` guarda el id de un avatar predefinido (archivo en public/avatars/<id>.svg).
-- Es independiente de `avatar_url` (foto de Google), que se usa como respaldo.

alter table profiles
  add column avatar text check (avatar is null or avatar ~ '^[a-z0-9-]{1,40}$');

-- Cambia el avatar de un miembro. Cada uno puede cambiar el suyo y los padres
-- además pueden cambiar el de sus hijos. `p_avatar` null vuelve al predeterminado.
create or replace function set_member_avatar(p_user uuid, p_avatar text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_user <> auth.uid() and not (
    is_parent() and exists (
      select 1 from profiles
       where id = p_user and family_id = my_family_id() and role = 'child'
    )
  ) then
    raise exception 'forbidden';
  end if;
  update profiles set avatar = p_avatar where id = p_user;
end $$;
