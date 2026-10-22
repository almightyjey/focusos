import "server-only";

import { DEFAULT_DUE_TIME, zonedInputToUtc } from "@/domain/datetime";
import type { Task } from "@/domain/types";
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import type { TaskFormValues } from "@/schemas/task";
import type { Session } from "@/server/auth";
import { DataError, toDataError } from "@/server/errors";

const SUBJECT_NOT_FOUND = "La materia seleccionada no existe.";

function toTask(row: Tables<"tasks">): Task {
  return {
    id: row.id,
    subjectId: row.subject_id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    status: row.status,
    priority: row.priority,
    dueAt: row.due_at,
    estimatedMinutes: row.estimated_minutes,
    difficulty: row.difficulty,
    completedAt: row.completed_at,
  };
}

/** Convierte el formulario (hora local) en columnas de la base (UTC). */
export function taskValuesToRow(
  values: TaskFormValues,
  timeZone: string,
): Omit<TablesInsert<"tasks">, "user_id"> {
  const dueAt =
    values.dueDate === ""
      ? null
      : zonedInputToUtc(values.dueDate, values.dueTime || DEFAULT_DUE_TIME, timeZone).toISOString();
  return {
    title: values.title,
    description: values.description,
    subject_id: values.subjectId,
    kind: values.kind,
    priority: values.priority,
    due_at: dueAt,
    estimated_minutes: values.estimatedMinutes,
    difficulty: values.difficulty,
  };
}

export type TaskListFilter = {
  view: "open" | "completed" | "all";
  subjectId?: string;
};

export async function listTasks(session: Session, filter: TaskListFilter): Promise<Task[]> {
  let query = session.supabase.from("tasks").select("*");
  if (filter.view === "open") query = query.in("status", ["pending", "in_progress"]);
  if (filter.view === "completed") query = query.eq("status", "completed");
  if (filter.subjectId) query = query.eq("subject_id", filter.subjectId);
  query =
    filter.view === "completed"
      ? query.order("completed_at", { ascending: false }).limit(200)
      : query.order("due_at", { ascending: true, nullsFirst: false });
  const { data, error } = await query;
  if (error) throw toDataError(error);
  return data.map(toTask);
}

/**
 * Tareas relevantes para el dashboard: todas las abiertas y las completadas o
 * con entrega en la ventana indicada (para el progreso semanal).
 */
export async function listDashboardTasks(session: Session, sinceIso: string): Promise<Task[]> {
  const { data, error } = await session.supabase
    .from("tasks")
    .select("*")
    // Los valores con ":" y "." van entre comillas dobles en los filtros or() de PostgREST.
    .or(
      `status.in.(pending,in_progress),completed_at.gte."${sinceIso}",due_at.gte."${sinceIso}"`,
    )
    .order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw toDataError(error);
  return data.map(toTask);
}

export async function createTask(
  session: Session,
  values: TaskFormValues,
  timeZone: string,
): Promise<Task> {
  const { data, error } = await session.supabase
    .from("tasks")
    .insert(taskValuesToRow(values, timeZone))
    .select("*")
    .single();
  if (error) throw toDataError(error, { "23503": SUBJECT_NOT_FOUND });
  return toTask(data);
}

export async function updateTask(
  session: Session,
  id: string,
  values: TaskFormValues,
  timeZone: string,
): Promise<Task> {
  const { data, error } = await session.supabase
    .from("tasks")
    .update(taskValuesToRow(values, timeZone))
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw toDataError(error, { "23503": SUBJECT_NOT_FOUND });
  if (!data) throw new DataError("No se encontró la tarea.", "not_found");
  return toTask(data);
}

/** completed_at lo fija un trigger de la base según el estado. */
export async function setTaskCompleted(session: Session, id: string, completed: boolean) {
  const { data, error } = await session.supabase
    .from("tasks")
    .update({ status: completed ? "completed" : "pending" })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw toDataError(error);
  if (!data) throw new DataError("No se encontró la tarea.", "not_found");
  return toTask(data);
}

export async function deleteTask(session: Session, id: string) {
  const { data, error } = await session.supabase.from("tasks").delete().eq("id", id).select("id");
  if (error) throw toDataError(error);
  if (data.length === 0) throw new DataError("No se encontró la tarea.", "not_found");
}
