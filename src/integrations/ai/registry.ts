import "server-only";

import { createAnthropicProvider, DEFAULT_ANTHROPIC_MODEL } from "@/integrations/ai/anthropic";
import { createFakeProvider } from "@/integrations/ai/fake";
import { createOpenAiProvider } from "@/integrations/ai/openai";
import type { AiProvider, AiProviderId, AssistantStatus } from "@/integrations/ai/types";
import { getServerEnv, type ServerEnv } from "@/lib/server-env";

type Resolution = { ok: true; create: () => AiProvider; cacheKey: string } | { ok: false; reason: string };

/** Decide qué proveedor usar según las variables del servidor. */
function resolve(env: ServerEnv, nodeEnv: string | undefined): Resolution {
  const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY);
  const hasOpenAi = Boolean(env.OPENAI_API_KEY);
  let id: AiProviderId | undefined = env.AI_PROVIDER;
  if (!id && hasAnthropic !== hasOpenAi) id = hasAnthropic ? "anthropic" : "openai";

  if (!id) {
    return {
      ok: false,
      reason:
        hasAnthropic && hasOpenAi
          ? "Hay claves de Anthropic y de OpenAI: define AI_PROVIDER para elegir una."
          : "Falta ANTHROPIC_API_KEY u OPENAI_API_KEY en el servidor.",
    };
  }

  if (id === "fake") {
    if (nodeEnv === "production") return { ok: false, reason: "El proveedor de prueba no se permite en producción." };
    return { ok: true, create: createFakeProvider, cacheKey: "fake" };
  }

  if (id === "anthropic") {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, reason: "AI_PROVIDER=anthropic, pero falta ANTHROPIC_API_KEY." };
    const model = env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
    return { ok: true, create: () => createAnthropicProvider({ apiKey, model }), cacheKey: `anthropic:${model}:${apiKey}` };
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, reason: "AI_PROVIDER=openai, pero falta OPENAI_API_KEY." };
  const model = env.OPENAI_MODEL;
  if (!model) return { ok: false, reason: "Falta OPENAI_MODEL: indica qué modelo de OpenAI usar." };
  return { ok: true, create: () => createOpenAiProvider({ apiKey, model }), cacheKey: `openai:${model}:${apiKey}` };
}

let cached: { key: string; provider: AiProvider } | undefined;

/** Proveedor configurado, o null si la IA no está disponible. */
export function getAiProvider(env: ServerEnv = getServerEnv()): AiProvider | null {
  const resolution = resolve(env, process.env.NODE_ENV);
  if (!resolution.ok) return null;
  if (cached?.key !== resolution.cacheKey) {
    cached = { key: resolution.cacheKey, provider: resolution.create() };
  }
  return cached.provider;
}

export function getAssistantStatus(env: ServerEnv = getServerEnv()): AssistantStatus {
  const resolution = resolve(env, process.env.NODE_ENV);
  if (!resolution.ok) return { enabled: false, reason: resolution.reason };
  return { enabled: true, label: getAiProvider(env)?.label ?? "Asistente" };
}
