-- FocusOS · eventos recurrentes
--
-- Una regla de repetición se expande en hora local (una clase de las 10:00
-- sigue a las 10:00 aunque cambie el horario de verano), así que necesita la
-- zona horaria en la que se creó. Esta migración lo exige y valida la zona.

alter table public.schedule_events
  add constraint schedule_events_recurrence_needs_timezone
  check (recurrence_rule is null or timezone is not null);

create or replace function public.schedule_events_validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.timezone is not null and not public.is_valid_timezone(new.timezone) then
    raise exception 'Zona horaria no válida: %', new.timezone
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger schedule_events_validate_timezone
  before insert or update of timezone on public.schedule_events
  for each row execute function public.schedule_events_validate_timezone();

-- Las series recurrentes se consultan aparte del rango de fechas.
create index schedule_events_user_recurring_idx
  on public.schedule_events (user_id, starts_at)
  where recurrence_rule is not null;
