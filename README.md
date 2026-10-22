# FocusOS

Aplicación web de productividad académica: decide qué estudiar, cuándo hacerlo y mide tu progreso.
Primer usuario: estudiante de Ingeniería de Software en INTEC. La arquitectura es multiusuario desde el inicio.

## Estado

| Fase | Contenido | Estado |
| --- | --- | --- |
| 1 | Estructura base y sistema visual | Hecho |
| 2 | Esquema de datos y migraciones (7 tablas) | Hecho |
| 3 | Autenticación y políticas RLS | Hecho |
| 4 | Materias y tareas (CRUD) | Hecho |
| 5 | Dashboard y calendario | Hecho: vistas semanal y mensual, eventos con repetición semanal |
| 6 | Sesiones de estudio y temporizador | Hecho: temporizador con pausas, registro manual, estimado frente a real |
| 7 | Calificaciones y progreso | Pendiente (tabla lista) |
| 8 | Motor de planificación determinista | Pendiente |
| 9 | Extensiones para Notion e IA | Pendiente (tabla `integrations` lista) |

## Stack

Next.js 16 (App Router, Cache Components, `proxy.ts`), React 19, TypeScript 6 estricto, Tailwind CSS 4,
shadcn/ui (Radix), Supabase (Postgres, Auth, RLS) con `@supabase/ssr`, Zod 4, React Hook Form,
Vitest 5 y Playwright.

Versiones fijadas a propósito:

- **TypeScript 6.0.3** y no 7: `typescript-eslint` solo admite TypeScript `<6.1`.
- **ESLint 9**: los plugins de `eslint-config-next` 16.4 aún no declaran soporte para ESLint 10.
- **@hookform/resolvers 5.9.2**: la 6.0.0 tiene un conflicto de dependencias opcionales (`effect`).

## Puesta en marcha

Requisitos: Node 20.9 o superior y un proyecto de Supabase.

```bash
npm install
```

1. Copia `.env.example` como `.env.local` y completa la URL y la clave publicable del proyecto.
2. Aplica las migraciones de `supabase/migrations/` en orden (SQL Editor, `supabase db push` o la MCP de Supabase).
3. Configura Auth en el panel de Supabase (ver "Configuración manual").

```bash
npm run dev
```

### Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 |
| `npm run build` | Build de producción (valida las reglas de Cache Components) |
| `npm run lint` | ESLint |
| `npm run typecheck` | Genera los tipos de rutas y ejecuta `tsc --noEmit` |
| `npm test` | Vitest: dominio, esquemas y RLS contra la base real |
| `npm run test:e2e` | Playwright: flujo completo de la primera entrega |
| `npm run check` | lint + typecheck + test |

## Arquitectura

```
src/
  app/                 Rutas. (auth) = login y registro; (app) = zona privada; auth/* = callbacks de correo
  components/          UI: ui/ (shadcn), layout/, tasks/, subjects/, dashboard/, settings/
  domain/              Lógica pura y probada: fechas por zona horaria, agrupación de tareas, progreso
  schemas/             Validación Zod compartida por formularios (cliente) y acciones (servidor)
  server/
    auth.ts            Única puerta a la sesión (getClaims) para la capa de datos
    services/          Acceso a datos con Supabase; traduce filas a tipos de dominio
    actions/           Server Actions: validan con Zod, verifican sesión y llaman a servicios
  lib/supabase/        Clientes de navegador, servidor y proxy; tipos generados
  lib/env.ts           Variables públicas validadas
  config/              Materias de demostración y paleta
  proxy.ts             Refresca la sesión y redirige de forma optimista
supabase/migrations/   Esquema, restricciones, índices, triggers y RLS
tests/integration/     Pruebas de RLS con dos usuarios reales
e2e/                   Pruebas Playwright
```

Reglas que sigue el código:

- Los componentes nunca llaman a Supabase ni a proveedores externos directamente. Pasan por Server Actions y servicios.
- Toda entrada se valida dos veces con el mismo esquema Zod: en el formulario y en el servidor.
- La autorización real está en la base (RLS). El proxy solo evita pintar páginas privadas sin sesión.
- La clave secreta de Supabase no se usa en esta fase y nunca debe llevar el prefijo `NEXT_PUBLIC_`.

