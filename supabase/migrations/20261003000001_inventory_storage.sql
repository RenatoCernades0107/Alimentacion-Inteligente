-- Dónde se guarda cada alimento y qué tan madura está la fruta.
--
--   * storage:  pantry (ambiente / despensa), fridge (refrigerador) o freezer (congelador).
--   * ripeness: unripe (verde) o ripe (maduro); solo para fruta que madura después de cosechada
--               (palta, plátano, mango, tomate…). La vida útil estimada depende de ambos
--               (ver src/lib/shelf-life.ts, que es la fuente de verdad).
--
-- Son nulas en las filas que ya existían y en los alimentos de los que no se sabe nada (propios,
-- productos sin alimento genérico): la app usa entonces el lugar recomendado. Las políticas RLS de
-- inventory_items son por fila, así que no cambian.

alter table inventory_items
  add column storage text check (storage in ('pantry', 'fridge', 'freezer')),
  add column ripeness text check (ripeness in ('unripe', 'ripe'));
