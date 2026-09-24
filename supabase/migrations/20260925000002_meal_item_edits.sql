-- Ingredientes editables por comida (quitar, cambiar porción, agregar alimentos).
--
-- Por defecto una comida usa los ingredientes de su receta. Cuando se editan:
--   * solo esta comida    -> filas con meal_id   y meals.custom_items = true
--   * toda la recurrencia -> filas con series_id y meal_series.custom_items = true
-- Al completar la comida se descuenta del inventario lo que diga esa lista.

alter table meals add column custom_items boolean not null default false;
alter table meal_series add column custom_items boolean not null default false;

create table meal_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families on delete cascade,
  meal_id uuid references meals on delete cascade,
  series_id uuid references meal_series on delete cascade,
  food_id uuid not null references foods on delete cascade,
  quantity numeric check (quantity is null or quantity > 0),
  unit text check (unit in ('unit', 'g', 'kg', 'ml', 'l')),
  optional boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  check ((meal_id is null) <> (series_id is null)),
  unique (meal_id, food_id),
  unique (series_id, food_id)
);
create index on meal_items (meal_id) where meal_id is not null;
create index on meal_items (series_id) where series_id is not null;

alter table meal_items enable row level security;

create policy "ingredientes de comida: familia ve" on meal_items for select
  using (family_id = my_family_id());

-- Solo padres, y la comida / serie tiene que ser de su familia.
create policy "ingredientes de comida: padres gestionan" on meal_items for all
  using (family_id = my_family_id() and is_parent())
  with check (
    family_id = my_family_id() and is_parent()
    and (meal_id is null or exists (select 1 from meals m where m.id = meal_id and m.family_id = meal_items.family_id))
    and (series_id is null or exists (select 1 from meal_series s where s.id = series_id and s.family_id = meal_items.family_id))
  );
