import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";

import { AiProviderError } from "@/integrations/ai/types";
import { IntegrationError } from "@/integrations/errors";

/** Error de la capa de datos con un mensaje apto para mostrar al usuario. */
export class DataError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "conflict" | "invalid" | "unknown" = "unknown",
  ) {
    super(message);
    this.name = "DataError";
  }
}

const MESSAGES: Record<string, { message: string; code: DataError["code"] }> = {
  "23505": { message: "Ya existe un registro con esos datos.", code: "conflict" },
  "23503": { message: "El elemento relacionado no existe o no es tuyo.", code: "invalid" },
  "23514": { message: "Algún valor está fuera del rango permitido.", code: "invalid" },
  "22023": { message: "Algún valor no es válido.", code: "invalid" },
  "42501": { message: "No tienes permiso para hacer esto.", code: "invalid" },
};

/** Traduce errores de PostgREST sin filtrar detalles internos al cliente. */
export function toDataError(error: PostgrestError, overrides: Record<string, string> = {}): DataError {
  const known = MESSAGES[error.code];
  if (!known) {
    console.error("[data] Error inesperado de Supabase", { code: error.code, message: error.message });
    return new DataError("No se pudo completar la operación. Inténtalo de nuevo.");
  }
  return new DataError(overrides[error.code] ?? known.message, known.code);
}

export function messageFromError(error: unknown): string {
  if (error instanceof DataError || error instanceof AiProviderError || error instanceof IntegrationError) {
    return error.message;
  }
  console.error("[action] Error inesperado", error);
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
