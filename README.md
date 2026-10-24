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
| 7 | Calificaciones y progreso | Hecho: evaluaciones, promedio ponderado con datos completos y nota necesaria |
| 8 | Motor de planificación determinista | Hecho: orden explicado, riesgo, plan del día y horario de estudio |
| 9 | Extensiones para Notion e IA | Hecho: interfaz común de IA (Anthropic y OpenAI), dividir tareas en pasos, importación desde Notion sin duplicados. Opcionales: requieren tus claves |

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
| `npm run test:e2e` | Playwright: flujos completos en el navegador (el asistente usa el proveedor de prueba) |
| `npm run check` | lint + typecheck + test |

## Arquitectura

```
src/
  app/                 Rutas. (auth) = login y registro; (app) = zona privada; auth/* = callbacks de correo
  components/          UI: ui/ (shadcn), layout/, tasks/, subjects/, dashboard/, settings/, assistant/, integrations/
  domain/              Lógica pura y probada: fechas por zona horaria, agrupación de tareas, progreso
  schemas/             Validación Zod compartida por formularios (cliente) y acciones (servidor)
  server/
    auth.ts            Única puerta a la sesión (getClaims) para la capa de datos
    services/          Acceso a datos con Supabase; traduce filas a tipos de dominio
    actions/           Server Actions: validan con Zod, verifican sesión y llaman a servicios
  lib/supabase/        Clientes de navegador, servidor, proxy y admin (solo servidor); tipos generados
  lib/env.ts           Variables públicas validadas
  lib/server-env.ts    Variables solo del servidor (claves de IA, Notion, clave secreta), todas opcionales
  integrations/        Adaptadores externos: ai/ (interfaz común, Anthropic, OpenAI, prueba) y notion/ (OAuth, API, mapeo)
  planner/             Motor de planificación: disponibilidad, puntuación y plan del día (puro, sin E/S)
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
- La clave secreta de Supabase solo la usa `src/lib/supabase/admin.ts`, en el servidor, para el estado de las integraciones y los tokens cifrados. Nunca lleva el prefijo `NEXT_PUBLIC_`.
- Las llamadas a proveedores de IA viven en `src/integrations/ai/`. Los componentes solo llaman a Server Actions y nunca reciben claves.

### Datos y seguridad

- **Aislamiento:** RLS activo en las 7 tablas, con políticas por operación basadas en `(select auth.uid()) = user_id`. `anon` no tiene privilegios.
- **Claves foráneas compuestas** `(id, user_id)`: una tarea no puede apuntar a la materia de otro usuario aunque alguien envíe un id ajeno.
- **`integrations`:** el cliente solo puede escribir `provider` y `settings` (privilegios por columna). El estado de conexión y la última sincronización solo los escribe el servidor, así la interfaz no puede mostrar una sincronización que no ocurrió.
- **Sin duplicados al importar:** restricciones únicas `(user_id, external_source, external_id)` en `tasks` y `schedule_events` (completas, para que sirvan de árbitro a `ON CONFLICT`), y `(user_id, lower(name))` en `subjects`.
- **Tokens de integraciones:** `integration_credentials` tiene RLS activo y ningún privilegio para `anon` ni `authenticated`: solo el servidor con la clave secreta la lee. Los tokens se cifran antes con AES-256-GCM (`INTEGRATIONS_ENCRYPTION_KEY`), ligados al usuario y al proveedor. El asesor de Supabase avisa (nivel INFO) de que la tabla no tiene políticas: es intencional.
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

### Calificaciones

Cada materia tiene su página (`/subjects/[id]`) con sus evaluaciones y sus tareas pendientes. `/grades` resume todas las materias.

- **Evaluación:** nombre, tipo, nota obtenida, nota máxima, ponderación (% de la nota final) y fecha. Todo lo numérico es opcional: se completa cuando se conoce. Los decimales aceptan coma o punto, y se muestran con punto (es-DO).
- **Promedio ponderado:** solo se calcula si **cada** evaluación con nota tiene también nota máxima y ponderación. Si falta algo, la app dice qué evaluación y qué dato faltan, y no muestra ningún número. Si las ponderaciones suman más del 100 %, tampoco calcula.
- **Nota actual** = suma de (nota / máxima × ponderación) ÷ ponderación evaluada × 100. **Puntos asegurados** = lo que ya cuenta de la nota final sobre 100.
- **Nota necesaria:** escribes la nota final que buscas y calcula el promedio que necesitas en el porcentaje que queda por evaluar. Indica también si ya está asegurada o si no alcanza. No se guarda ni se asume una nota mínima de aprobación.
- **Puntos extra:** una nota mayor que la máxima se acepta y se muestra tal cual.
- **Dashboard:** el estado de cada materia muestra su nota actual. Las evaluaciones sin nota con fecha en los próximos 7 días aparecen en "Próximas entregas y exámenes", salvo que ese día ya haya un examen de la misma materia en el calendario.

### Plan (motor de planificación)

`src/planner/` es una función pura: recibe tareas, prioridades de materias, eventos del calendario, horario de estudio, zona horaria y la hora actual, y devuelve el orden recomendado, los huecos libres y el plan del día. No lee el reloj ni usa azar. Con las mismas entradas el resultado es idéntico, sin importar el orden en que lleguen las tareas, y los empates se resuelven por fecha límite, prioridad e id. Las pruebas lo verifican.

**Puntuación** (0 a 1) = 0.45 × urgencia + 0.25 × prioridad + 0.10 × materia + 0.10 × dificultad + 0.10 × encaje.

| Factor | Valor |
| --- | --- |
| Urgencia | 1 si ya venció; 1 / (1 + días / 2) si no (0.5 a dos días, ~0.22 a una semana); 0.1 sin fecha. Sube a 0.95 o más si la tarea está **en riesgo**: su esfuerzo pendiente supera el tiempo libre antes de la entrega (dentro de 14 días). |
| Prioridad | baja 0.25, media 0.5, alta 0.75, urgente 1 |
| Materia | la prioridad de la materia con la misma escala (media si no tiene materia) |
| Dificultad | (dificultad − 1) / 4; sin dato = 0.5 (neutra) |
| Encaje | próximo hueco libre ÷ siguiente bloque de la tarea, con tope de 1 |

- **Esfuerzo pendiente** = estimación − tiempo ya estudiado (fase 6). Sin estimación, o si ya se superó, se propone un bloque de 30 min y se indica así.
- **Tiempo libre:** el horario de estudio (Ajustes, por defecto de 08:00 a 22:00) menos los eventos con hora del calendario y menos lo que ya pasó. Los bloques de estudio y los eventos de todo el día no restan. No se ofrecen huecos de menos de 15 min.
- **Plan del día:** recorre las tareas en orden y las coloca en los huecos de hoy en bloques de hasta 90 min, con 10 min de descanso, hasta cubrir el esfuerzo pendiente. Avisa si algo que vence hoy no cabe.
- **Dónde se ve:** en `/plan`, con el orden, los motivos, la tabla de cada factor, el plan y los próximos huecos. En el dashboard, la tarjeta "Siguiente paso" (con botón para empezar una sesión de la duración propuesta) y el plan de hoy.

### Integraciones (opcionales)

Están en **Ajustes → Integraciones**, que muestra el estado real de cada una y, si falta configuración, qué variables del servidor faltan (solo los nombres). Sin ellas, FocusOS funciona igual.

**Asistente de IA.** `src/integrations/ai/types.ts` define una interfaz común (`AiProvider.generate`) con errores tipados. Hay tres adaptadores:

- **Anthropic** (`anthropic.ts`, SDK oficial `@anthropic-ai/sdk`). Modelo por defecto `claude-opus-5-5` (cámbialo con `ANTHROPIC_MODEL`). Usa salida estructurada con esquema JSON y el respaldo del servidor (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`): si el modelo declina, la API reintenta con el modelo recomendado. Revisa `stop_reason` (negativa o respuesta cortada) antes de leer el texto.
- **OpenAI** (`openai.ts`, SDK oficial `openai`, Responses API). Esquema JSON estricto y `store: false`. `OPENAI_MODEL` es obligatorio: no se asume ningún modelo.
- **Prueba** (`fake.ts`, `AI_PROVIDER=fake`). Respuestas fijas, sin red ni coste, para las E2E. Bloqueado en producción y rotulado "sin IA real".

