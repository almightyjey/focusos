import { z } from "zod";

import { isValidTimeZone } from "@/domain/datetime";
import { optionalText } from "@/schemas/common";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Escribe un correo válido" }));

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Escribe tu contraseña").max(72, "Máximo 72 caracteres"),
});

export const signUpSchema = z.object({
  displayName: optionalText(80, "Nombre"),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Usa al menos 8 caracteres")
    .max(72, "Máximo 72 caracteres"),
  // Detectada en el navegador; si no es válida, el servidor usa la predeterminada.
  timezone: z.string().refine(isValidTimeZone).optional().catch(undefined),
});

export type SignInInput = z.input<typeof signInSchema>;
export type SignInValues = z.output<typeof signInSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type SignUpValues = z.output<typeof signUpSchema>;

/** Solo rutas internas para evitar redirecciones abiertas. */
export function safeRedirectPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
