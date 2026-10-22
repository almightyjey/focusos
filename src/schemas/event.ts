import { z } from "zod";

import { addDaysToKey, isValidDateInput, isValidTimeInput } from "@/domain/datetime";
import { EVENT_KINDS } from "@/domain/types";
import { NONE, optionalText } from "@/schemas/common";

/** Máximo de duración de una serie semanal: un año desde su inicio. */
export const MAX_SERIES_DAYS = 366;

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(1, "Escribe un título").max(160, "Máximo 160 caracteres"),
    kind: z.enum(EVENT_KINDS, { message: "Elige un tipo" }),
    subjectId: z
      .string()
      .transform((value) => (value === NONE ? null : value))
      .pipe(z.uuid({ message: "Materia no válida" }).nullable()),
    /** Día (o primer día de la serie) en la zona del usuario. */
    date: z.string().refine(isValidDateInput, "Fecha no válida"),
    allDay: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
    location: optionalText(160, "Lugar"),
    notes: optionalText(2000, "Notas"),
    repeat: z.enum(["none", "weekly"]),
    repeatDays: z.array(z.number().int().min(0).max(6)),
    /** Último día de la serie (inclusivo) o "" para no fijar fin. */
    repeatUntil: z.string().refine((value) => value === "" || isValidDateInput(value), "Fecha no válida"),
  })
  .superRefine((values, ctx) => {
    if (!values.allDay) {
      if (!isValidTimeInput(values.startTime)) {
        ctx.addIssue({ code: "custom", path: ["startTime"], message: "Indica la hora de inicio" });
      }
      if (!isValidTimeInput(values.endTime)) {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: "Indica la hora de fin" });
      } else if (isValidTimeInput(values.startTime) && values.endTime <= values.startTime) {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: "Debe terminar después de empezar" });
      }
    }
    if (values.repeat === "weekly") {
      if (values.repeatDays.length === 0) {
        ctx.addIssue({ code: "custom", path: ["repeatDays"], message: "Elige al menos un día" });
      }
      if (values.repeatUntil !== "" && isValidDateInput(values.date)) {
        if (values.repeatUntil < values.date) {
          ctx.addIssue({ code: "custom", path: ["repeatUntil"], message: "Debe ser igual o posterior al inicio" });
        } else if (values.repeatUntil > addDaysToKey(values.date, MAX_SERIES_DAYS)) {
          ctx.addIssue({ code: "custom", path: ["repeatUntil"], message: "Como máximo un año después del inicio" });
        }
      }
    }
  });

export type EventFormInput = z.input<typeof eventFormSchema>;
export type EventFormValues = z.output<typeof eventFormSchema>;

export const calendarSearchSchema = z.object({
  view: z.enum(["week", "month"]).catch("week"),
});
