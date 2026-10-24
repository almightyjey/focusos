// Errores de integraciones externas (Notion y las que vengan), con mensajes
// aptos para mostrar. El error original queda en `cause` para los registros.

export type IntegrationErrorCode =
  | "not_configured"
  | "not_connected"
  | "auth"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "invalid_settings";

const MESSAGES: Record<IntegrationErrorCode, string> = {
  not_configured: "Esta integración no está configurada en el servidor.",
  not_connected: "Primero conecta tu cuenta.",
  auth: "El acceso expiró o se revocó. Vuelve a conectar la cuenta.",
  not_found: "No se encontró la base de datos. Comprueba que la compartiste con FocusOS.",
  rate_limited: "El servicio está limitando las peticiones. Prueba en unos minutos.",
  unavailable: "El servicio no respondió. Prueba de nuevo más tarde.",
  invalid_settings: "La configuración de la importación no es válida. Revísala.",
};

export class IntegrationError extends Error {
  constructor(
    readonly code: IntegrationErrorCode,
    options?: { cause?: unknown; message?: string },
  ) {
    super(options?.message ?? MESSAGES[code], { cause: options?.cause });
    this.name = "IntegrationError";
  }
}
