"use server";

import { revalidatePath } from "next/cache";

import { profileFormSchema, type ProfileFormInput } from "@/schemas/profile";
import { fail, invalidInput, ok, type ActionResult } from "@/server/action-result";
import { requireSession } from "@/server/auth";
import { messageFromError } from "@/server/errors";
import { updateProfile } from "@/server/services/profiles";

export async function updateProfileAction(input: ProfileFormInput): Promise<ActionResult> {
  const parsed = profileFormSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const session = await requireSession();
  try {
    await updateProfile(session, parsed.data);
  } catch (error) {
    return fail(messageFromError(error));
  }
  revalidatePath("/", "layout");
  return ok();
}
