-- FocusOS · esquema inicial
--
-- Convenciones:
--   * Todas las marcas de tiempo son timestamptz (instantes UTC). La zona horaria
--     del usuario vive en profiles.timezone y solo se usa para mostrar y para
--     convertir la entrada local a UTC.
--   * Cada tabla con datos personales tiene user_id y RLS activado (ver la
--     migración siguiente).
--   * Las referencias entre tablas del usuario usan claves foráneas compuestas
--     (id, user_id) para que una fila nunca apunte a datos de otro usuario,
--     incluso si alguien intenta pasar un id ajeno.

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------

create type public.priority_level as enum ('low', 'medium', 'high', 'urgent');

create type public.task_status as enum ('pending', 'in_progress', 'completed', 'cancelled');

create type public.task_kind as enum (
  'assignment', 'study', 'project', 'reading', 'exam_prep', 'lab', 'other'
);

create type public.study_session_status as enum ('planned', 'active', 'completed', 'cancelled');

create type public.grade_category as enum (
  'exam', 'quiz', 'assignment', 'project', 'lab', 'participation', 'presentation', 'other'
);

create type public.schedule_event_kind as enum (
  'class', 'lab', 'exam', 'study_block', 'deadline', 'personal', 'other'
);

create type public.integration_provider as enum ('notion', 'openai', 'anthropic');

create type public.integration_status as enum ('disconnected', 'connected', 'error');

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text
    check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  timezone text not null default 'America/Santo_Domingo'
    check (char_length(timezone) between 1 and 64),
  week_starts_on smallint not null default 1
    check (week_starts_on between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.timezone is
  'Zona IANA usada para mostrar fechas y convertir la entrada local a UTC.';
comment on column public.profiles.week_starts_on is
  '0 = domingo … 6 = sábado. Define el inicio de la semana en resúmenes y calendario.';

create or replace function public.profiles_validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_valid_timezone(new.timezone) then
    raise exception 'Zona horaria no válida: %', new.timezone
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.profiles_validate_timezone();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea el perfil al registrarse. La zona horaria llega desde el navegador en
-- raw_user_meta_data; si no es válida se usa la predeterminada para no romper
-- el registro.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_tz text := new.raw_user_meta_data ->> 'timezone';
  requested_name text := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), '');
begin
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    requested_name,
    case
      when requested_tz is not null and public.is_valid_timezone(requested_tz) then requested_tz
      else 'America/Santo_Domingo'
    end
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  code text check (code is null or char_length(btrim(code)) between 1 and 20),
  color text not null default '#2B4ACB' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  priority public.priority_level not null default 'medium',
  credits smallint check (credits is null or credits between 0 and 20),
  instructor text check (instructor is null or char_length(btrim(instructor)) between 1 and 120),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_id_user_key unique (id, user_id)
);

-- Evita materias duplicadas por usuario (sin distinguir mayúsculas).
create unique index subjects_user_name_key on public.subjects (user_id, lower(btrim(name)));
create index subjects_user_archived_idx on public.subjects (user_id, is_archived);

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 5000),
  kind public.task_kind not null default 'assignment',
  status public.task_status not null default 'pending',
  priority public.priority_level not null default 'medium',
  due_at timestamptz,
  estimated_minutes integer
    check (estimated_minutes is null or estimated_minutes between 1 and 10080),
  difficulty smallint check (difficulty is null or difficulty between 1 and 5),
  completed_at timestamptz,
  -- Origen externo (Notion, importaciones). Junto con user_id es único para
  -- que una sincronización repetida no duplique tareas.
  external_source text check (external_source is null or char_length(external_source) between 1 and 40),
  external_id text check (external_id is null or char_length(external_id) between 1 and 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_id_user_key unique (id, user_id),
  constraint tasks_subject_fkey foreign key (subject_id, user_id)
    references public.subjects (id, user_id) on delete set null (subject_id),
  constraint tasks_completed_at_matches_status
    check ((status = 'completed') = (completed_at is not null)),
  constraint tasks_external_ref_pair
    check ((external_source is null) = (external_id is null))
);

create unique index tasks_external_ref_key
  on public.tasks (user_id, external_source, external_id)
  where external_source is not null;
create index tasks_user_status_due_idx on public.tasks (user_id, status, due_at);
create index tasks_subject_user_idx on public.tasks (subject_id, user_id);

