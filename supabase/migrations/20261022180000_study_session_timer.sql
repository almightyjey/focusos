-- FocusOS · temporizador de sesiones de estudio
--
-- El temporizador lo gobierna la base: empezar, pausar, reanudar, terminar y
-- descartar son funciones que usan now() de Postgres. Así el tiempo registrado
-- no depende del reloj del navegador, sobrevive a recargas y dos pestañas no
-- pueden dejar la sesión en un estado incoherente. Las funciones son
-- SECURITY INVOKER: RLS sigue decidiendo qué filas ve y cambia cada usuario.

-- ---------------------------------------------------------------------------
-- Pausas
-- ---------------------------------------------------------------------------

alter table public.study_sessions
  add column paused_at timestamptz,
  add column paused_seconds integer not null default 0 check (paused_seconds >= 0);

alter table public.study_sessions
  add constraint study_sessions_pause_only_active
    check (paused_at is null or status = 'active'),
  add constraint study_sessions_pause_after_start
    check (paused_at is null or paused_at >= started_at),
  -- El tiempo de enfoque nunca supera lo que duró la sesión.
  add constraint study_sessions_focus_within_span
    check (
      focus_seconds is null
      or ended_at is null
      or focus_seconds <= ceil(extract(epoch from (ended_at - started_at)))
    );

comment on column public.study_sessions.paused_seconds is
  'Segundos acumulados en pausa; se descuentan del tiempo de enfoque.';

-- No se registra tiempo en el futuro (margen de 1 minuto por desfase de relojes).
create or replace function public.study_sessions_guard_times()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.started_at is not null and new.started_at > now() + interval '1 minute' then
    raise exception 'La sesión no puede empezar en el futuro' using errcode = '22023';
  end if;
  if new.ended_at is not null and new.ended_at > now() + interval '1 minute' then
    raise exception 'La sesión no puede terminar en el futuro' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger study_sessions_guard_times
  before insert or update of started_at, ended_at on public.study_sessions
  for each row execute function public.study_sessions_guard_times();

-- ---------------------------------------------------------------------------
-- Funciones del temporizador
-- ---------------------------------------------------------------------------

create or replace function public.start_study_session(
  p_task_id uuid default null,
  p_subject_id uuid default null,
  p_planned_minutes integer default null
)
returns public.study_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_subject uuid := p_subject_id;
  v_row public.study_sessions;
begin
  -- Con tarea, la materia es la de la tarea (RLS impide leer tareas ajenas).
  if p_task_id is not null then
    select t.subject_id into v_subject from public.tasks t where t.id = p_task_id;
    if not found then
      raise exception 'La tarea no existe' using errcode = 'P0002';
    end if;
  end if;

  -- El índice único parcial rechaza una segunda sesión activa (23505).
  insert into public.study_sessions (task_id, subject_id, status, planned_minutes, started_at)
  values (p_task_id, v_subject, 'active', p_planned_minutes, now())
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.pause_study_session(p_id uuid)
returns public.study_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.study_sessions;
begin
  update public.study_sessions
  set paused_at = now()
  where id = p_id and status = 'active' and paused_at is null
  returning * into v_row;
  if not found then
    raise exception 'No hay una sesión en curso para pausar' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create or replace function public.resume_study_session(p_id uuid)
returns public.study_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.study_sessions;
begin
  update public.study_sessions
  set paused_seconds = paused_seconds + greatest(0, floor(extract(epoch from (now() - paused_at))))::integer,
      paused_at = null
  where id = p_id and status = 'active' and paused_at is not null
  returning * into v_row;
  if not found then
    raise exception 'No hay una sesión en pausa para reanudar' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- p_focus_seconds permite registrar menos tiempo del medido (p. ej. si se
-- olvidó parar el temporizador), nunca más.
create or replace function public.finish_study_session(
  p_id uuid,
  p_focus_seconds integer default null,
  p_notes text default null
)
returns public.study_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_row public.study_sessions;
  v_paused integer;
  v_measured integer;
begin
  select * into v_row
  from public.study_sessions
  where id = p_id and status = 'active'
  for update;
  if not found then
    raise exception 'No hay una sesión en curso para terminar' using errcode = 'P0002';
  end if;

  v_paused := v_row.paused_seconds + case
    when v_row.paused_at is null then 0
    else greatest(0, floor(extract(epoch from (v_now - v_row.paused_at))))::integer
  end;
  v_measured := greatest(0, floor(extract(epoch from (v_now - v_row.started_at)))::integer - v_paused);

  update public.study_sessions
  set status = 'completed',
      ended_at = v_now,
      paused_at = null,
      paused_seconds = v_paused,
      focus_seconds = least(
        86400,
        case
          when p_focus_seconds is null then v_measured
          else least(greatest(p_focus_seconds, 0), v_measured)
        end
      ),
      notes = coalesce(nullif(btrim(p_notes), ''), v_row.notes)
  where id = p_id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.cancel_study_session(p_id uuid)
returns public.study_sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.study_sessions;
begin
  update public.study_sessions
  set status = 'cancelled', ended_at = now(), paused_at = null
  where id = p_id and status = 'active'
  returning * into v_row;
  if not found then
    raise exception 'No hay una sesión en curso para descartar' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke execute on function public.start_study_session(uuid, uuid, integer) from public, anon;
revoke execute on function public.pause_study_session(uuid) from public, anon;
revoke execute on function public.resume_study_session(uuid) from public, anon;
revoke execute on function public.finish_study_session(uuid, integer, text) from public, anon;
revoke execute on function public.cancel_study_session(uuid) from public, anon;
grant execute on function public.start_study_session(uuid, uuid, integer) to authenticated;
grant execute on function public.pause_study_session(uuid) to authenticated;
grant execute on function public.resume_study_session(uuid) to authenticated;
grant execute on function public.finish_study_session(uuid, integer, text) to authenticated;
grant execute on function public.cancel_study_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Tiempo real dedicado a cada tarea
-- ---------------------------------------------------------------------------

-- security_invoker: la vista aplica la RLS de study_sessions de quien consulta.
create view public.task_focus_totals
with (security_invoker = true)
as
select
  task_id,
  sum(focus_seconds)::integer as focus_seconds,
  count(*)::integer as session_count
from public.study_sessions
where status = 'completed' and task_id is not null and focus_seconds is not null
group by task_id;

revoke all on public.task_focus_totals from anon, public;
grant select on public.task_focus_totals to authenticated;
