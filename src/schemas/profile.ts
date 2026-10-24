import { z } from "zod";

import { isValidTimeInput, isValidTimeZone, timeToMinutes } from "@/domain/datetime";
import { optionalText } from "@/schemas/common";

export const WEEK_START_OPTIONS = ["1", "0", "6"] as const;

/** "HH:mm" → minutos desde la medianoche; "24:00" también vale como fin del día. */
const windowTime = (label: string) =>
  z
    .string()
    .refine((value) => isValidTimeInput(value) || value === "24:00", `${label}: usa el formato HH:mm`)
    .transform(timeToMinutes);

export const profileFormSchema = z
  .object({
    displayName: optionalText(80, "Nombre"),
    timezone: z.string().trim().min(1, "Elige una zona horaria").refine(isValidTimeZone, {
      message: "Zona horaria no válida",
    }),
    weekStartsOn: z
      .enum(WEEK_START_OPTIONS, { message: "Elige el primer día de la semana" })
      .transform(Number),
    studyStart: windowTime("Inicio"),
    studyEnd: windowTime("Fin"),
  })
  .refine((values) => values.studyStart < 1440, {
    path: ["studyStart"],
    message: "El inicio debe ser antes de las 24:00",
  })
  .refine((values) => values.studyEnd > values.studyStart, {
    path: ["studyEnd"],
    message: "Debe ser posterior a la hora de inicio",
  });

export type ProfileFormInput = z.input<typeof profileFormSchema>;
export type ProfileFormValues = z.output<typeof profileFormSchema>;
