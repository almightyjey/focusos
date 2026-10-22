"use server";

import { revalidatePath } from "next/cache";

import { idSchema } from "@/schemas/common";
import { eventFormSchema, type EventFormInput } from "@/schemas/event";
import { fail, invalidInput, ok, type ActionResult } from "@/server/action-result";
import { requireSession } from "@/server/auth";
import { messageFromError } from "@/server/errors";
import { createEvent, deleteEvent, updateEvent } from "@/server/services/events";
import { getProfile } from "@/server/services/profiles";

function refreshApp() {
  revalidatePath("/", "layout");
}

export async function createEventAction(input: EventFormInput): Promise<ActionResult> {
  const parsed = eventFormSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    const profile = await getProfile(session);
    await createEvent(session, parsed.data, profile.timezone);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function updateEventAction(id: string, input: EventFormInput): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  const parsed = eventFormSchema.safeParse(input);
  if (!parsedId.success) return fail("Evento no válido.");
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    const profile = await getProfile(session);
    await updateEvent(session, parsedId.data, parsed.data, profile.timezone);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}

export async function deleteEventAction(id: string): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail("Evento no válido.");
  const session = await requireSession();
  try {
    await deleteEvent(session, parsedId.data);
  } catch (error) {
    return fail(messageFromError(error));
  }
  refreshApp();
  return ok();
}
