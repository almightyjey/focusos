import { z } from "zod";

import { isValidDateInput } from "@/domain/datetime";
import { parseDecimal } from "@/domain/grades";
import { GRADE_CATEGORIES } from "@/domain/types";
import { optionalText } from "@/schemas/common";

/** Número opcional con hasta 2 decimales; "" = desconocido. */
function optionalDecimal(label: string, check: (value: number) => boolean, rangeMessage: string) {
  return z
    .string()
    .transform((value, ctx) => {
      const parsed = parseDecimal(value);
      if (Number.isNaN(parsed)) {
        ctx.addIssue({ code: "custom", message: `${label}: usa un número con hasta 2 decimales` });
        return z.NEVER;
      }
      return parsed;
    })
    .refine((value) => value === null || check(value), rangeMessage);
}

export const gradeItemFormSchema = z.object({
  title: z.string().trim().min(1, "Escribe el nombre de la evaluación").max(160, "Máximo 160 caracteres"),
  category: z.enum(GRADE_CATEGORIES, { message: "Elige un tipo" }),
  score: optionalDecimal("Nota", (v) => v >= 0 && v <= 99999.99, "La nota no puede ser negativa"),
  maxScore: optionalDecimal("Nota máxima", (v) => v > 0 && v <= 99999.99, "La nota máxima debe ser mayor que 0"),
  weight: optionalDecimal("Ponderación", (v) => v > 0 && v <= 100, "La ponderación va de 0 a 100 %"),
  /** YYYY-MM-DD local o "" si no hay fecha. */
  dueDate: z.string().refine((value) => value === "" || isValidDateInput(value), "Fecha no válida"),
  notes: optionalText(2000, "Notas"),
});

export type GradeItemFormInput = z.input<typeof gradeItemFormSchema>;
export type GradeItemFormValues = z.output<typeof gradeItemFormSchema>;
