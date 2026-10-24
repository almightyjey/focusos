// Contrato común para proveedores de IA. La app solo depende de este archivo:
// cada adaptador (anthropic.ts, openai.ts) traduce a la API de su proveedor y
// se puede cambiar uno por otro sin tocar los casos de uso ni la interfaz.

export type AiProviderId = "anthropic" | "openai" | "fake";

export type AiMessage = { role: "user" | "assistant"; content: string };

export type AiRequest = {
  /** Instrucciones de sistema. */
  system: string;
  messages: AiMessage[];
  maxOutputTokens: number;
  /**
   * Pide una respuesta JSON que cumpla este esquema. Usa el subconjunto que
   * aceptan ambos proveedores: objetos con additionalProperties: false y todas
   * las propiedades en required; sin límites numéricos ni de longitud (eso se
   * valida después con Zod).
   */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  signal?: AbortSignal;
};

export type AiResult = {
  text: string;
  provider: AiProviderId;
  /** Modelo que respondió (puede ser el de respaldo si el principal declinó). */
  model: string;
  usage: { inputTokens: number; outputTokens: number } | null;
};

export interface AiProvider {
  readonly id: AiProviderId;
  /** Nombre para mostrar, p. ej. "Claude (claude-opus-5-5)". */
  readonly label: string;
  generate(request: AiRequest): Promise<AiResult>;
}

/** Lo que la interfaz puede saber del asistente: nunca claves, solo estado. */
export type AssistantStatus = { enabled: true; label: string } | { enabled: false; reason: string };

export type AiErrorCode =
  | "not_configured"
  | "auth"
  | "rate_limited"
  | "unavailable"
  | "refused"
  | "truncated"
  | "bad_request"
  | "bad_response";

const MESSAGES: Record<AiErrorCode, string> = {
  not_configured: "El asistente de IA no está configurado en el servidor.",
  auth: "La clave del proveedor de IA no es válida o no tiene permiso.",
  rate_limited: "El proveedor de IA está limitando las peticiones. Prueba en unos minutos.",
  unavailable: "El proveedor de IA no respondió. Prueba de nuevo más tarde.",
  refused: "El proveedor de IA no quiso responder a esta petición.",
  truncated: "La respuesta de la IA quedó incompleta. Prueba de nuevo.",
  bad_request: "El proveedor de IA rechazó la petición.",
  bad_response: "La respuesta de la IA no tenía el formato esperado.",
};

/** Error de proveedor con un mensaje apto para mostrar. `cause` guarda el original. */
export class AiProviderError extends Error {
  constructor(
    readonly code: AiErrorCode,
    options?: { cause?: unknown; message?: string },
  ) {
    super(options?.message ?? MESSAGES[code], { cause: options?.cause });
    this.name = "AiProviderError";
  }
}
