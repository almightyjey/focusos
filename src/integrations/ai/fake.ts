import "server-only";

import type { AiProvider } from "@/integrations/ai/types";

/**
 * Respuestas fijas por nombre de esquema. Permiten probar la interfaz de punta
 * a punta sin red ni claves; el registro lo bloquea en producción.
 */
const CANNED: Record<string, unknown> = {
  task_steps: {
    steps: [
      { title: "Releer el enunciado y anotar dudas", minutes: 10 },
      { title: "Resolver la primera parte", minutes: 25 },
      { title: "Revisar y entregar", minutes: 15 },
    ],
    notes: "Sugerencia de prueba: no la generó ninguna IA.",
  },
};

export function createFakeProvider(): AiProvider {
  return {
    id: "fake",
    label: "Proveedor de prueba (sin IA real)",
    async generate(request) {
      const canned = request.jsonSchema ? CANNED[request.jsonSchema.name] : undefined;
      return {
        text: canned === undefined ? "Respuesta de prueba." : JSON.stringify(canned),
        provider: "fake",
        model: "fake",
        usage: null,
      };
    },
  };
}