Con una sola clave se usa ese proveedor. Con las dos, `AI_PROVIDER` decide.

**Dividir en pasos** (menú de cada tarea). El diálogo dice qué datos se enviarán y a qué proveedor, y no envía nada hasta que pulsas "Generar sugerencia". Solo manda título, tipo, materia, fecha, estimación, dificultad y descripción (recortada). La respuesta se valida con Zod: se recortan textos y se acotan minutos, y lo que no tenga el formato esperado se rechaza con un mensaje claro. Nada se guarda hasta que pulsas "Añadir a la descripción", que añade una lista de verificación al final de las notas y, si la tarea no tenía estimación, puede usar la suma.

**Notion (importar tareas).** Es una conexión OAuth pública: cada usuario conecta su propio espacio y elige qué bases comparte.

- **Conectar:** `/api/integrations/notion/connect` → Notion → `/callback`. La cookie `state` (httpOnly, 10 min, ligada al usuario) protege contra CSRF. Solo se muestra "Conectado" si el token quedó guardado.
- **Configurar:** se elige la base (data source) y qué propiedad es la fecha límite, si está hecha (casilla, o estado/selección con los valores que cuentan como completada) y la estimación en minutos, más una materia para las tareas nuevas. Se valida contra el esquema real de la base.
- **Importar:** hasta 500 páginas por vez (avisa si había más). El título de la página es el de la tarea. Una fecha sin hora vence a las 23:59 locales.
- **Reglas** (`src/domain/task-import.ts`, función pura y probada): importar dos veces no duplica, porque la tarea se identifica por `(notion, id de la página)` y la base lo garantiza además. Actualiza título, fecha y estimación si cambiaron. Un campo vacío en Notion no borra nada en FocusOS. Marca como completada lo que se hizo en Notion, pero nunca reabre ni toca tareas canceladas. Nunca borra tareas ni escribe en Notion.
- **Honestidad:** el resultado dice cuántas se crearon, actualizaron, quedaron igual, no se pudieron guardar y no se importaron (con el motivo). La última sincronización solo se marca si se guardó todo lo leído. Si no, la integración queda "Con error" y lo explica.
- **Tokens:** si caducan, se renuevan una vez con el refresh token (Notion entrega uno nuevo y se guarda). Si no se puede, pide reconectar. "Desconectar" (con confirmación) revoca el token en Notion, lo borra y deja intactas las tareas importadas.

