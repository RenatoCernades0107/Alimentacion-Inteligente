# Alimentacion Inteligente

App PWA (inicialmente para celular) optimizada para iPhone, cuya misión es gestionar el inventario de comida de la familia.

## Requerimientos funcionales

1. **Alimentos (inventario).** El usuario puede ver, editar, eliminar y crear sus alimentos.
   - Se pueden crear alimentos propios que no existan en el catálogo (ej. "salsa de tamarindo con miel picante").
   - Cada alimento tiene cantidad, unidad y fecha de vencimiento.
   - Fecha de vencimiento: si es un producto empaquetado, el usuario ingresa la fecha impresa; si es genérico, la app la estima según el tipo de alimento.
   - La cantidad se puede editar a mano, pero se descuenta automáticamente cuando un padre marca una comida como completada.

2. **Comidas sugeridas.** El usuario puede ver y seleccionar las comidas sugeridas por la app.
   - Las sugerencias usan reglas simples (sin IA por ahora).
   - El usuario elige entre dos modos: "solo con lo que tengo" o "cualquier comida". En ambos se priorizan las comidas que más ingredientes comparten con el inventario y las que usan alimentos próximos a vencer.
   - El usuario puede filtrar las comidas por país de origen (por ahora **Perú** y **USA**). Cualquier usuario puede ver comidas de cualquier país.

3. **Calendario de comidas.** El usuario verá su calendario de comidas y podrá agregar comidas de forma única o recurrente.
   - La familia configura cuántas comidas hace al día (3, 4 o 5). Con 3: desayuno, almuerzo y cena; con 4 y 5 se agregan meriendas.
   - Recurrencias: diaria, días de semana (lun–vie), semanal, cada dos semanas, mensual.
   - Al editar o eliminar una comida recurrente, la app pregunta si aplicar el cambio solo a esa comida o a toda la recurrencia.
   - Un padre marca la comida como completada, lo que descuenta sus ingredientes del inventario. Si no la marca, la app le envía un recordatorio.

4. **Propuestas de los hijos.** Los hijos pueden proponer comidas. Se envía una notificación a los padres, que deben aceptarla o rechazarla. Mientras tanto, en el calendario aparece como "propuesta".

5. **Invitaciones.** El usuario al ingresar a la app verá un link que puede compartir con los miembros de su familia (un link para padres, otro para hijos) para que se unan.
   - Cada link es de un solo uso: al usarse se genera uno nuevo automáticamente.
   - Los links vencen a los 7 días como máximo.

6. **Buscador de alimentos.** El usuario agrega alimentos buscando su nombre con un buscador inteligente (tipo Google) que muestra imágenes de los productos para que sea fácil encontrar exactamente el que compró. Siempre se ofrece además una opción de alimento genérico.
   - También se puede agregar un alimento escaneando su código de barras.

7. **Recordatorios (notificaciones push).** Los reciben todos los miembros de la familia.
   - Un alimento vence en 7 días y en 1 día.
   - No hay comidas planificadas para ese día → sugerencia de comida.
   - Comida pasada no marcada como completada (solo padres).
   - Nueva propuesta de un hijo (solo padres).

## Requerimientos no funcionales

1. Hay dos tipos de usuario: padres e hijos. Los hijos solo tienen permiso de lectura, excepto para proponer comidas.
2. La app usa Next.js y está optimizada para iPhone. Para recibir notificaciones la PWA debe estar agregada a la pantalla de inicio (iOS 16.4+); la app guía al usuario para hacerlo.
3. La app usa componentes de shadcn/ui para mantener la consistencia de sus componentes.
4. La app está en español e inglés; cada usuario elige su idioma.
5. Backend: Supabase (Postgres, Auth, Storage). Login con Google.
6. La app requiere conexión a internet (no hay modo offline).
