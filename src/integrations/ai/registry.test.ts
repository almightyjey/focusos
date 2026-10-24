import { afterEach, describe, expect, it, vi } from "vitest";

import { getAiProvider, getAssistantStatus } from "@/integrations/ai/registry";
import { getServerEnv } from "@/lib/server-env";

const env = (values: Record<string, string>) => getServerEnv(values as NodeJS.ProcessEnv);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("registro de proveedores de IA", () => {
  it("sin claves, la IA queda desactivada con un motivo", () => {
    expect(getAiProvider(env({}))).toBeNull();
    expect(getAssistantStatus(env({}))).toEqual({
      enabled: false,
      reason: "Falta ANTHROPIC_API_KEY u OPENAI_API_KEY en el servidor.",
    });
  });

  it("con solo la clave de Anthropic usa Claude con el modelo por defecto", () => {
    const status = getAssistantStatus(env({ ANTHROPIC_API_KEY: "sk-ant" }));
    expect(status).toEqual({ enabled: true, label: "Claude (claude-opus-5-5)" });
    expect(getAiProvider(env({ ANTHROPIC_API_KEY: "sk-ant" }))?.id).toBe("anthropic");
  });

  it("respeta ANTHROPIC_MODEL", () => {
    const status = getAssistantStatus(env({ ANTHROPIC_API_KEY: "sk-ant", ANTHROPIC_MODEL: "claude-sonnet-5-5" }));
    expect(status).toEqual({ enabled: true, label: "Claude (claude-sonnet-5-5)" });
  });

  it("con dos claves exige elegir con AI_PROVIDER", () => {
    const both = { ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "b", OPENAI_MODEL: "gpt-test" };
    expect(getAssistantStatus(env(both))).toMatchObject({ enabled: false });
    expect(getAiProvider(env({ ...both, AI_PROVIDER: "openai" }))?.id).toBe("openai");
  });

  it("OpenAI necesita el modelo explícito", () => {
    expect(getAssistantStatus(env({ OPENAI_API_KEY: "b" }))).toEqual({
      enabled: false,
      reason: "Falta OPENAI_MODEL: indica qué modelo de OpenAI usar.",
    });
  });

  it("AI_PROVIDER sin su clave no se activa", () => {
    expect(getAssistantStatus(env({ AI_PROVIDER: "anthropic", OPENAI_API_KEY: "b" }))).toMatchObject({
      enabled: false,
    });
  });

  it("el proveedor de prueba se bloquea en producción", () => {
    expect(getAiProvider(env({ AI_PROVIDER: "fake" }))?.id).toBe("fake");
    vi.stubEnv("NODE_ENV", "production");
    expect(getAiProvider(env({ AI_PROVIDER: "fake" }))).toBeNull();
  });

  it("reutiliza el cliente mientras la configuración no cambie", () => {
    const first = getAiProvider(env({ ANTHROPIC_API_KEY: "sk-1" }));
    expect(getAiProvider(env({ ANTHROPIC_API_KEY: "sk-1" }))).toBe(first);
    expect(getAiProvider(env({ ANTHROPIC_API_KEY: "sk-2" }))).not.toBe(first);
  });
});

describe("variables del servidor", () => {
  it("trata los valores vacíos como no definidos", () => {
    const parsed = env({ ANTHROPIC_API_KEY: "  ", AI_PROVIDER: "" });
    expect(parsed.ANTHROPIC_API_KEY).toBeUndefined();
    expect(parsed.AI_PROVIDER).toBeUndefined();
    expect(parsed.problems).toEqual([]);
  });

  it("descarta valores no válidos y solo informa el nombre", () => {
    const parsed = env({
      AI_PROVIDER: "gemini",
      INTEGRATIONS_ENCRYPTION_KEY: "corta",
      SUPABASE_SECRET_KEY: "sb_publishable_abc",
    });
    expect(parsed.AI_PROVIDER).toBeUndefined();
    expect(parsed.INTEGRATIONS_ENCRYPTION_KEY).toBeUndefined();
    expect(parsed.SUPABASE_SECRET_KEY).toBeUndefined();
    expect(parsed.problems).toHaveLength(3);
    expect(parsed.problems.join(" ")).not.toContain("sb_publishable_abc");
  });

  it("acepta una clave de cifrado de 32 bytes", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    expect(env({ INTEGRATIONS_ENCRYPTION_KEY: key }).INTEGRATIONS_ENCRYPTION_KEY).toBe(key);
  });
});