### Materias de demostración

En **Materias** (estado vacío) está el botón "Añadir mis 8 materias de INTEC". Solo crea nombre, color y prioridad, con Cálculo Diferencial y los dos cursos de Programación en prioridad alta. No inventa códigos, créditos, horarios ni evaluaciones. La lista se edita en `src/config/demo-subjects.ts`. La operación no duplica materias: puedes pulsarlo varias veces y solo añade las que falten.

## Pruebas

- **Unitarias** (`src/**/*.test.ts`): fechas y zonas horarias (incluido el horario de verano), agrupación de tareas, progreso semanal, rejilla del calendario, repetición semanal, solapes, tiempo de enfoque con pausas, resúmenes de estudio, precisión de estimaciones, promedio ponderado, nota necesaria, motor de planificación (huecos libres, factores, riesgo, determinismo y reparto del día) y esquemas.
- **RLS** (`tests/integration/rls.test.ts`): con la clave publicable, como el navegador, comprueba que el usuario B no puede leer, modificar, borrar ni referenciar datos de A (materias, tareas, eventos y calificaciones), que la base rechaza ponderaciones y notas máximas fuera de rango, que `anon` no ve nada y que una serie recurrente exige una zona horaria válida.
- **E2E** (`e2e/first-delivery.spec.ts`): iniciar sesión, crear materia, crear tarea con fecha límite, verla en "Qué hacer hoy", completarla, recargar y confirmar que persiste. Después borra lo creado desde la interfaz.
- **Temporizador** (`tests/integration/sessions.test.ts`): funciones RPC contra la base real. Cubre una sola sesión activa, que otro usuario no pueda ver ni controlar la sesión, pausar y reanudar, no registrar más de lo medido, totales por tarea solo para su dueño, rechazo de tiempo futuro o inflado, y sin acceso para `anon`.
- **E2E de estudio** (`e2e/study.spec.ts`): sesión desde una tarea, pausa que sobrevive a recargar, terminar completando la tarea, tiempo real frente a estimado, registro manual, rechazo de tiempo futuro y descarte.
- **E2E del planificador** (`e2e/planner.spec.ts`): fija el horario de estudio, crea dos tareas y comprueba el orden, los motivos, la tabla de puntuación, el primer bloque del plan, empezar desde la recomendación y la validación del horario.
- **E2E de calificaciones** (`e2e/grades.spec.ts`): crea evaluaciones y comprueba el promedio (86.9), la nota necesaria (75.4 para un 80), que no hay promedio con datos incompletos, la recuperación al completarlos, el borrado con confirmación y la página de no encontrado para una materia ajena.
- **E2E del calendario** (`e2e/calendar.spec.ts`): crear una clase semanal, verla en la semana actual, en la siguiente (con sus dos repeticiones), en el mes y en el dashboard, editar la serie y borrarla con confirmación. También comprueba que la hora de fin sea posterior al inicio.
- **Integraciones (unitarias):** adaptadores de Anthropic y OpenAI con sus SDK reales y un `fetch` falso (petición, respaldo del servidor, negativas, respuestas cortadas, errores HTTP), registro de proveedores, variables del servidor, cifrado (contexto, clave, manipulación), petición y validación de "Dividir en pasos", reglas de importación, mapeo de páginas de Notion y cliente de Notion (paginación, esquema, errores).
- **Importaciones** (`tests/integration/imports.test.ts`): contra la base real. Importar dos veces no duplica, actualiza lo que cambió, la restricción única rechaza duplicados directos, otro usuario puede usar el mismo id externo sin ver los del primero, los tokens no se pueden leer ni escribir con la clave publicable y el usuario no puede marcarse "conectado".
- **E2E de integraciones** (`e2e/integrations.spec.ts`): Ajustes muestra el estado sin exponer secretos, y el asistente (proveedor de prueba) divide una tarea en pasos que solo se guardan al confirmar y persisten tras recargar.
- **SQL** (`supabase/tests/rls_check.sql`): la misma verificación de RLS ejecutable en el SQL Editor.

