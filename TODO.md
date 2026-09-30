# TODO — Prototipo Alimentación Inteligente

Ver [specs.md](specs.md) para los requerimientos y [README.md](README.md) para levantar el proyecto.

## Fuentes de datos (investigado)
- **Productos de supermercados peruanos:** Plaza Vea, Wong, Tottus y Tambo, unidos entre cadenas y con las tiendas donde se venden.
- **Productos empaquetados + imágenes + código de barras (resto):** Open Food Facts (gratis, sin API key).
- **Insumos genéricos con imagen:** catálogo propio de 284 alimentos (es/en) con imágenes de TheMealDB y emoji de respaldo.
- **Vida útil estimada de genéricos:** días según USDA FoodKeeper.
- **Recetas:** 57 recetas propias (28 Perú / 29 USA) con ingredientes mapeados al catálogo y link a la receta original.

## 0. Setup
- [x] Proyecto Next.js 16 + git
- [x] shadcn/ui y componentes base
- [x] PWA: manifest, íconos, meta tags iOS, safe areas, service worker (solo push)
- [x] i18n es/en (idioma elegido por cada usuario)
- [x] Layout móvil con navegación inferior

## 1. Supabase
- [x] Migraciones + RLS por familia y rol (validado con pruebas en Postgres embebido)
- [x] Login con Google (+ dev login solo en desarrollo)
- [x] Onboarding: crear familia, comidas por día, idioma

## 2. Familia e invitaciones
- [x] Links de un solo uso por rol, vencen a los 7 días, se regeneran solos
- [x] Aceptar invitación · compartir con Web Share · lista y remoción de miembros

## 3. Inventario
- [x] Buscador con imágenes (genéricos + productos de marca + propios), tolerante a tildes y errores
- [x] Escaneo de código de barras
- [x] Crear alimento propio
- [x] Vencimiento estimado para genéricos / manual para empaquetados
- [x] Lista por vencimiento · editar / eliminar

## 4. Recetas y sugerencias
- [x] Seed de recetas Perú / USA
- [x] Filtros por país y tipo de comida · modos "con lo que tengo" / "todas"
- [x] Detalle de receta con ingredientes que tienes/faltan → agregar al calendario

## 5. Calendario
- [x] Vista semanal con franjas según comidas por día
- [x] Recurrencias (diaria, lun–vie, semanal, quincenal, mensual)
- [x] Editar/eliminar preguntando "solo esta" o "toda la recurrencia"
- [x] Propuestas de hijos → padres aceptan/rechazan
- [x] Completar comida → descuenta ingredientes

## 6. Notificaciones push
- [x] Web Push (VAPID) + guía para instalar en iPhone
- [x] Cron diario: vencimientos (7 y 1 día), día sin comidas, comidas sin completar
- [x] Push a padres al recibir una propuesta

## 7. Peso, metas y calorías
- [x] Datos por persona (sexo, nacimiento, estatura, actividad) y registro de pesos con gráfico de tendencia
- [x] Slider de meta (bajo peso ← recomendado → sobrepeso), ritmo, kcal diarias y plazo
- [x] Menores: kcal de crecimiento (IOM), sin metas de bajar; integrantes sin cuenta administrados por los padres
- [x] Privacidad por RLS: escritura solo por RPC, padres ven a menores, un adulto no ve a otro (`supabase/tests/body_rls.sql`)
- [x] kcal aproximadas en los 284 alimentos y las 57 recetas (`supabase/data/nutrition.mjs`)
- [x] Chip de kcal en comidas y recetas; tabla de porciones por integrante; ajustar porciones y descontar lo ajustado
- [x] kcal manual en comidas sin receta y en alimentos propios
- [x] Recordatorio para pesarse (cron diario)
- [ ] Contrastar `nutrition.mjs` con USDA (`node scripts/verify-nutrition.mjs`, requiere una API key gratuita de api.data.gov)
- [ ] Clasificación del IMC de menores de 5–19 años con las tablas de la OMS (hoy solo se muestra el IMC y un aviso pediátrico)
- [ ] Confirmar los cortes de IMC de adultos mayores con la tabla del INS y los coeficientes del IOM con la publicación original
- [ ] Modo embarazo / lactancia, resumen de kcal del día y "quién come" en cada comida (fuera de la primera versión)

## 8. Pendiente
- [ ] Levantar Supabase (local o en la nube) y probar el flujo completo de punta a punta
- [ ] Configurar credenciales de Google OAuth
- [ ] Deploy (Vercel + Supabase) y probar en iPhone real
- [ ] Fotos para las recetas (hoy se muestran con emoji)
