# Alimentación Inteligente

PWA para gestionar el inventario de comida de la familia y planificar sus comidas. Ver [specs.md](specs.md) y [TODO.md](TODO.md).

**Stack:** Next.js 16 (App Router) · shadcn/ui (Base UI) · Supabase (Postgres, Auth con Google) · next-intl (es/en) · Web Push.

## Estructura

| Ruta | Qué hay |
| --- | --- |
| `src/app/(app)/` | Pantallas: Calendario (inicio, con los avisos del día), Alimentos, Chef IA, Recetas, Familia y `weight/[id]` (peso, meta y calorías de cada integrante) |
| `src/app/actions/` | Server actions (inventario, comidas, familia, push) |
| `src/app/api/off/` | Proxy a Open Food Facts (búsqueda y código de barras) |
| `src/app/api/cron/daily/` | Recordatorios diarios (vencimientos, días sin comidas, comidas sin completar) |
| `src/lib/` | Lógica: recurrencias, sugerencias, unidades, push, y el cálculo de peso y calorías (`body.ts`, `nutrition.ts`, `portions.ts`, `family-targets.ts`) |
| `src/lib/chef*.ts`, `src/components/chef/` | Chef IA: lógica del planificador (`chef.ts`), llamada a Gemini (`chef-ai.ts`) y pantallas |
| `src/app/api/recipes/[id]/image/` | Genera con Gemini la foto de una receta que no tiene (`src/lib/dish-image.ts`) |
| `src/app/api/meals/[id]/portions/` | Tabla de porciones de una comida (se pide al abrirla) |
| `supabase/tests/` | Pruebas de permisos (RLS + funciones) en SQL: `body_rls.sql`, `recipes_rls.sql` (se corren igual: sobre una base desechable con migraciones y seed aplicados) |
| `supabase/migrations/` | Esquema, RLS (permisos padres/hijos) y funciones |
| `supabase/data/` | Catálogo de alimentos, sus kcal (`nutrition.mjs`) y recetas (Perú / USA) → `node scripts/build-seed.mjs` genera `supabase/seed.sql` |
| `messages/` | Textos en español e inglés |

## Peso, metas y calorías

Cada integrante (con cuenta o **sin cuenta**, como un bebé) tiene una ficha en `/weight/[id]`: sexo, fecha de nacimiento, estatura, actividad, registro de pesos con gráfico de tendencia y una **meta de peso** con un control que muestra bajo peso ← recomendado → sobrepeso. De ahí salen sus kcal diarias y un plazo; cada comida muestra sus kcal y una **tabla de porciones** por integrante.

- **Adultos (≥ 18):** metabolismo basal Mifflin–St Jeor × nivel de actividad (1.2–1.9). El peso recomendado es el de IMC 22 (25.5 desde los 60). Ritmos suave / recomendado / rápido (0.25 / 0.5 / 1 % del peso por semana; subir: 0.25 / 0.5 / 0.75 %) con topes: déficit ≤ 25 %, ingesta ≥ 1200 (mujer) o 1500 (hombre) kcal y ≥ el metabolismo basal, superávit ≤ 500 kcal. El plazo se simula semana a semana recalculando el objetivo con el peso nuevo. Se usa el peso **tendencia** (promedio móvil exponencial), no el último pesaje suelto.
- **Menores (< 18):** nunca hay metas de bajar de peso; las kcal cubren el crecimiento (ecuaciones del IOM, DRI 2005) y las administran los padres. No se calculan porciones para menores de 12 meses.
- **Porciones:** las kcal del día se reparten por comida (3 comidas: 25 % desayuno, 40 % almuerzo, 35 % cena; con 4 o 5 se suman meriendas) y la porción de cada uno es su parte dividida entre las kcal de una porción de la receta, al ¼ más cercano (entre ¼ y 2). Si la familia necesita más o menos porciones que las que rinde la receta, se puede **ajustar** (`meals.portion_scale`): los ingredientes se muestran multiplicados y al completar la comida se descuenta del inventario lo ajustado.
- **Privacidad:** cada persona ve lo suyo; los padres ven y editan los datos de los menores de 18 años de la familia (con o sin cuenta). Un adulto no ve el peso de otro. Las tablas nuevas solo se leen (RLS) y **toda escritura pasa por funciones SQL** que validan permisos y rangos. La tabla de porciones solo recibe kcal y porciones derivadas, nunca pesos ni metas.
- **Límites:** las kcal de los alimentos son **aproximadas** (ver abajo); no hay modo embarazo/lactancia; solo unidades métricas (kg, cm). Es orientativo y no reemplaza a un nutricionista ni a un médico.

Pruebas: `npm test` (fórmulas, porciones, datos de nutrición, traducciones) y `supabase/tests/body_rls.sql` (permisos; ver el encabezado del archivo, corre sobre una base desechable con migraciones y seed aplicados).

## Chef IA

Pestaña central para armar el plan de comidas de hoy, mañana o la semana con Gemini:

1. **Objetivo y preferencias:** bajar grasa, ganar músculo, mantener, comer más sano o energía para entrenar (a los menores no se les ofrece bajar), con chips de "con lo que tengo", "lo que vence", rápido, peruano/americano y sin carne. La meta de kcal sale de `/weight`; los macros del día se reparten según el objetivo (`GOAL_SPLIT` en `src/lib/chef.ts`).
2. **Calibrar el gusto:** un mazo de ~12 platos con foto, kcal, macros e ingredientes en casa; se desliza → me gusta / ← paso (también con botones o flechas del teclado).
3. **Plan:** Gemini arma el plan con esos gustos y se ve por día con un anillo de kcal y barras de proteína / carbos / grasa frente a la meta, usando la porción de quien mira (igual que el calendario). Cada plato se puede cambiar deslizando alternativas o quitar, y se conversa con el Chef ("más proteína en las cenas") con respuestas rápidas.
4. **Al calendario:** los padres lo agregan como comidas planificadas; los hijos lo envían como propuestas (un solo aviso a los padres). Las franjas que ya tienen comida nunca se tocan.

