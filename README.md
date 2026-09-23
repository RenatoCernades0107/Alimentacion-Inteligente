# Alimentación Inteligente

PWA para gestionar el inventario de comida de la familia y planificar sus comidas. Ver [specs.md](specs.md) y [TODO.md](TODO.md).

**Stack:** Next.js 16 (App Router) · shadcn/ui (Base UI) · Supabase (Postgres, Auth con Google) · next-intl (es/en) · Web Push.

## Estructura

| Ruta | Qué hay |
| --- | --- |
| `src/app/(app)/` | Pantallas: Hoy, Alimentos, Calendario, Recetas, Familia |
| `src/app/actions/` | Server actions (inventario, comidas, familia, push) |
| `src/app/api/off/` | Proxy a Open Food Facts (búsqueda y código de barras) |
| `src/app/api/cron/daily/` | Recordatorios diarios (vencimientos, días sin comidas, comidas sin completar) |
| `src/lib/` | Lógica: recurrencias, sugerencias, unidades, push |
| `supabase/migrations/` | Esquema, RLS (permisos padres/hijos) y funciones |
| `supabase/data/` | Catálogo de alimentos y recetas (Perú / USA) → `node scripts/build-seed.mjs` genera `supabase/seed.sql` |
| `messages/` | Textos en español e inglés |

## Levantar en local

Requiere Node 20+ y Docker Desktop (para Supabase local).

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

- **Productos de supermercados peruanos:** Plaza Vea y Wong (API pública de catálogo VTEX), Tottus (API de búsqueda de su web) y Tambo (páginas de categoría). `node scripts/scrape-pe-stores.mjs` busca cada alimento genérico en las cadenas, lo asocia a su alimento, une los productos repetidos (por código de barras o por marca + tamaño + nombre) y guarda en qué cadenas aparece. No guarda precios. Después: `node scripts/build-seed.mjs`.
- **Otros productos de marca y códigos de barras:** [Open Food Facts](https://world.openfoodfacts.org) (datos abiertos, ODbL).
- **Imágenes de alimentos genéricos:** [TheMealDB](https://www.themealdb.com).
- **Vida útil estimada:** basada en USDA FoodKeeper.
- **Recetas:** resumidas con palabras propias; cada una enlaza a su receta original ([hora.es](https://www.hora.es/platos-peruanos-caseros/), [The Anthony Kitchen](https://www.theanthonykitchen.com/american-dinner-recipes/), BBC Good Food, Tasty).
