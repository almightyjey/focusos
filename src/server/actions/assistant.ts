"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formatStepsChecklist, taskStepSchema, MAX_STEPS } from "@/integrations/ai/task-steps";
import { idSchema } from "@/schemas/common";
import { fail, ok, type ActionResult } from "@/server/action-result";
import { requireSession } from "@/server/auth";
import { messageFromError } from "@/server/errors";
import { suggestTaskSteps, type TaskStepsResult } from "@/server/services/assistant";
import { getProfile } from "@/server/services/profiles";
import { appendToTaskDescription } from "@/server/services/tasks";

export async function suggestTaskStepsAction(taskId: string): Promise<ActionResult<TaskStepsResult>> {
  const parsedId = idSchema.safeParse(taskId);
  if (!parsedId.success) return fail("Tarea no válida.");
  const session = await requireSession();
  try {
    const profile = await getProfile(session);
    return ok(await suggestTaskSteps(session, parsedId.data, profile.timezone));
  } catch (error) {
    return fail(messageFromError(error));
  }
}

const applyStepsSchema = z.object({
  steps: z.array(taskStepSchema).min(1).max(MAX_STEPS),
  useAsEstimate: z.boolean(),
});

/** Añade los pasos revisados por el usuario a la descripción de la tarea. */
export async function applyTaskStepsAction(
  taskId: string,
  input: z.input<typeof applyStepsSchema>,
): Promise<ActionResult> {
  const parsedId = idSchema.safeParse(taskId);
  const parsed = applyStepsSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return fail("Datos no válidos.");
  const session = await requireSession();
  const { steps, useAsEstimate } = parsed.data;
  try {
    const total = steps.reduce((sum, step) => sum + step.minutes, 0);
    await appendToTaskDescription(session, parsedId.data, formatStepsChecklist(steps), useAsEstimate ? total : undefined);
  } catch (error) {
    return fail(messageFromError(error));
  }
  revalidatePath("/", "layout");
  return ok();
}
