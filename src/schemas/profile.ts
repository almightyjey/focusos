import { z } from "zod";

import { isValidTimeZone } from "@/domain/datetime";
import { optionalText } from "@/schemas/common";

export const WEEK_START_OPTIONS = ["1", "0", "6"] as const;

export const profileFormSchema = z.object({
  displayName: optionalText(80, "Nombre"),
  timezone: z.string().trim().min(1, "Elige una zona horaria").refine(isValidTimeZone, {
    message: "Zona horaria no válida",
  }),
  weekStartsOn: z
    .enum(WEEK_START_OPTIONS, { message: "Elige el primer día de la semana" })
    .transform(Number),
});

export type ProfileFormInput = z.input<typeof profileFormSchema>;
export type ProfileFormValues = z.output<typeof profileFormSchema>;
