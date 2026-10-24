-- FocusOS · horario de estudio del perfil
--
-- El planificador calcula el tiempo libre de cada día dentro de esta ventana
-- (minutos desde la medianoche local) y le resta los eventos del calendario.
-- Es una preferencia editable en Ajustes, no un dato académico.

alter table public.profiles
  add column study_window_start smallint not null default 480
    check (study_window_start between 0 and 1439),
  add column study_window_end smallint not null default 1320
    check (study_window_end between 1 and 1440);

alter table public.profiles
  add constraint profiles_study_window_order check (study_window_end > study_window_start);

comment on column public.profiles.study_window_start is
  'Inicio del horario de estudio diario, en minutos desde la medianoche local (480 = 08:00).';
comment on column public.profiles.study_window_end is
  'Fin del horario de estudio diario, en minutos desde la medianoche local (1440 = 24:00).';

grant update (study_window_start, study_window_end) on table public.profiles to authenticated;
