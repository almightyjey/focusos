import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { zonedInputToUtc } from "@/domain/datetime";
import type { SessionWithTask, StudySession } from "@/domain/sessions";
import type { Tables } from "@/lib/supabase/database.types";
import type { ManualSessionValues } from "@/schemas/session";
import type { Session } from "@/server/auth";
import { DataError, toDataError } from "@/server/errors";


type Target = { taskId: string | null; subjectId: string | null };

const SESSION_ERRORS: Record<string, string> = {
  "23505": "Ya tienes una sesión en curso. Termínala o descártala antes de empezar otra.",
  P0002: "La sesión ya no está en curso. Recarga la página para ver su estado.",
  "22023": "No puedes registrar tiempo en el futuro.",
  "23503": "La tarea o materia elegida no existe.",
};

function sessionError(error: PostgrestError): DataError {
  const message = SESSION_ERRORS[error.code];
  if (message) return new DataError(message, error.code === "P0002" ? "not_found" : "invalid");
  return toDataError(error);
}

function toSession(row: Tables<"study_sessions">): StudySession {
  return {
    id: row.id,
    taskId: row.task_id,
    subjectId: row.subject_id,
    status: row.status,
    plannedMinutes: row.planned_minutes,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    pausedAt: row.paused_at,
    pausedSeconds: row.paused_seconds,
    focusSeconds: row.focus_seconds,
    notes: row.notes,
  };
}

const WITH_TASK =
  "*, task:tasks!study_sessions_task_fkey(title), subject:subjects!study_sessions_subject_fkey(name, color)";

function withTask(
  row: Tables<"study_sessions"> & {
    task: { title: string } | null;
    subject: { name: string; color: string } | null;
  },
): SessionWithTask {
  return {
    ...toSession(row),
    taskTitle: row.task?.title ?? null,
    subjectName: row.subject?.name ?? null,
    subjectColor: row.subject?.color ?? null,
  };
}

export async function getActiveSession(session: Session): Promise<SessionWithTask | null> {
  const { data, error } = await session.supabase
    .from("study_sessions")
    .select(WITH_TASK)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw toDataError(error);
  return data ? withTask(data) : null;
}

export async function startSession(session: Session, target: Target, plannedMinutes: number | null) {
  const { data, error } = await session.supabase.rpc("start_study_session", {
    ...(target.taskId ? { p_task_id: target.taskId } : {}),
    ...(target.subjectId ? { p_subject_id: target.subjectId } : {}),
    ...(plannedMinutes ? { p_planned_minutes: plannedMinutes } : {}),
  });
  if (error) throw sessionError(error);
  return toSession(data);
}

export async function pauseSession(session: Session, id: string) {
  const { data, error } = await session.supabase.rpc("pause_study_session", { p_id: id });
  if (error) throw sessionError(error);
  return toSession(data);
}

export async function resumeSession(session: Session, id: string) {
  const { data, error } = await session.supabase.rpc("resume_study_session", { p_id: id });
  if (error) throw sessionError(error);
  return toSession(data);
}

/** La base calcula el enfoque y solo acepta reducirlo, nunca aumentarlo. */
export async function finishSession(
  session: Session,
  id: string,
  focusSeconds: number | null,
  notes: string | null,
) {
  const { data, error } = await session.supabase.rpc("finish_study_session", {
    p_id: id,
    ...(focusSeconds !== null ? { p_focus_seconds: focusSeconds } : {}),
    ...(notes ? { p_notes: notes } : {}),
  });
  if (error) throw sessionError(error);
  return toSession(data);
}

export async function cancelSession(session: Session, id: string) {
  const { data, error } = await session.supabase.rpc("cancel_study_session", { p_id: id });
  if (error) throw sessionError(error);
  return toSession(data);
}

/** Registra tiempo estudiado sin temporizador. */
export async function logManualSession(session: Session, values: ManualSessionValues, timeZone: string) {
  const startedAt = zonedInputToUtc(values.date, values.startTime, timeZone);
  const endedAt = new Date(startedAt.getTime() + values.minutes * 60_000);
  if (endedAt.getTime() > Date.now() + 60_000) {
    throw new DataError("No puedes registrar tiempo que termina en el futuro.", "invalid");
  }

  let subjectId = values.target.subjectId;
  if (values.target.taskId) {
    const { data, error } = await session.supabase
      .from("tasks")
      .select("subject_id")
      .eq("id", values.target.taskId)
      .maybeSingle();
    if (error) throw toDataError(error);
    if (!data) throw new DataError("La tarea elegida no existe.", "not_found");
    subjectId = data.subject_id;
  }

  const { data, error } = await session.supabase
    .from("study_sessions")
    .insert({
      task_id: values.target.taskId,
      subject_id: subjectId,
      status: "completed",
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      focus_seconds: values.minutes * 60,
      notes: values.notes,
    })
    .select("*")
    .single();
  if (error) throw sessionError(error);
  return toSession(data);
}

export async function listCompletedSessions(session: Session, sinceIso: string): Promise<SessionWithTask[]> {
  const { data, error } = await session.supabase
    .from("study_sessions")
    .select(WITH_TASK)
    .eq("status", "completed")
    .gte("started_at", sinceIso)
    .order("started_at", { ascending: false });
  if (error) throw toDataError(error);
  return data.map(withTask);
}

export async function deleteCompletedSession(session: Session, id: string) {
  const { data, error } = await session.supabase
    .from("study_sessions")
    .delete()
    .eq("id", id)
    .eq("status", "completed")
    .select("id");
  if (error) throw toDataError(error);
  if (data.length === 0) throw new DataError("No se encontró la sesión.", "not_found");
}

/** Segundos de enfoque registrados por tarea (vista task_focus_totals). */
export async function getFocusByTask(session: Session): Promise<Map<string, number>> {
  const { data, error } = await session.supabase.from("task_focus_totals").select("task_id, focus_seconds");
  if (error) throw toDataError(error);
  return new Map(
    data.flatMap((row) => (row.task_id && row.focus_seconds ? [[row.task_id, row.focus_seconds] as const] : [])),
  );
}
