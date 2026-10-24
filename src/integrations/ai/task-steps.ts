import { z } from "zod";

import { formatMinutes } from "@/domain/datetime";
import { AiProviderError, type AiRequest } from "@/integrations/ai/types";

// Caso de uso: dividir una tarea en pasos. Es independiente del proveedor: arma
// la petición común y valida la respuesta, sea cual sea el modelo.

export const TASK_STEPS_SCHEMA_NAME = "task_steps";

export const MAX_STEPS = 8;
const MAX_DESCRIPTION_CHARS = 2000;

/** Subconjunto de JSON Schema que aceptan Anthropic y OpenAI (modo estricto). */
const TASK_STEPS_JSON_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          minutes: { type: "integer" },
        },
        required: ["title", "minutes"],
        additionalProperties: false,
      },
    },
    notes: { type: "string" },
  },
  required: ["steps", "notes"],
  additionalProperties: false,
};

export const taskStepSchema = z.object({
  title: z.string().trim().min(1).max(120),
  minutes: z.number().int().min(5).max(240),
});

export const taskStepsSchema = z.object({
  steps: z.array(taskStepSchema).min(1).max(MAX_STEPS),
  notes: z.string().trim().max(500),
});

export type TaskStep = z.output<typeof taskStepSchema>;
export type TaskStepsSuggestion = z.output<typeof taskStepsSchema>;

const SYSTEM_PROMPT = `Eres el asistente de estudio de FocusOS. Ayudas a un estudiante universitario a dividir una tarea en pasos concretos que pueda hacer en sesiones de estudio.

Reglas:
- Entre 2 y 6 pasos, en el orden en que conviene hacerlos. Cada paso empieza con un verbo y cabe en una línea.
- minutes: minutos enteros estimados para cada paso, entre 5 y 120. Si la tarea trae una estimación, procura que la suma se acerque a ella.
- Usa solo la información de la tarea. No inventes fechas, calificaciones, requisitos ni contenidos del curso que no aparezcan.
- Si la tarea es demasiado vaga para dividirla bien, propone pasos generales y dilo en notes.
- notes: una o dos frases; cadena vacía si no hace falta aclarar nada.
- Escribe en español.`;

export type TaskStepsInput = {
  title: string;
  description: string | null;
  kindLabel: string;
  subjectName: string | null;
  /** Fecha límite ya formateada en la zona del usuario. */
  dueLabel: string | null;
  estimatedMinutes: number | null;
  difficulty: number | null;
};

export function buildTaskStepsRequest(task: TaskStepsInput, signal?: AbortSignal): AiRequest {
  const lines = [
    `Título: ${task.title}`,
    `Tipo: ${task.kindLabel}`,
    task.subjectName ? `Materia: ${task.subjectName}` : null,
    task.dueLabel ? `Fecha límite: ${task.dueLabel}` : null,
    task.estimatedMinutes ? `Estimación: ${formatMinutes(task.estimatedMinutes)}` : null,
    task.difficulty ? `Dificultad: ${task.difficulty} de 5` : null,
    task.description ? `Descripción:\n${task.description.slice(0, MAX_DESCRIPTION_CHARS)}` : null,
  ].filter((line) => line !== null);

  return {
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Divide esta tarea en pasos.\n\n<tarea>\n${lines.join("\n")}\n</tarea>`,
      },
    ],
    maxOutputTokens: 4000,
    jsonSchema: { name: TASK_STEPS_SCHEMA_NAME, schema: TASK_STEPS_JSON_SCHEMA },
    signal,
  };
}

/**
 * Valida la respuesta del modelo. Ajusta lo que es seguro ajustar (recorta
 * textos, redondea y acota minutos, descarta pasos de más) y rechaza el resto.
 */
export function parseTaskSteps(text: string): TaskStepsSuggestion {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new AiProviderError("bad_response", { cause: error });
  }

  const loose = z
    .object({
      steps: z.array(z.object({ title: z.string(), minutes: z.number() })),
      notes: z.string().optional(),
    })
    .safeParse(raw);
  if (!loose.success) throw new AiProviderError("bad_response", { cause: loose.error });

  const normalized = {
    steps: loose.data.steps
      .map((step) => ({
        title: step.title.trim().replace(/\s+/g, " ").slice(0, 120),
        minutes: Math.min(240, Math.max(5, Math.round(step.minutes))),
      }))
      .filter((step) => step.title !== "")
      .slice(0, MAX_STEPS),
    notes: (loose.data.notes ?? "").trim().slice(0, 500),
  };

  const strict = taskStepsSchema.safeParse(normalized);
  if (!strict.success) throw new AiProviderError("bad_response", { cause: strict.error });
  return strict.data;
}

export const STEPS_HEADING = "Pasos sugeridos:";

/** Lista de verificación en texto plano para añadir a la descripción. */
export function formatStepsChecklist(steps: TaskStep[]): string {
  return [STEPS_HEADING, ...steps.map((step) => `- [ ] ${step.title} (${formatMinutes(step.minutes)})`)].join("\n");
}