La IA solo elige recetas del catálogo visible para la familia (por slug); kcal y macros los calcula la app, y todo lo que responde se valida (`sanitizeReply`). Si Gemini no está disponible, el Chef arma un plan base con reglas (`fallbackPlan`). El borrador se guarda en el dispositivo (`localStorage`).

**Macros:** proteína, carbohidratos y grasa por 100 g de cada alimento del catálogo (`macros` en `supabase/data/nutrition.mjs`, mismas fuentes que las kcal y también aproximados). Los de una receta se calculan de sus ingredientes al leerla (`macrosPerServing`), así que también funcionan para recetas propias.

**Fotos de platos:** una receta sin foto (por ejemplo, una receta propia) la pide al mostrarse; el servidor la genera una sola vez con el modelo de imágenes de Gemini, la guarda en el bucket público `dish-images` y la anota en la receta (con la service role).

## Levantar en local

Requiere Node 22.18+ (o 24; el generador del seed importa TypeScript) y Docker Desktop (para Supabase local).

```bash
npm install
node scripts/setup-env.mjs      # crea .env.local con llaves VAPID y CRON_SECRET
npx supabase start              # levanta Postgres/Auth y aplica migraciones + seed
npx supabase status -o env      # copia ANON_KEY y SERVICE_ROLE_KEY a .env.local
npm run dev
```

En desarrollo la pantalla de login muestra un **Dev login** (email + contraseña de prueba) para no depender de Google. Para probar un hijo: crea la familia con `padre@test.dev`, copia el link de hijos desde "Familia" y ábrelo en otra ventana privada entrando como `hijo@test.dev`.

### Login con Google

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crea un *OAuth client ID* (tipo Web).
2. *Authorized redirect URI*: `http://127.0.0.1:54321/auth/v1/callback` (local) o `https://<proyecto>.supabase.co/auth/v1/callback` (producción).
3. Local: pon el client ID y secret en `supabase/.env` y reinicia Supabase. Producción: Supabase › Authentication › Providers › Google.

## Probar en iPhone

Las notificaciones push en iPhone requieren **iOS 16.4+**, **HTTPS** y la app **agregada a la pantalla de inicio**. Lo más simple es desplegar (abajo) y abrir la URL en Safari → Compartir → *Agregar a pantalla de inicio*. La cámara (código de barras) también requiere HTTPS.

## Desplegar (Vercel + Supabase)

1. Crea un proyecto en Supabase y aplica el esquema: `npx supabase link --project-ref <ref>` y `npx supabase db push --include-seed`.
2. Configura Google (arriba) y en Authentication › URL Configuration agrega `https://<tu-app>.vercel.app/**` a *Redirect URLs*. **Desactiva el registro por email** (solo se usa Google).
3. Importa el repo en Vercel con las variables de `.env.example`. `vercel.json` programa el cron diario (8:00 hora de Lima).

## Fuentes de datos

- **Productos de supermercados peruanos:** Plaza Vea y Wong (API pública de catálogo VTEX), Tottus (API de búsqueda de su web) y Tambo (páginas de categoría). `node scripts/scrape-pe-stores.mjs` recorre completas las categorías de comida de cada cadena (frutas y verduras, abarrotes, carnes, lácteos, panadería, desayunos, congelados, snacks), asocia cada producto a su alimento genérico, une los productos repetidos (por código de barras o por marca + tamaño + nombre) y guarda en qué cadenas aparece. No guarda precios. Con `--cached --unmatched` lista los productos que aún no tienen alimento, para ampliar `supabase/data/foods.mjs`. Después: `node scripts/build-seed.mjs`.
- **Otros productos de marca y códigos de barras:** [Open Food Facts](https://world.openfoodfacts.org) (datos abiertos, ODbL).
- **Imágenes de alimentos genéricos:** [TheMealDB](https://www.themealdb.com).
- **Vida útil estimada:** por tipo de alimento y lugar de guardado (ambiente, refrigerador, congelador), basada en la guía Food Keeper del USDA y contrastada con extensiones universitarias (Virginia Cooperative Extension, UC Davis Postharvest); las fuentes están en el encabezado de `src/lib/shelf-life.ts`. Tubérculos andinos, aguaymanto, frutas exóticas y quesos frescos peruanos son estimaciones prudentes, y las fechas son orientativas: ante la duda, huele y mira antes de comer.
- **Calorías de los alimentos:** valores aproximados por 100 g (crudo o seco) en `supabase/data/nutrition.mjs`, escritos a mano a partir de [USDA FoodData Central](https://fdc.nal.usda.gov/) y las [Tablas Peruanas de Composición de Alimentos](https://repositorio.ins.gob.pe/items/7dd870ba-42db-449c-bef2-5d67d881383f) (INS/CENAN). Con una llave gratuita de [api.data.gov](https://api.data.gov/signup/), `USDA_API_KEY=… node scripts/verify-nutrition.mjs` los contrasta con USDA (solo es una ayuda: revisa a mano lo marcado). Las recetas cuentan el aceite de freír, el harina y la leche de apanados como lo que se consume, no lo que sobra en el sartén.
- **Recetas:** resumidas con palabras propias; cada una enlaza a su receta original ([hora.es](https://www.hora.es/platos-peruanos-caseros/), [The Anthony Kitchen](https://www.theanthonykitchen.com/american-dinner-recipes/), BBC Good Food, Tasty).
