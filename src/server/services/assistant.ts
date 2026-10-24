import "server-only";

import { formatLongDate, utcToZonedInput } from "@/domain/datetime";
import { TASK_KIND_LABELS } from "@/domain/labels";
import { getAiProvider } from "@/integrations/ai/registry";
import { buildTaskStepsRequest, parseTaskSteps, type TaskStepsSuggestion } from "@/integrations/ai/task-steps";
import { AiProviderError } from "@/integrations/ai/types";
import type { Session } from "@/server/auth";
import { DataError } from "@/server/errors";
import { getSubject } from "@/server/services/subjects";
import { getTask } from "@/server/services/tasks";

export type TaskStepsResult = TaskStepsSuggestion & { providerLabel: string };

/**
 * Pide al proveedor configurado una división en pasos. No guarda nada: el
 * usuario revisa la sugerencia y decide si la añade a la tarea.
 */
export async function suggestTaskSteps(session: Session, taskId: string, timeZone: string): Promise<TaskStepsResult> {
  const provider = getAiProvider();
  if (!provider) throw new AiProviderError("not_configured");

  const task = await getTask(session, taskId);
  if (!task) throw new DataError("No se encontró la tarea.", "not_found");
  const subject = task.subjectId ? await getSubject(session, task.subjectId) : null;

  const request = buildTaskStepsRequest(
    {
      title: task.title,
      description: task.description,
      kindLabel: TASK_KIND_LABELS[task.kind],
      subjectName: subject?.name ?? null,
      dueLabel: task.dueAt
        ? `${formatLongDate(new Date(task.dueAt), timeZone)}, ${utcToZonedInput(task.dueAt, timeZone).time}`
        : null,
      estimatedMinutes: task.estimatedMinutes,
      difficulty: task.difficulty,
    },
    AbortSignal.timeout(90_000),
  );

  try {
    const result = await provider.generate(request);
    return { ...parseTaskSteps(result.text), providerLabel: provider.label };
  } catch (error) {
    if (error instanceof AiProviderError) {
      // Solo el tipo de fallo; nunca el contenido de la tarea.
      console.error("[ai] Falló la sugerencia de pasos", { provider: provider.id, code: error.code });
    }
    throw error;
  }
}
