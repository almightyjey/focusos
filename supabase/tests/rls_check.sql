-- Verificación manual de RLS desde el SQL Editor de Supabase (o la MCP).
-- Requiere los usuarios de prueba e2e-a@focusos.test y e2e-b@focusos.test.
-- Simula peticiones de cada usuario cambiando de rol y de claims del JWT,
-- y borra todo lo que crea. Cada línea del resultado debe decir "0 fila(s)",
-- "rechazado" o "denegado" salvo las comprobaciones del propio dueño.

create or replace function pg_temp.rls_check() returns setof text language plpgsql as $$
declare
  a uuid := (select id from auth.users where email = 'e2e-a@focusos.test');
  b uuid := (select id from auth.users where email = 'e2e-b@focusos.test');
  subj uuid;
  n int;
  results text[] := '{}';
begin
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.subjects (name) values ('RLS check materia') returning id into subj;
  insert into public.tasks (title, subject_id) values ('RLS check tarea', subj);
  select count(*) into n from public.subjects where id = subj;
  results := array_append(results, format('A ve su materia: %s fila(s)', n));

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.subjects where id = subj;
  results := array_append(results, format('B lee materia de A: %s fila(s)', n));
  select count(*) into n from public.tasks where subject_id = subj;
  results := array_append(results, format('B lee tareas de A: %s fila(s)', n));
  update public.subjects set name = 'hackeada' where id = subj;
  get diagnostics n = row_count;
  results := array_append(results, format('B actualiza materia de A: %s fila(s)', n));
  delete from public.subjects where id = subj;
  get diagnostics n = row_count;
  results := array_append(results, format('B borra materia de A: %s fila(s)', n));
  begin
    insert into public.tasks (title, subject_id) values ('tarea intrusa', subj);
    results := array_append(results, 'B enlaza tarea a materia de A: PERMITIDO (fallo)'::text);
  exception when foreign_key_violation then
    results := array_append(results, 'B enlaza tarea a materia de A: rechazado (FK compuesta)'::text);
  end;
  begin
    insert into public.subjects (user_id, name) values (a, 'materia inyectada');
    results := array_append(results, 'B inserta fila con user_id de A: PERMITIDO (fallo)'::text);
  exception when insufficient_privilege then
    results := array_append(results, 'B inserta fila con user_id de A: rechazado (RLS)'::text);
  end;
  begin
    update public.integrations set status = 'connected';
    results := array_append(results, 'authenticated cambia integrations.status: PERMITIDO (fallo)'::text);
  exception when insufficient_privilege then
    results := array_append(results, 'authenticated cambia integrations.status: rechazado (privilegio de columna)'::text);
  end;

  execute 'reset role';
  execute 'set local role anon';
  begin
    select count(*) into n from public.subjects;
    results := array_append(results, format('anon lee subjects: %s fila(s) (fallo: debería negarse)', n));
  exception when insufficient_privilege then
    results := array_append(results, 'anon lee subjects: permiso denegado'::text);
  end;

  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.tasks set status = 'completed' where subject_id = subj;
  select count(*) into n from public.tasks where subject_id = subj and completed_at is not null;
  results := array_append(results, format('completar tarea fija completed_at: %s fila(s)', n));
  update public.tasks set status = 'pending' where subject_id = subj;
  select count(*) into n from public.tasks where subject_id = subj and completed_at is null;
  results := array_append(results, format('reabrir tarea limpia completed_at: %s fila(s)', n));

  delete from public.subjects where id = subj;
  select count(*) into n from public.tasks where title = 'RLS check tarea' and subject_id is null;
  results := array_append(results, format('tarea conservada sin materia tras borrar la materia: %s fila(s)', n));

  execute 'reset role';
  delete from public.tasks where user_id in (a, b) and title in ('RLS check tarea', 'tarea intrusa');
  delete from public.subjects where user_id in (a, b) and name in ('RLS check materia', 'materia inyectada', 'hackeada');
  return query select unnest(results);
end $$;

select * from pg_temp.rls_check();
