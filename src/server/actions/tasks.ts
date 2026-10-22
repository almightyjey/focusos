"use server";

import { revalidatePath } from "next/cache";

import { idSchema } from "@/schemas/common";
import { taskFormSchema, type TaskFormInput } from "@/schemas/task";
import { fail, invalidInput, ok, type ActionResult } from "@/server/action-result";
import { requireSession } from "@/server/auth";
import { messageFromError } from "@/server/errors";
import { getProfile } from "@/server/services/profiles";
import { createTask, deleteTask, setTaskCompleted, updateTask } from "@/server/services/tasks";

function refreshApp() {
  revalidatePath("/", "layout");
}

export async function createTaskAction(input: TaskFormInput): Promise<ActionResult> {
  const parsed = taskFormSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    const profile = await getProfile(session);
    await createTask(session, parsed.data, profile.timezone);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function updateTaskAction(id: string, input: TaskFormInput): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsed = taskFormSchema.safeParse(input);
  if (!parsedId.success) return fail("Tarea no válida.");
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    const profile = await getProfile(session);
    await updateTask(session, parsedId.data, parsed.data, profile.timezone);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function setTaskCompletedAction(id: string, completed: boolean): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success || typeof completed !== "boolean") return fail("Datos no válidos.");
  const session = await requireSession();
  try {
    await setTaskCompleted(session, parsedId.data, completed);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("Tarea no válida.");
  const session = await requireSession();
  try {
    await deleteTask(session, parsedId.data);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}
