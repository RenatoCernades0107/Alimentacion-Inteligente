-- Precios de los alimentos y tienda de la familia, para calcular el costo de los platos y del plan.
--
-- * families.store: tienda donde compra la familia (Plaza Vea, Wong, Metro o Tottus). La eligen los padres.
-- * foods.est_pen_per_kg: precio ESTIMADO en soles por kg (respaldo). Los del catálogo vienen del seed
--   (supabase/data/prices.mjs, convertidos a kg con g_per_unit / g_per_ml); los propios quedan en null.
-- * store_products.prices: precio de cada producto por tienda ({"wong": 12.9, ...}), del scraper.
-- * food_store_prices: mediana del precio por kg de los productos de un alimento en cada tienda
--   (la calcula scripts/build-seed.mjs a partir de store_products).
-- * food_prices(p_store): precio por kg de cada alimento visible para la tienda pedida. Si esa tienda
--   no lo tiene, usa la mediana de las otras tiendas y, si ninguna lo tiene, el estimado.
--
-- El costo de un plato no se guarda: la app lo calcula de sus ingredientes (src/lib/cost.ts) con los
-- precios de la tienda de la familia, igual que las kcal y los macros.

alter table families
  add column store text not null default 'plazavea' check (store in ('plazavea', 'wong', 'metro', 'tottus'));

alter table foods
  add column est_pen_per_kg numeric check (est_pen_per_kg > 0 and est_pen_per_kg < 10000);

alter table store_products
  add column prices jsonb not null default '{}';

create table food_store_prices (
  food_id uuid not null references foods on delete cascade,
  store text not null check (store in ('plazavea', 'wong', 'metro', 'tottus')),
  pen_per_kg numeric not null check (pen_per_kg > 0),
  products int not null default 1, -- productos con precio que entraron en la mediana
  primary key (food_id, store)
);

alter table food_store_prices enable row level security;
create policy "precios: todos ven" on food_store_prices for select using (auth.role() = 'authenticated');

-- security invoker: solo devuelve los alimentos que el usuario puede ver (catálogo y los de su familia).
create or replace function food_prices(p_store text)
returns table (food_id uuid, pen_per_kg numeric)
language sql stable
as $$
  select x.food_id, x.pen_per_kg from (
    select f.id as food_id, coalesce(
      (select s.pen_per_kg from food_store_prices s where s.food_id = f.id and s.store = p_store),
      (select percentile_cont(0.5) within group (order by s.pen_per_kg)::numeric from food_store_prices s where s.food_id = f.id),
      f.est_pen_per_kg
    ) as pen_per_kg
    from foods f
  ) x
  where x.pen_per_kg is not null
$$;
