-- FocusOS · privilegios y Row Level Security
--
-- Modelo: cada usuario autenticado solo ve y modifica sus propias filas.
-- El rol anon no tiene acceso a ninguna tabla. La clave secreta (service role)
-- no se usa desde el navegador en ningún caso.
--
-- (select auth.uid()) se evalúa una sola vez por consulta en lugar de por fila.

-- ---------------------------------------------------------------------------
-- Funciones: nadie fuera del servidor necesita ejecutarlas por RPC.
-- ---------------------------------------------------------------------------

revoke execute on function public.is_valid_timezone(text) from public, anon;
grant execute on function public.is_valid_timezone(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios de tabla
-- ---------------------------------------------------------------------------

revoke all on table
  public.profiles,
  public.subjects,
  public.tasks,
  public.study_sessions,
  public.grade_items,
  public.schedule_events,
  public.integrations
from anon, public;

-- El perfil lo crea el trigger de registro y se borra en cascada con la cuenta.
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, timezone, week_starts_on) on table public.profiles to authenticated;

grant select, insert, update, delete on table
  public.subjects,
  public.tasks,
  public.study_sessions,
  public.grade_items,
  public.schedule_events
to authenticated;

-- integrations: el usuario puede declarar el proveedor y sus preferencias, pero
-- el estado de conexión, la última sincronización y los errores solo los
-- escribe el servidor. Así la interfaz no puede mostrar una sincronización
-- exitosa que no ocurrió.
revoke all on table public.integrations from authenticated;
grant select, delete on table public.integrations to authenticated;
grant insert (provider, settings) on table public.integrations to authenticated;
grant update (settings) on table public.integrations to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.tasks enable row level security;
alter table public.study_sessions enable row level security;
alter table public.grade_items enable row level security;
alter table public.schedule_events enable row level security;
alter table public.integrations enable row level security;

-- profiles ------------------------------------------------------------------

create policy "profiles: leer el propio"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: actualizar el propio"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Tablas con user_id: mismas cuatro políticas en cada una ---------------------

create policy "subjects: leer las propias"
  on public.subjects for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "subjects: crear propias"
  on public.subjects for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "subjects: actualizar las propias"
  on public.subjects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "subjects: eliminar las propias"
  on public.subjects for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "tasks: leer las propias"
  on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "tasks: crear propias"
  on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "tasks: actualizar las propias"
  on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "tasks: eliminar las propias"
  on public.tasks for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "study_sessions: leer las propias"
  on public.study_sessions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "study_sessions: crear propias"
  on public.study_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "study_sessions: actualizar las propias"
  on public.study_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "study_sessions: eliminar las propias"
  on public.study_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "grade_items: leer los propios"
  on public.grade_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "grade_items: crear propios"
  on public.grade_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "grade_items: actualizar los propios"
  on public.grade_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "grade_items: eliminar los propios"
  on public.grade_items for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "schedule_events: leer los propios"
  on public.schedule_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "schedule_events: crear propios"
  on public.schedule_events for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "schedule_events: actualizar los propios"
  on public.schedule_events for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "schedule_events: eliminar los propios"
  on public.schedule_events for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "integrations: leer las propias"
  on public.integrations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "integrations: crear propias"
  on public.integrations for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "integrations: actualizar las propias"
  on public.integrations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "integrations: eliminar las propias"
  on public.integrations for delete to authenticated
  using ((select auth.uid()) = user_id);
