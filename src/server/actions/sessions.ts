"use server";

import { revalidatePath } from "next/cache";

import { idSchema } from "@/schemas/common";
import {
  finishSessionSchema,
  manualSessionSchema,
  startSessionSchema,
  type FinishSessionInput,
  type ManualSessionInput,
  type StartSessionInput,
} from "@/schemas/session";
import { fail, invalidInput, ok, type ActionResult } from "@/server/action-result";
import { requireSession } from "@/server/auth";
import { messageFromError } from "@/server/errors";
import { getProfile } from "@/server/services/profiles";
import {
  cancelSession,
  deleteCompletedSession,
  finishSession,
  logManualSession,
  pauseSession,
  resumeSession,
  startSession,
} from "@/server/services/sessions";
import { setTaskCompleted } from "@/server/services/tasks";

/** Duración de las sesiones iniciadas desde una tarea (técnica pomodoro). */
const QUICK_START_MINUTES = 25;

function refreshApp() {
  revalidatePath("/", "layout");
}

export async function startSessionAction(input: StartSessionInput): Promise<ActionResult> {
  const parsed = startSessionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    await startSession(session, parsed.data.target, parsed.data.plannedMinutes);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function startTaskSessionAction(taskId: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(taskId);
  if (!parsedId.success) return fail("Tarea no válida.");
  const session = await requireSession();
  try {
    await startSession(session, { taskId: parsedId.data, subjectId: null }, QUICK_START_MINUTES);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function pauseSessionAction(id: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("Sesión no válida.");
  const session = await requireSession();
  try {
    await pauseSession(session, parsedId.data);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function resumeSessionAction(id: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("Sesión no válida.");
  const session = await requireSession();
  try {
    await resumeSession(session, parsedId.data);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function finishSessionAction(
  id: string,
  input: FinishSessionInput,
): Promise<ActionResult<{ focusSeconds: number; taskCompleted: boolean }>> {
  const parsedId = idSchema.safeParse(id);
  const parsed = finishSessionSchema.safeParse(input);
  if (!parsedId.success) return fail("Sesión no válida.");
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    const { focusMinutes, notes, completeTask } = parsed.data;
    const finished = await finishSession(
      session,
      parsedId.data,
      focusMinutes === null ? null : focusMinutes * 60,
      notes,
    );
    let taskCompleted = false;
    if (completeTask && finished.taskId) {
      await setTaskCompleted(session, finished.taskId, true);
      taskCompleted = true;
    }
    refreshApp();
    return ok({ focusSeconds: finished.focusSeconds ?? 0, taskCompleted });
  } catch (error) {
    return fail(messageFromError(error));
  }
}

export async function cancelSessionAction(id: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("Sesión no válida.");
  const session = await requireSession();
  try {
    await cancelSession(session, parsedId.data);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function logManualSessionAction(input: ManualSessionInput): Promise<ActionResult> {
  const parsed = manualSessionSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    const profile = await getProfile(session);
    await logManualSession(session, parsed.data, profile.timezone);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function deleteSessionAction(id: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("Sesión no válida.");
  const session = await requireSession();
  try {
    await deleteCompletedSession(session, parsedId.data);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}
