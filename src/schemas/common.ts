import { z } from "zod";

/** Valor centinela de los <Select> para "sin valor" (Radix no admite ""). */
export const NONE = "none";

export const idSchema = z.uuid({ message: "Identificador no válido" });

/** Texto opcional: recorta espacios y convierte "" en null. */
export function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label}: máximo ${max} caracteres`)
    .transform((value) => (value === "" ? null : value));
}

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Usa un color en formato #RRGGBB");
