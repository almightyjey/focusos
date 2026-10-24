import "server-only";

import type { ReactNode } from "react";

import { AssistantStatusProvider } from "@/components/assistant/assistant-status";
import { getAssistantStatus } from "@/integrations/ai/registry";

/**
 * Lee el estado del asistente al renderizar. Debe usarse dentro de partes
 * dinámicas (después de leer la sesión): así se evalúa en cada petición y no
 * queda fijado en el HTML estático del build. En Cloudflare las claves son
 * secretos que solo existen en tiempo de ejecución.
 */
export function AssistantBoundary({ children }: { children: ReactNode }) {
  return <AssistantStatusProvider status={getAssistantStatus()}>{children}</AssistantStatusProvider>;
}
