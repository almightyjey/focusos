import "server-only";

import { DEFAULT_DUE_TIME, zonedInputToUtc } from "@/domain/datetime";
import type { GradeItem } from "@/domain/types";
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import type { GradeItemFormValues } from "@/schemas/grade";
import type { Session } from "@/server/auth";
import { DataError, toDataError } from "@/server/errors";

const SUBJECT_NOT_FOUND = "La materia no existe.";

function toGradeItem(row: Tables<"grade_items">): GradeItem {
  return {
    id: row.id,
    subjectId: row.subject_id,
    title: row.title,
    category: row.category,
    score: row.score,
    maxScore: row.max_score,
    weight: row.weight,
    dueAt: row.due_at,
    notes: row.notes,
  };
}

/** Convierte el formulario en columnas; una fecha sin hora se guarda a las 23:59 locales. */
export function gradeValuesToRow(
  values: GradeItemFormValues,
  timeZone: string,
): Omit<TablesInsert<"grade_items">, "user_id" | "subject_id"> {
  return {
    title: values.title,
    category: values.category,
    score: values.score,
    max_score: values.maxScore,
    weight: values.weight,
    due_at: values.dueDate === "" ? null : zonedInputToUtc(values.dueDate, DEFAULT_DUE_TIME, timeZone).toISOString(),
    notes: values.notes,
  };
}

/** Evaluaciones del usuario (de una materia o de todas), con fecha primero. */
export async function listGradeItems(session: Session, subjectId?: string): Promise<GradeItem[]> {
  let query = session.supabase.from("grade_items").select("*");
  if (subjectId) query = query.eq("subject_id", subjectId);
  const { data, error } = await query
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw toDataError(error);
  return data.map(toGradeItem);
}

export async function createGradeItem(
  session: Session,
  subjectId: string,
  values: GradeItemFormValues,
  timeZone: string,
) {
  const { data, error } = await session.supabase
    .from("grade_items")
    .insert({ ...gradeValuesToRow(values, timeZone), subject_id: subjectId })
    .select("*")
    .single();
  if (error) throw toDataError(error, { "23503": SUBJECT_NOT_FOUND });
  return toGradeItem(data);
}

export async function updateGradeItem(session: Session, id: string, values: GradeItemFormValues, timeZone: string) {
  const { data, error } = await session.supabase
    .from("grade_items")
    .update(gradeValuesToRow(values, timeZone))
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw toDataError(error);
  if (!data) throw new DataError("No se encontró la evaluación.", "not_found");
  return toGradeItem(data);
}

export async function deleteGradeItem(session: Session, id: string) {
  const { data, error } = await session.supabase.from("grade_items").delete().eq("id", id).select("id");
  if (error) throw toDataError(error);
  if (data.length === 0) throw new DataError("No se encontró la evaluación.", "not_found");
}
