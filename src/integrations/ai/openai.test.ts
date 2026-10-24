import { describe, expect, it } from "vitest";

import { createOpenAiProvider } from "@/integrations/ai/openai";
import { fakeFetch } from "@/integrations/ai/test-fetch";
import { AiProviderError, type AiRequest } from "@/integrations/ai/types";

function response(overrides: Record<string, unknown> = {}, content: unknown[] = [{ type: "output_text", text: '{"ok":true}', annotations: [] }]) {
  return {
    id: "resp_test",
    object: "response",
    created_at: 1,
    status: "completed",
    model: "gpt-test",
    error: null,
    incomplete_details: null,
    output: [{ type: "message", id: "msg_1", role: "assistant", status: "completed", content }],
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    ...overrides,
  };
}

const request: AiRequest = {
  system: "Instrucciones",
  messages: [{ role: "user", content: "Hola" }],
  maxOutputTokens: 4000,
  jsonSchema: { name: "prueba", schema: { type: "object", properties: {}, required: [], additionalProperties: false } },
};

function provider(fetchImpl: typeof fetch) {
  return createOpenAiProvider({ apiKey: "sk-openai-test", model: "gpt-test", fetch: fetchImpl, maxRetries: 0 });
}

describe("adaptador de OpenAI", () => {
  it("usa la Responses API con esquema estricto y sin guardar el contenido", async () => {
    const fake = fakeFetch({ status: 200, body: response() });
    const result = await provider(fake.fetch).generate(request);

    const [sent] = fake.requests;
    expect(sent!.url).toMatch(/\/responses$/);
    expect(sent!.headers.get("authorization")).toBe("Bearer sk-openai-test");
    expect(sent!.body).toMatchObject({
      model: "gpt-test",
      instructions: "Instrucciones",
      input: [{ role: "user", content: "Hola" }],
      max_output_tokens: 4000,
      store: false,
      text: { format: { type: "json_schema", name: "prueba", strict: true, schema: request.jsonSchema!.schema } },
    });
    expect(result).toEqual({
      text: '{"ok":true}',
      provider: "openai",
      model: "gpt-test",
      usage: { inputTokens: 10, outputTokens: 20 },
    });
  });

  it("detecta la negativa del modelo", async () => {
    const fake = fakeFetch({ status: 200, body: response({}, [{ type: "refusal", refusal: "No puedo ayudar con eso." }]) });
    await expect(provider(fake.fetch).generate(request)).rejects.toMatchObject({ code: "refused" });
  });

  it("marca como incompleta una respuesta cortada", async () => {
    const fake = fakeFetch({
      status: 200,
      body: response({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } }),
    });
    await expect(provider(fake.fetch).generate(request)).rejects.toMatchObject({ code: "truncated" });
  });

  it("trata el filtro de contenido como negativa", async () => {
    const fake = fakeFetch({
      status: 200,
      body: response({ status: "incomplete", incomplete_details: { reason: "content_filter" } }),
    });
    await expect(provider(fake.fetch).generate(request)).rejects.toMatchObject({ code: "refused" });
  });

  it.each([
    [401, "auth"],
    [429, "rate_limited"],
    [400, "bad_request"],
    [503, "unavailable"],
  ])("traduce el HTTP %i a %s", async (status, code) => {
    const fake = fakeFetch({ status, body: { error: { message: "x", type: "error", code: null } } });
    const promise = provider(fake.fetch).generate(request);
    await expect(promise).rejects.toBeInstanceOf(AiProviderError);
    await expect(promise).rejects.toMatchObject({ code });
  });
});
