import "server-only";

import { z } from "zod";

// Variables solo del servidor: nunca llevan el prefijo NEXT_PUBLIC_, así que
// Next no las incrusta en el bundle del navegador. Todas son opcionales: sin
// ellas la app funciona y las integraciones aparecen como "no configuradas".

/** "" en .env equivale a no definir la variable. */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const fields = {
  SUPABASE_SECRET_KEY: optionalString.refine((key) => !key?.startsWith("sb_publishable_"), {
    message: "contiene la clave pública, no la secreta",
  }),
  /** 32 bytes en base64 para cifrar los tokens de integraciones. */
  INTEGRATIONS_ENCRYPTION_KEY: optionalString.refine(
    (key) => key === undefined || Buffer.from(key, "base64").length === 32,
    { message: "debe ser 32 bytes en base64 (openssl rand -base64 32)" },
  ),
  AI_PROVIDER: optionalString.pipe(
    z.enum(["anthropic", "openai", "fake"], { message: "debe ser anthropic u openai" }).optional(),
  ),
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: optionalString,
  NOTION_CLIENT_ID: optionalString,
  NOTION_CLIENT_SECRET: optionalString,
};

type FieldName = keyof typeof fields;

export type ServerEnv = { [K in FieldName]: z.output<(typeof fields)[K]> } & {
  /** Variables con un valor no válido (se ignoran). Solo nombres, nunca valores. */
  problems: string[];
};

/**
 * Lee y valida las variables del servidor. Una variable mal escrita no tumba la
 * app: se descarta y queda anotada en `problems` para mostrarlo en Ajustes.
 * Sin caché, para que las pruebas puedan cambiar el entorno.
 */
export function getServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const name of Object.keys(fields) as FieldName[]) {
    const parsed = fields[name].safeParse(source[name]);
    if (parsed.success) {
      result[name] = parsed.data;
    } else {
      result[name] = undefined;
      problems.push(`${name} ${parsed.error.issues[0]?.message ?? "no es válida"}`);
    }
  }
  return { ...(result as Omit<ServerEnv, "problems">), problems };
}
