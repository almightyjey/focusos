import { describe, expect, it } from "vitest";

import { createAnthropicProvider, supportsServerFallback } from "@/integrations/ai/anthropic";
import { fakeFetch } from "@/integrations/ai/test-fetch";
import { AiProviderError, type AiRequest } from "@/integrations/ai/types";

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text: '{"steps":[],"notes":""}' }],
    stop_reason: "end_turn",
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 12, output_tokens: 34 },
    ...overrides,
  };
}

const request: AiRequest = {
  system: "Instrucciones",
  messages: [{ role: "user", content: "Hola" }],
  maxOutputTokens: 4000,
  jsonSchema: { name: "prueba", schema: { type: "object", properties: {}, required: [], additionalProperties: false } },
};

function provider(fetchImpl: typeof fetch, model?: string) {
  return createAnthropicProvider({ apiKey: "sk-ant-test", model, fetch: fetchImpl, maxRetries: 0 });
}

describe("adaptador de Anthropic", () => {
  it("envía modelo, sistema, esquema y el respaldo del servidor", async () => {
    const fake = fakeFetch({ status: 200, body: message() });
    const result = await provider(fake.fetch).generate(request);

    expect(fake.requests).toHaveLength(1);
    const [sent] = fake.requests;
    expect(sent!.url).toContain("/v1/messages");
    // El SDK 1.x envía la clave como Bearer; nunca en el cuerpo.
    expect(sent!.headers.get("authorization")).toBe("Bearer sk-ant-test");
    expect(JSON.stringify(sent!.body)).not.toContain("sk-ant-test");
    expect(sent!.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(sent!.body).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      system: "Instrucciones",
      messages: [{ role: "user", content: "Hola" }],
      fallbacks: "default",
      output_config: { format: { type: "json_schema", schema: request.jsonSchema!.schema } },
    });
    expect(sent!.body).not.toHaveProperty("betas");
    expect(result).toEqual({
      text: '{"steps":[],"notes":""}',
      provider: "anthropic",
      model: "claude-opus-5-5",
      usage: { inputTokens: 12, outputTokens: 34 },
    });
  });

  it("informa el modelo que respondió si actuó el respaldo", async () => {
    const fake = fakeFetch({ status: 200, body: message({ model: "claude-opus-4-8" }) });
    const result = await provider(fake.fetch).generate(request);
    expect(result.model).toBe("claude-opus-4-8");
  });

  it("no pide respaldo a modelos que no lo admiten", async () => {
    const fake = fakeFetch({ status: 200, body: message({ model: "claude-haiku-5-5" }) });
    await provider(fake.fetch, "claude-haiku-5-5").generate(request);
    expect(fake.requests[0]!.headers.get("anthropic-beta")).toBeNull();
    expect(fake.requests[0]!.body).not.toHaveProperty("fallbacks");
  });

  it("trata la negativa del modelo antes de leer el contenido", async () => {
    const fake = fakeFetch({
      status: 200,
      body: message({
        content: [],
        stop_reason: "refusal",
        stop_details: { type: "refusal", category: null, explanation: null },
      }),
    });
    await expect(provider(fake.fetch).generate(request)).rejects.toMatchObject({ code: "refused" });
  });

  it("marca como incompleta una respuesta cortada por max_tokens", async () => {
    const fake = fakeFetch({ status: 200, body: message({ stop_reason: "max_tokens" }) });
    await expect(provider(fake.fetch).generate(request)).rejects.toMatchObject({ code: "truncated" });
  });

  it("rechaza una respuesta sin texto", async () => {
    const fake = fakeFetch({ status: 200, body: message({ content: [] }) });
    await expect(provider(fake.fetch).generate(request)).rejects.toMatchObject({ code: "bad_response" });
  });

  it.each([
    [401, "authentication_error", "auth"],
    [403, "permission_error", "auth"],
    [429, "rate_limit_error", "rate_limited"],
    [400, "invalid_request_error", "bad_request"],
    [500, "api_error", "unavailable"],
    [529, "overloaded_error", "unavailable"],
  ])("traduce el HTTP %i a %s → %s", async (status, type, code) => {
    const fake = fakeFetch({ status, body: { type: "error", error: { type, message: "x" } } });
    const promise = provider(fake.fetch).generate(request);
    await expect(promise).rejects.toBeInstanceOf(AiProviderError);
    await expect(promise).rejects.toMatchObject({ code });
  });

  it.each([
    ["claude-opus-5-5", true],
    ["claude-opus-5", true],
    ["claude-sonnet-5-5", true],
    ["claude-fable-5-1", true],
    ["claude-haiku-5-5", false],
    ["claude-opus-4-8", false],
    ["claude-opus-50", false],
  ])("respaldo del servidor para %s: %s", (model, expected) => {
    expect(supportsServerFallback(model)).toBe(expected);
  });
});