### Datos y seguridad

- **Aislamiento:** RLS activo en las 7 tablas, con políticas por operación basadas en `(select auth.uid()) = user_id`. `anon` no tiene privilegios.
- **Claves foráneas compuestas** `(id, user_id)`: una tarea no puede apuntar a la materia de otro usuario aunque alguien envíe un id ajeno.
- **`integrations`:** el cliente solo puede escribir `provider` y `settings` (privilegios por columna). El estado de conexión y la última sincronización solo los escribe el servidor, así la interfaz no puede mostrar una sincronización que no ocurrió.
- **Sin duplicados al importar:** índices únicos `(user_id, external_source, external_id)` en `tasks` y `schedule_events`, y `(user_id, lower(name))` en `subjects`.
- **Coherencia:** un trigger mantiene `completed_at` según el estado de la tarea. Las sesiones de estudio admiten una sola activa por usuario.
- **Calificaciones:** nota, nota máxima y ponderación son opcionales. El promedio ponderado solo se calculará con todos los datos necesarios (fase 7).

### Zona horaria

La base guarda instantes (`timestamptz`, UTC). Cada perfil tiene una zona IANA (por defecto `America/Santo_Domingo`, detectada del navegador al registrarse). La conversión entre la hora local y UTC ocurre solo en `src/domain/datetime.ts`. Una entrega sin hora vence a las 23:59 locales.

### Calendario

`/calendar?view=week|month&date=YYYY-MM-DD` muestra clases, laboratorios, exámenes y bloques de estudio (`schedule_events`) junto con las entregas de tareas.

- **Semana:** en escritorio es una rejilla horaria (de 7:00 a 21:00, se amplía si algo cae fuera) con los eventos solapados lado a lado. En móvil pasa a ser una agenda por día. Los eventos de todo el día y las entregas van en la fila superior.
- **Mes:** las celdas muestran hasta 3 elementos (en móvil, marcas de color) y debajo va la agenda del día elegido.
- **Repetición:** solo semanal, con días de la semana y fecha de fin opcional (máximo un año). Se guarda como RRULE (`FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=YYYYMMDD`) junto con la zona horaria del evento, y se expande en hora local, así que una clase de las 10:00 sigue a las 10:00 aunque cambie el horario de verano. Una regla que FocusOS no entienda se muestra como evento único y no se reinterpreta.
- **Limitaciones actuales:** editar o borrar afecta a toda la serie (todavía no hay excepciones por ocurrencia) y los eventos con hora no pueden cruzar la medianoche.
- **Dashboard:** "Horario de hoy" lista los eventos del día, y los exámenes de los próximos 7 días aparecen junto a las entregas.

### Estudio (temporizador)

`/study` permite empezar una sesión sobre una tarea, sobre una materia en general o sin nada concreto. Se elige una duración objetivo (25, 50 o 90 min, otra o sin límite).

- **El tiempo lo mide la base de datos.** Empezar, pausar, reanudar, terminar y descartar son funciones de Postgres (`start_study_session`, `pause_study_session`, etc.) que usan `now()`. Son `SECURITY INVOKER`, así que RLS sigue aplicando. El navegador solo dibuja el reloj a partir de esas marcas de tiempo: la sesión sobrevive a recargas, al cierre de la pestaña y al uso de varias pestañas. Solo puede haber una sesión activa por usuario.
- **Barra global:** mientras hay una sesión en curso aparece en todas las páginas y el título de la pestaña muestra el reloj. Al llegar a cero sigue contando como tiempo extra.
- **Terminar:** se pueden bajar los minutos registrados (si olvidaste parar el temporizador), nunca subirlos por encima de lo medido; la base lo impide. Opcionalmente marca la tarea como completada.
- **Registro manual:** "Registrar tiempo" guarda lo estudiado sin temporizador. La base rechaza tiempo en el futuro y enfoque mayor que la duración.
- **Estimado frente a real:** la vista `task_focus_totals` (con `security_invoker`) suma el enfoque por tarea. Cada tarea muestra "35 min de 1 h 30 min". El resumen usa la mediana de real/estimado y solo afirma una tendencia con al menos 3 tareas completadas comparables.
- **Planificado frente a completado:** lo planificado son los bloques de estudio del calendario de la semana. El dashboard y `/study` comparan con el enfoque completado.
- Las sesiones descartadas se guardan como `cancelled` y no cuentan en ningún total.

