"use server";

import { revalidatePath } from "next/cache";

import { idSchema } from "@/schemas/common";
import { subjectFormSchema, type SubjectFormInput } from "@/schemas/subject";
import { fail, invalidInput, ok, type ActionResult } from "@/server/action-result";
import { requireSession } from "@/server/auth";
import { messageFromError } from "@/server/errors";
import {
  createSubject,
  deleteSubject,
  seedDemoSubjects,
  setSubjectArchived,
  updateSubject,
} from "@/server/services/subjects";

function refreshApp() {
  revalidatePath("/", "layout");
}

export async function createSubjectAction(input: SubjectFormInput): Promise<ActionResult> {
  const parsed = subjectFormSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    await createSubject(session, parsed.data);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function updateSubjectAction(id: string, input: SubjectFormInput): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsed = subjectFormSchema.safeParse(input);
  if (!parsedId.success) return fail("Materia no válida.");
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    await updateSubject(session, parsedId.data, parsed.data);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function setSubjectArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success || typeof archived !== "boolean") return fail("Datos no válidos.");
  const session = await requireSession();
  try {
    await setSubjectArchived(session, parsedId.data, archived);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function deleteSubjectAction(id: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("Materia no válida.");
  const session = await requireSession();
  try {
    await deleteSubject(session, parsedId.data);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function loadDemoSubjectsAction(): Promise<ActionResult<{ created: number }>> {
  const session = await requireSession();
  try {
    const result = await seedDemoSubjects(session);
    refreshApp();
    return ok({ created: result.created });
  } catch (error) {
    return fail(messageFromError(error));
  }
}
