import "server-only";

import OpenAI from "openai";

import { AiProviderError, type AiProvider } from "@/integrations/ai/types";

function toAiError(error: unknown): AiProviderError {
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) {
    return new AiProviderError("auth", { cause: error });
  }
  if (error instanceof OpenAI.RateLimitError) return new AiProviderError("rate_limited", { cause: error });
  if (
    error instanceof OpenAI.BadRequestError ||
    error instanceof OpenAI.NotFoundError ||
    error instanceof OpenAI.UnprocessableEntityError
  ) {
    return new AiProviderError("bad_request", { cause: error });
  }
  return new AiProviderError("unavailable", { cause: error });
}

/** Adaptador para la Responses API de OpenAI. El modelo es obligatorio (OPENAI_MODEL). */
export function createOpenAiProvider(options: {
  apiKey: string;
  model: string;
  /** Solo para pruebas. */
  fetch?: typeof fetch;
  maxRetries?: number;
}): AiProvider {
  const { model } = options;
  const client = new OpenAI({
    apiKey: options.apiKey,
    maxRetries: options.maxRetries ?? 2,
    timeout: 60_000,
    fetch: options.fetch,
  });

  return {
    id: "openai",
    label: `OpenAI (${model})`,
    async generate(request) {
      let response: OpenAI.Responses.Response;
      try {
        response = await client.responses.create(
          {
            model,
            instructions: request.system,
            input: request.messages.map((message) => ({ role: message.role, content: message.content })),
            max_output_tokens: request.maxOutputTokens,
            // No guardar el contenido de las tareas en OpenAI.
            store: false,
            ...(request.jsonSchema
              ? {
                  text: {
                    format: {
                      type: "json_schema" as const,
                      name: request.jsonSchema.name,
                      schema: request.jsonSchema.schema,
                      strict: true,
                    },
                  },
                }
              : {}),
          },
          { signal: request.signal },
        );
      } catch (error) {
        throw toAiError(error);
      }

      if (response.status === "incomplete") {
        const reason = response.incomplete_details?.reason;
        throw new AiProviderError(reason === "content_filter" ? "refused" : "truncated", { cause: reason });
      }
      if (response.status === "failed") throw new AiProviderError("unavailable", { cause: response.error });

      const refused = response.output.some(
        (item) => item.type === "message" && item.content.some((part) => part.type === "refusal"),
      );
      if (refused) throw new AiProviderError("refused");

      const text = response.output_text;
      if (text.trim() === "") throw new AiProviderError("bad_response");

      return {
        text,
        provider: "openai",
        model: response.model,
        usage: response.usage
          ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
          : null,
      };
    },
  };
}
