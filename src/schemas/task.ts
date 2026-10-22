import { z } from "zod";

import { isValidDateInput, isValidTimeInput } from "@/domain/datetime";
import { PRIORITY_LEVELS, TASK_KINDS } from "@/domain/types";
import { NONE, optionalText } from "@/schemas/common";

export const DIFFICULTY_OPTIONS = ["1", "2", "3", "4", "5"] as const;

export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, "Escribe qué hay que hacer").max(200, "Máximo 200 caracteres"),
    description: optionalText(5000, "Descripción"),
    subjectId: z
      .string()
      .transform((value) => (value === NONE ? null : value))
      .pipe(z.uuid({ message: "Materia no válida" }).nullable()),
    kind: z.enum(TASK_KINDS, { message: "Elige un tipo" }),
    priority: z.enum(PRIORITY_LEVELS, { message: "Elige una prioridad" }),
    /** YYYY-MM-DD en la zona del usuario, o "" si no hay fecha límite. */
    dueDate: z
      .string()
      .refine((value) => value === "" || isValidDateInput(value), "Fecha no válida"),
    /** HH:mm en la zona del usuario, o "" para usar el final del día. */
    dueTime: z
      .string()
      .refine((value) => value === "" || isValidTimeInput(value), "Hora no válida"),
    estimatedMinutes: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d+$/.test(value), "Usa minutos enteros")
      .transform((value) => (value === "" ? null : Number(value)))
      .refine(
        (value) => value === null || (value >= 1 && value <= 10080),
        "Entre 1 y 10 080 minutos",
      ),
    difficulty: z
      .enum([NONE, ...DIFFICULTY_OPTIONS], { message: "Dificultad no válida" })
      .transform((value) => (value === NONE ? null : Number(value))),
  })
  .superRefine((values, ctx) => {
    if (values.dueTime !== "" && values.dueDate === "") {
      ctx.addIssue({ code: "custom", path: ["dueDate"], message: "Indica también la fecha" });
    }
  });

export type TaskFormInput = z.input<typeof taskFormSchema>;
export type TaskFormValues = z.output<typeof taskFormSchema>;

export const taskFiltersSchema = z.object({
  view: z.enum(["open", "completed"]).catch("open"),
  subject: z.uuid().optional().catch(undefined),
});

export type TaskFilters = z.output<typeof taskFiltersSchema>;
