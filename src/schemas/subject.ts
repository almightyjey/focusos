import { z } from "zod";

import { PRIORITY_LEVELS } from "@/domain/types";
import { hexColorSchema, optionalText } from "@/schemas/common";

export const subjectFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe el nombre de la materia")
    .max(120, "Máximo 120 caracteres"),
  code: optionalText(20, "Código"),
  color: hexColorSchema,
  priority: z.enum(PRIORITY_LEVELS, { message: "Elige una prioridad" }),
});

export type SubjectFormInput = z.input<typeof subjectFormSchema>;
export type SubjectFormValues = z.output<typeof subjectFormSchema>;
