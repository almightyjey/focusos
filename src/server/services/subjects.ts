import "server-only";

import { DEMO_SUBJECTS } from "@/config/demo-subjects";
import type { Subject } from "@/domain/types";
import type { Tables } from "@/lib/supabase/database.types";
import type { SubjectFormValues } from "@/schemas/subject";
import type { Session } from "@/server/auth";
import { DataError, toDataError } from "@/server/errors";

const DUPLICATE_NAME = "Ya tienes una materia con ese nombre.";

function toSubject(row: Tables<"subjects">): Subject {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    color: row.color,
    priority: row.priority,
    credits: row.credits,
    instructor: row.instructor,
    isArchived: row.is_archived,
  };
}

export async function listSubjects(
  session: Session,
  options: { includeArchived?: boolean } = {},
): Promise<Subject[]> {
  let query = session.supabase.from("subjects").select("*").order("name");
  if (!options.includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw toDataError(error);
  return data.map(toSubject);
}

/** Una materia del usuario, o null si no existe o no es suya (RLS). */
export async function getSubject(session: Session, id: string): Promise<Subject | null> {
  const { data, error } = await session.supabase.from("subjects").select("*").eq("id", id).maybeSingle();
  if (error) throw toDataError(error);
  return data ? toSubject(data) : null;
}

export async function createSubject(session: Session, values: SubjectFormValues): Promise<Subject> {
  const { data, error } = await session.supabase
    .from("subjects")
    .insert({ name: values.name, code: values.code, color: values.color, priority: values.priority })
    .select("*")
    .single();
  if (error) throw toDataError(error, { "23505": DUPLICATE_NAME });
  return toSubject(data);
}

export async function updateSubject(
  session: Session,
  id: string,
  values: SubjectFormValues,
): Promise<Subject> {
  const { data, error } = await session.supabase
    .from("subjects")
    .update({ name: values.name, code: values.code, color: values.color, priority: values.priority })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw toDataError(error, { "23505": DUPLICATE_NAME });
  if (!data) throw new DataError("No se encontró la materia.", "not_found");
  return toSubject(data);
}

export async function setSubjectArchived(session: Session, id: string, archived: boolean) {
  const { data, error } = await session.supabase
    .from("subjects")
    .update({ is_archived: archived })
    .eq("id", id)
    .select("id");
  if (error) throw toDataError(error);
  if (data.length === 0) throw new DataError("No se encontró la materia.", "not_found");
}

/** Borra la materia. Sus tareas se conservan sin materia (ON DELETE SET NULL). */
export async function deleteSubject(session: Session, id: string) {
  const { data, error } = await session.supabase.from("subjects").delete().eq("id", id).select("id");
  if (error) throw toDataError(error);
  if (data.length === 0) throw new DataError("No se encontró la materia.", "not_found");
}

/**
 * Crea las materias de demostración que falten. Es idempotente: compara por
 * nombre (sin distinguir mayúsculas) y el índice único de la base impide
 * duplicados aunque se pulse dos veces a la vez.
 */
export async function seedDemoSubjects(session: Session): Promise<{ created: number; skipped: number }> {
  const { data: existing, error } = await session.supabase.from("subjects").select("name");
  if (error) throw toDataError(error);

  const taken = new Set(existing.map((row) => row.name.trim().toLocaleLowerCase("es")));
  const missing = DEMO_SUBJECTS.filter(
    (subject) => !taken.has(subject.name.trim().toLocaleLowerCase("es")),
  );
  if (missing.length === 0) return { created: 0, skipped: DEMO_SUBJECTS.length };

  const { data: inserted, error: insertError } = await session.supabase
    .from("subjects")
    .insert(missing.map(({ name, color, priority }) => ({ name, color, priority })))
    .select("id");
  if (insertError) {
    throw toDataError(insertError, {
      "23505": "Algunas materias ya existían. Recarga la página e inténtalo de nuevo.",
    });
  }
  return { created: inserted.length, skipped: DEMO_SUBJECTS.length - inserted.length };
}
