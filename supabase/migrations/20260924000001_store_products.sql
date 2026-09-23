-- Productos de supermercados (Perú: Plaza Vea, Wong, Tottus, Tambo).
-- Se cargan desde supabase/data/pe_store_products.json (scripts/scrape-pe-stores.mjs).

create table store_products (
  id uuid primary key default gen_random_uuid(),
  country text not null default 'PE',
  name text not null,
  brand text,
  barcodes text[] not null default '{}',
  quantity numeric,
  unit text check (unit in ('g', 'kg', 'ml', 'l')),
  pack int not null default 1,
  image_url text,
  food_id uuid references foods on delete set null, -- alimento genérico al que corresponde
  stores text[] not null default '{}',               -- cadenas donde se encontró
  store_urls jsonb not null default '{}'
);

create index store_products_search_idx on store_products
  using gin (food_search_text(name, coalesce(brand, ''), '{}'::text[]) gin_trgm_ops);
create index store_products_barcodes_idx on store_products using gin (barcodes);

alter table store_products enable row level security;
create policy "productos: todos ven" on store_products for select using (auth.role() = 'authenticated');

-- Búsqueda: todas las palabras deben aparecer (tolera tildes), o parecido difuso.
-- Primero los que están en más cadenas.
create or replace function search_store_products(p_query text, p_limit int default 15)
returns setof store_products
language sql stable
as $$
  with q as (select trim(food_search_text(trim(p_query), '', '{}'::text[])) as t),
  words as (select array_remove(string_to_array(q.t, ' '), '') as w from q)
  select p.* from store_products p, q, words
  where (
      not exists (
        select 1 from unnest(words.w) x
        where food_search_text(p.name, coalesce(p.brand, ''), '{}'::text[]) not like '%' || x || '%'
      )
      or word_similarity(q.t, food_search_text(p.name, coalesce(p.brand, ''), '{}'::text[])) > 0.55
    )
  order by
    (not exists (
      select 1 from unnest(words.w) x
      where food_search_text(p.name, coalesce(p.brand, ''), '{}'::text[]) not like '%' || x || '%'
    )) desc,
    cardinality(p.stores) desc,
    (food_search_text(p.name, '', '{}'::text[]) like words.w[1] || '%') desc,
    word_similarity(q.t, food_search_text(p.name, coalesce(p.brand, ''), '{}'::text[])) desc,
    length(p.name)
  limit p_limit
$$;
