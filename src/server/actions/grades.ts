"use server";

import { revalidatePath } from "next/cache";

import { idSchema } from "@/schemas/common";
import { gradeItemFormSchema, type GradeItemFormInput } from "@/schemas/grade";
import { fail, invalidInput, ok, type ActionResult } from "@/server/action-result";
import { requireSession } from "@/server/auth";
import { messageFromError } from "@/server/errors";
import { createGradeItem, deleteGradeItem, updateGradeItem } from "@/server/services/grades";
import { getProfile } from "@/server/services/profiles";

function refreshApp() {
  revalidatePath("/", "layout");
}

export async function createGradeItemAction(subjectId: string, input: GradeItemFormInput): Promise<ActionResult> {
  const parsedSubject = idSchema.safeParse(subjectId);
  const parsed = gradeItemFormSchema.safeParse(input);
  if (!parsedSubject.success) return fail("Materia no válida.");
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    const profile = await getProfile(session);
    await createGradeItem(session, parsedSubject.data, parsed.data, profile.timezone);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function updateGradeItemAction(id: string, input: GradeItemFormInput): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsed = gradeItemFormSchema.safeParse(input);
  if (!parsedId.success) return fail("Evaluación no válida.");
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    const profile = await getProfile(session);
    await updateGradeItem(session, parsedId.data, parsed.data, profile.timezone);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function deleteGradeItemAction(id: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("Evaluación no válida.");
  const session = await requireSession();
  try {
    await deleteGradeItem(session, parsedId.data);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}
