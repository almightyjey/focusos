import { z } from "zod";

import { isValidDateInput, isValidTimeInput } from "@/domain/datetime";
import { NONE, optionalText } from "@/schemas/common";

/**
 * Qué se estudia: "task:<uuid>", "subject:<uuid>" o "none". Un solo campo
 * evita combinaciones contradictorias (una tarea con otra materia).
 */
export const sessionTargetSchema = z
  .string()
  .transform((value, ctx) => {
    if (value === NONE) return { taskId: null, subjectId: null };
    const [kind, id] = value.split(":");
    const parsed = z.uuid().safeParse(id);
    if ((kind !== "task" && kind !== "subject") || !parsed.success) {
      ctx.addIssue({ code: "custom", message: "Elige qué vas a estudiar" });
      return z.NEVER;
    }
    return kind === "task" ? { taskId: parsed.data, subjectId: null } : { taskId: null, subjectId: parsed.data };
  });

const minutesField = (max: number, label: string) =>
  z
    .string()
    .trim()
    .refine((value) => /^\d+$/.test(value), `${label}: usa minutos enteros`)
    .transform(Number)
    .refine((value) => value >= 1 && value <= max, `${label}: entre 1 y ${max} minutos`);

export const startSessionSchema = z.object({
  target: sessionTargetSchema,
  /** "" = sin límite */
  plannedMinutes: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), "Usa minutos enteros")
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || (value >= 1 && value <= 480), "Entre 1 y 480 minutos"),
});

export const finishSessionSchema = z.object({
  /** "" = registrar exactamente lo medido */
  focusMinutes: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), "Usa minutos enteros")
    .transform((value) => (value === "" ? null : Number(value)))
    .refine((value) => value === null || value <= 1440, "Máximo 1440 minutos"),
  notes: optionalText(2000, "Notas"),
  completeTask: z.boolean(),
});

export const manualSessionSchema = z.object({
  target: sessionTargetSchema,
  date: z.string().refine(isValidDateInput, "Fecha no válida"),
  startTime: z.string().refine(isValidTimeInput, "Indica la hora de inicio"),
  minutes: minutesField(720, "Duración"),
  notes: optionalText(2000, "Notas"),
});

export type StartSessionInput = z.input<typeof startSessionSchema>;
export type FinishSessionInput = z.input<typeof finishSessionSchema>;
export type ManualSessionInput = z.input<typeof manualSessionSchema>;
export type ManualSessionValues = z.output<typeof manualSessionSchema>;
