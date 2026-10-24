-- FocusOS · fase 9: integraciones (Notion e IA)

-- ---------------------------------------------------------------------------
-- 1. Deduplicación de importaciones
--
-- Un índice único parcial no puede ser árbitro de ON CONFLICT desde PostgREST
-- (upsert), así que se sustituye por una restricción única completa. Los NULL no
-- chocan entre sí: las filas creadas en la app, sin origen externo, no cambian.
-- La restricción *_external_ref_pair ya obliga a que origen e id vayan juntos.
-- ---------------------------------------------------------------------------

drop index public.tasks_external_ref_key;
alter table public.tasks
  add constraint tasks_external_ref_key unique (user_id, external_source, external_id);

drop index public.schedule_events_external_ref_key;
alter table public.schedule_events
  add constraint schedule_events_external_ref_key unique (user_id, external_source, external_id);

-- ---------------------------------------------------------------------------
-- 2. Credenciales de integraciones
--
-- Tokens OAuth cifrados por la app con AES-256-GCM (INTEGRATIONS_ENCRYPTION_KEY)
-- antes de llegar a la base. Solo el servidor con la clave secreta (service_role)
-- los lee o escribe: RLS activo, sin políticas y sin privilegios para anon ni
-- authenticated. Si el usuario borra su fila de integrations, el token se borra
-- en cascada.
-- ---------------------------------------------------------------------------

create table public.integration_credentials (
  user_id uuid not null,
  provider public.integration_provider not null,
  secret text not null check (char_length(secret) between 1 and 8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider),
  constraint integration_credentials_integration_fkey
    foreign key (user_id, provider)
    references public.integrations (user_id, provider)
    on delete cascade
);

create trigger integration_credentials_set_updated_at
  before update on public.integration_credentials
  for each row execute function public.set_updated_at();

revoke all on table public.integration_credentials from anon, authenticated, public;
alter table public.integration_credentials enable row level security;

comment on table public.integration_credentials is
  'Tokens cifrados de integraciones. Solo service_role; nunca se exponen al navegador.';