Las pruebas de RLS y E2E necesitan dos usuarios confirmados del proyecto de desarrollo en `.env.test.local`. Sin ellos, se omiten.

## Configuración manual (depende de ti)

1. **URLs de Auth.** En Supabase, *Authentication → URL Configuration*: Site URL `http://localhost:3000` (y la de Vercel cuando despliegues). En *Redirect URLs* añade `http://localhost:3000/**` y `https://<tu-dominio>/**`.
2. **Correo.** El SMTP de prueba de Supabase solo envía a miembros de tu organización y tiene un límite bajo por hora. Para registrar otras cuentas, configura un SMTP propio en *Authentication → Emails → SMTP*.
3. **Plantilla de confirmación (opcional).** La plantilla por defecto funciona con `/auth/callback`, pero el enlace debe abrirse en el mismo navegador. Para que funcione en cualquier navegador, cambia el enlace a `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`.
4. **OneDrive.** Si el proyecto está dentro de OneDrive, la sincronización puede convertir `.next/` en marcadores de posición de la nube y el build falla con `EPERM: operation not permitted, unlink`. Borra `.next/` y vuelve a compilar, o mejor, excluye la carpeta del proyecto de OneDrive (también evita sincronizar `node_modules`).
5. **Vercel.** Ver [Despliegue en Vercel](#despliegue-en-vercel-producción).
6. **Asistente de IA (opcional).** Añade `ANTHROPIC_API_KEY` (y, si quieres, `ANTHROPIC_MODEL`) o `OPENAI_API_KEY` y `OPENAI_MODEL` en `.env.local` o en Vercel. Cada sugerencia cuesta según la tarifa de tu proveedor. No hay límite por usuario: antes de abrir la app a más personas, conviene añadir uno.
7. **Notion (opcional).**
   1. En https://www.notion.so/profile/integrations crea una integración **pública**, con permiso de solo lectura de contenido, y como Redirect URI `<NEXT_PUBLIC_SITE_URL>/api/integrations/notion/callback` (por ejemplo `http://localhost:3000/api/integrations/notion/callback`).
   2. Copia el OAuth client ID y el secret en `NOTION_CLIENT_ID` y `NOTION_CLIENT_SECRET`.
   3. Añade `SUPABASE_SECRET_KEY` (*Project Settings → API Keys → Secret key*).
   4. Genera `INTEGRATIONS_ENCRYPTION_KEY` con `openssl rand -base64 32`. Si la cambias, los usuarios tendrán que reconectar.
   5. Reinicia el servidor y conecta desde Ajustes.

## Despliegue en Vercel (producción)

Producción: **https://focusos-frit.vercel.app**. Vercel compila desde GitHub y publica cada push a `main`. Las URLs de cada deploy (`focusos-frit-<hash>-….vercel.app`) quedan protegidas con el inicio de sesión de Vercel (*Deployment Protection*). La pública es la de producción.

1. **Variables** (*Settings → Environment Variables*): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_SITE_URL=https://focusos-frit.vercel.app`. Las `NEXT_PUBLIC_*` se incrustan en el build: si cambias una, vuelve a desplegar (*Deployments → ⋯ → Redeploy*).
2. **Supabase Auth** (*Authentication → URL Configuration*): Site URL `https://focusos-frit.vercel.app` y, en *Redirect URLs*, `https://focusos-frit.vercel.app/**` (deja también `http://localhost:3000/**` para desarrollo).
3. **Integraciones (opcionales):** las claves de IA y de Notion, `SUPABASE_SECRET_KEY` e `INTEGRATIONS_ENCRYPTION_KEY` van como variables sin `NEXT_PUBLIC_`. Si usas Notion, su Redirect URI es `https://focusos-frit.vercel.app/api/integrations/notion/callback`.

## Despliegue en Cloudflare (alternativa)

No es el despliegue activo. Desde este equipo no se pudo publicar: la subida estaba en 8 KB/s y el panel no permitió conectar el repositorio. La configuración queda lista y probada en local.

FocusOS se despliega en Cloudflare Workers con [OpenNext](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`). La configuración está en `wrangler.jsonc` y `open-next.config.ts`.

| Script | Qué hace |
| --- | --- |
| `npm run cf:build` | Build de Next.js y empaquetado para Workers (`.open-next/`) |
| `npm run cf:preview` | Lo anterior y lo sirve en local con workerd, el runtime de Cloudflare (http://localhost:8787) |
| `npm run cf:deploy` | Lo anterior y lo publica en tu cuenta |

### Desde GitHub (recomendado)

Cloudflare compila en Linux y publica cada push a `main` (Workers Builds). No sube nada pesado desde tu equipo.

1. En el panel de Cloudflare: *Workers & Pages → Create application → Import a repository*. Conecta GitHub y elige `focusos`.
2. **Nombre del proyecto:** `focusos`. Debe coincidir con `name` en `wrangler.jsonc`.
3. **Build command:** `npx opennextjs-cloudflare build`. **Deploy command:** `npx opennextjs-cloudflare deploy`. Raíz: `/`.
4. **Build variables** (se incrustan en el build, así que van aquí y no en las variables de ejecución): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_SITE_URL=https://focusos.<tu-subdominio>.workers.dev`. Tu subdominio aparece en *Workers & Pages* (panel derecho, *Subdomain*).
5. La versión de Node la fija `.node-version` (22).

### Desde tu equipo

1. `npx wrangler login`.
2. Crea `.env.production.local` (no se sube al repo) con `NEXT_PUBLIC_SITE_URL=https://focusos.<tu-subdominio>.workers.dev`. La URL y la clave publicable de Supabase se toman de `.env.local`.
3. `npm run cf:deploy`. Necesitas una subida estable: el código ocupa unos 9 MB.

### Después del primer deploy

1. **Supabase Auth:** añade `https://focusos.<tu-subdominio>.workers.dev/**` en *Authentication → URL Configuration → Redirect URLs* y, si es la URL principal, ponla como Site URL.
2. **Secretos (opcionales):** se guardan en Cloudflare (*Settings → Variables & Secrets* del Worker, o `npx wrangler secret put ANTHROPIC_API_KEY`), nunca en el repositorio. Lo mismo para `OPENAI_API_KEY`, `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `SUPABASE_SECRET_KEY` e `INTEGRATIONS_ENCRYPTION_KEY`. Se leen en cada petición, así que no hace falta recompilar. Si usas Notion, su Redirect URI debe usar la URL pública.

Notas:

- **Tamaño:** con `minify` (en `wrangler.jsonc`) el Worker ocupa unos 9 MB, 2.6 MiB comprimido. El plan gratuito permite 3 MiB comprimido y el de pago, 10 MiB. `npx wrangler deploy --dry-run` muestra el tamaño exacto.
- **Conexión lenta:** desde este equipo la subida del código fallaba siempre a los 5 minutos de espera (la subida medida fue de 8 KB/s, probablemente saturada por OneDrive). Por eso se usa el despliegue desde GitHub.
- **`proxy.ts`:** el soporte de OpenNext para el proxy de Next 16 (runtime de Node) es experimental. Las E2E pasan contra `cf:preview`.
- **Caché:** de solo lectura, generada en el build. Basta porque los datos de cada usuario se leen en cada petición y no hay ISR. Para revalidar por tiempo o por etiquetas haría falta R2 y una caché de etiquetas en D1.
- **Windows:** OpenNext recomienda WSL. En este equipo el build y el preview funcionaron en Windows.
- **E2E contra el preview:** `cf:preview` y luego `E2E_BASE_URL=http://localhost:8787 npx playwright test`. La prueba del asistente se omite allí porque el proveedor de prueba se bloquea en builds de producción.

### Tipos de la base de datos

`src/lib/supabase/database.types.ts` se genera desde el esquema. Regénéralo tras cada migración con la CLI (`npx supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts`) o con la MCP de Supabase.