-- Mantiene completed_at coherente con el estado sin depender del cliente.
create or replace function public.tasks_sync_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    if new.completed_at is null then
      new.completed_at := now();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_sync_completed_at
  before insert or update of status, completed_at on public.tasks
  for each row execute function public.tasks_sync_completed_at();

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- study_sessions
-- ---------------------------------------------------------------------------

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  task_id uuid,
  status public.study_session_status not null default 'planned',
  planned_start_at timestamptz,
  planned_minutes integer check (planned_minutes is null or planned_minutes between 1 and 1440),
  started_at timestamptz,
  ended_at timestamptz,
  -- Tiempo real de concentración en segundos (excluye pausas).
  focus_seconds integer check (focus_seconds is null or focus_seconds between 0 and 86400),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint study_sessions_subject_fkey foreign key (subject_id, user_id)
    references public.subjects (id, user_id) on delete set null (subject_id),
  constraint study_sessions_task_fkey foreign key (task_id, user_id)
    references public.tasks (id, user_id) on delete set null (task_id),
  constraint study_sessions_time_order
    check (ended_at is null or (started_at is not null and ended_at >= started_at)),
  constraint study_sessions_active_has_start
    check (status <> 'active' or started_at is not null),
  constraint study_sessions_completed_has_times
    check (status <> 'completed' or (started_at is not null and ended_at is not null and focus_seconds is not null))
);

-- Solo una sesión activa por usuario.
create unique index study_sessions_one_active_per_user
  on public.study_sessions (user_id) where status = 'active';
create index study_sessions_user_started_idx on public.study_sessions (user_id, started_at desc);
create index study_sessions_subject_user_idx on public.study_sessions (subject_id, user_id);
create index study_sessions_task_user_idx on public.study_sessions (task_id, user_id);

create trigger study_sessions_set_updated_at
  before update on public.study_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- grade_items (evaluaciones y calificaciones)
-- ---------------------------------------------------------------------------

create table public.grade_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  category public.grade_category not null default 'exam',
  -- Cualquiera de estos valores puede ser desconocido (null). Los promedios
  -- ponderados solo se calculan cuando están todos los datos necesarios.
  score numeric(7, 2) check (score is null or score >= 0),
  max_score numeric(7, 2) check (max_score is null or max_score > 0),
  weight numeric(5, 2) check (weight is null or (weight > 0 and weight <= 100)),
  due_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grade_items_subject_fkey foreign key (subject_id, user_id)
    references public.subjects (id, user_id) on delete cascade
);

comment on column public.grade_items.weight is
  'Ponderación en porcentaje del total de la materia (0–100], si se conoce.';

create index grade_items_user_due_idx on public.grade_items (user_id, due_at);
create index grade_items_subject_user_idx on public.grade_items (subject_id, user_id);

create trigger grade_items_set_updated_at
  before update on public.grade_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- schedule_events (clases, exámenes, bloques de estudio)
-- ---------------------------------------------------------------------------

create table public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  kind public.schedule_event_kind not null default 'other',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text check (location is null or char_length(location) <= 160),
  -- Regla RFC 5545 (RRULE) para eventos recurrentes, p. ej. clases semanales.
  -- Se expande en la zona indicada en timezone para respetar el horario local.
  recurrence_rule text check (recurrence_rule is null or char_length(recurrence_rule) <= 500),
  timezone text check (timezone is null or char_length(timezone) between 1 and 64),
  notes text check (notes is null or char_length(notes) <= 2000),
  external_source text check (external_source is null or char_length(external_source) between 1 and 40),
  external_id text check (external_id is null or char_length(external_id) between 1 and 255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_events_subject_fkey foreign key (subject_id, user_id)
    references public.subjects (id, user_id) on delete set null (subject_id),
  constraint schedule_events_time_order check (ends_at >= starts_at),
  constraint schedule_events_external_ref_pair
    check ((external_source is null) = (external_id is null))
);

create unique index schedule_events_external_ref_key
  on public.schedule_events (user_id, external_source, external_id)
  where external_source is not null;
create index schedule_events_user_starts_idx on public.schedule_events (user_id, starts_at);
create index schedule_events_subject_user_idx on public.schedule_events (subject_id, user_id);

create trigger schedule_events_set_updated_at
  before update on public.schedule_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- integrations
-- ---------------------------------------------------------------------------

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider public.integration_provider not null,
  -- Lo escribe solo el servidor tras comprobar la conexión real.
  status public.integration_status not null default 'disconnected',
  -- Preferencias no secretas (p. ej. id de la base de Notion). Los tokens y
  -- claves de API nunca se guardan aquí.
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  last_synced_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integrations_user_provider_key unique (user_id, provider)
);

create trigger integrations_set_updated_at
  before update on public.integrations
  for each row execute function public.set_updated_at();
