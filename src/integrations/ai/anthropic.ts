import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { AiProviderError, type AiProvider } from "@/integrations/ai/types";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

/** Respaldo en el servidor: si el modelo declina, la API reintenta con el recomendado. */
const SERVER_FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Los modelos Claude 5 (salvo Haiku) admiten `fallbacks: "default"`. */
export function supportsServerFallback(model: string): boolean {
  return /^claude-(opus|sonnet|fable)-5(?:$|[-.])/.test(model);
}

function toAiError(error: unknown): AiProviderError {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiProviderError("auth", { cause: error });
  }
  if (error instanceof Anthropic.RateLimitError) return new AiProviderError("rate_limited", { cause: error });
  if (
    error instanceof Anthropic.BadRequestError ||
    error instanceof Anthropic.NotFoundError ||
    error instanceof Anthropic.UnprocessableEntityError
  ) {
    return new AiProviderError("bad_request", { cause: error });
  }
  // Conexión, tiempo agotado, 5xx y sobrecarga.
  return new AiProviderError("unavailable", { cause: error });
}

export function createAnthropicProvider(options: {
  apiKey: string;
  model?: string;
  /** Solo para pruebas. */
  fetch?: typeof fetch;
  maxRetries?: number;
}): AiProvider {
  const model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
  const client = new Anthropic({
    apiKey: options.apiKey,
    maxRetries: options.maxRetries ?? 2,
    timeout: 60_000,
    fetch: options.fetch,
  });

  return {
    id: "anthropic",
    label: `Claude (${model})`,
    async generate(request) {
      let response: Anthropic.Beta.BetaMessage;
      try {
        response = await client.beta.messages.create(
          {
            model,
            max_tokens: request.maxOutputTokens,
            system: request.system,
            messages: request.messages,
            ...(supportsServerFallback(model)
              ? { betas: [SERVER_FALLBACK_BETA], fallbacks: "default" as const }
              : {}),
            ...(request.jsonSchema
              ? { output_config: { format: { type: "json_schema" as const, schema: request.jsonSchema.schema } } }
              : {}),
          },
          { signal: request.signal },
        );
      } catch (error) {
        throw toAiError(error);
      }

      // Hay que revisar el motivo de parada antes de leer el contenido.
      if (response.stop_reason === "refusal") {
        throw new AiProviderError("refused", { cause: response.stop_details });
      }
      if (response.stop_reason === "max_tokens") throw new AiProviderError("truncated");

      const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
      if (text.trim() === "") throw new AiProviderError("bad_response");

      return {
        text,
        provider: "anthropic",
        model: response.model,
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      };
    },
  };
}