### Materias de demostración

En **Materias** (estado vacío) está el botón "Añadir mis 8 materias de INTEC". Solo crea nombre, color y prioridad, con Cálculo Diferencial y los dos cursos de Programación en prioridad alta. No inventa códigos, créditos, horarios ni evaluaciones. La lista se edita en `src/config/demo-subjects.ts`. La operación no duplica materias: puedes pulsarlo varias veces y solo añade las que falten.

## Pruebas

- **Unitarias** (`src/**/*.test.ts`): fechas y zonas horarias (incluido el horario de verano), agrupación de tareas, progreso semanal, rejilla del calendario, repetición semanal, solapes, tiempo de enfoque con pausas, resúmenes de estudio, precisión de estimaciones y esquemas.
- **RLS** (`tests/integration/rls.test.ts`): con la clave publicable, como el navegador, comprueba que el usuario B no puede leer, modificar, borrar ni referenciar datos de A (materias, tareas y eventos), que `anon` no ve nada y que una serie recurrente exige una zona horaria válida.
- **E2E** (`e2e/first-delivery.spec.ts`): iniciar sesión, crear materia, crear tarea con fecha límite, verla en "Qué hacer hoy", completarla, recargar y confirmar que persiste. Después borra lo creado desde la interfaz.
- **Temporizador** (`tests/integration/sessions.test.ts`): funciones RPC contra la base real. Cubre una sola sesión activa, que otro usuario no pueda ver ni controlar la sesión, pausar y reanudar, no registrar más de lo medido, totales por tarea solo para su dueño, rechazo de tiempo futuro o inflado, y sin acceso para `anon`.
- **E2E de estudio** (`e2e/study.spec.ts`): sesión desde una tarea, pausa que sobrevive a recargar, terminar completando la tarea, tiempo real frente a estimado, registro manual, rechazo de tiempo futuro y descarte.
- **E2E del calendario** (`e2e/calendar.spec.ts`): crear una clase semanal, verla en la semana actual, en la siguiente (con sus dos repeticiones), en el mes y en el dashboard, editar la serie y borrarla con confirmación. También comprueba que la hora de fin sea posterior al inicio.
- **SQL** (`supabase/tests/rls_check.sql`): la misma verificación de RLS ejecutable en el SQL Editor.

Las pruebas de RLS y E2E necesitan dos usuarios confirmados del proyecto de desarrollo en `.env.test.local`. Sin ellos, se omiten.

## Configuración manual (depende de ti)

1. **URLs de Auth.** En Supabase, *Authentication → URL Configuration*: Site URL `http://localhost:3000` (y la de Vercel cuando despliegues). En *Redirect URLs* añade `http://localhost:3000/**` y `https://<tu-dominio>/**`.
2. **Correo.** El SMTP de prueba de Supabase solo envía a miembros de tu organización y tiene un límite bajo por hora. Para registrar otras cuentas, configura un SMTP propio en *Authentication → Emails → SMTP*.
3. **Plantilla de confirmación (opcional).** La plantilla por defecto funciona con `/auth/callback`, pero el enlace debe abrirse en el mismo navegador. Para que funcione en cualquier navegador, cambia el enlace a `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`.
4. **Vercel.** Define `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_SITE_URL` en el proyecto.

### Tipos de la base de datos

`src/lib/supabase/database.types.ts` se genera desde el esquema. Regénéralo tras cada migración con la CLI (`npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts`) o con la MCP de Supabase.
