import "server-only";

import type { Client } from "@notionhq/client";

import type { Json } from "@/lib/supabase/database.types";
import { getAssistantStatus } from "@/integrations/ai/registry";
import type { AssistantStatus } from "@/integrations/ai/types";
import { IntegrationError } from "@/integrations/errors";
import {
  createNotionClient,
  getNotionSourceSchema,
  listNotionDataSources,
  notionPages,
  refreshNotionTokens,
  revokeNotionToken,
  toIntegrationError,
  type NotionOAuthConfig,
  type NotionTokens,
} from "@/integrations/notion/client";
import { mapNotionPage } from "@/integrations/notion/mapper";
import {
  mappingProblem,
  NOTION_SOURCE,
  parseNotionSettings,
  type NotionImportSettings,
  type NotionSettings,
  type NotionSourceSchema,
} from "@/integrations/notion/settings";
import { createAdminClient, type AdminClient } from "@/lib/supabase/admin";
import { getServerEnv } from "@/lib/server-env";
import type { ExternalTaskCandidate } from "@/domain/task-import";
import type { Session } from "@/server/auth";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { DataError, toDataError } from "@/server/errors";
import { getSubject } from "@/server/services/subjects";
import { applyTaskImport, type ImportOutcome } from "@/server/services/task-import";

/** Máximo de páginas por importación. */
export const NOTION_IMPORT_LIMIT = 500;

type NotionConfig = { oauth: NotionOAuthConfig; encryptionKey: string; admin: AdminClient };

/** Qué falta en el servidor para la integración con Notion (solo nombres de variables). */
function notionSetup(): { config: NotionConfig | null; missing: string[] } {
  const env = getServerEnv();
  const missing = (
    [
      ["NOTION_CLIENT_ID", env.NOTION_CLIENT_ID],
      ["NOTION_CLIENT_SECRET", env.NOTION_CLIENT_SECRET],
      ["SUPABASE_SECRET_KEY", env.SUPABASE_SECRET_KEY],
      ["INTEGRATIONS_ENCRYPTION_KEY", env.INTEGRATIONS_ENCRYPTION_KEY],
    ] as const
  )
    .filter(([, value]) => !value)
    .map(([name]) => name);
  const admin = missing.length === 0 ? createAdminClient() : null;
  if (!admin || !env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET || !env.INTEGRATIONS_ENCRYPTION_KEY) {
    return { config: null, missing };
  }
  return {
    config: {
      oauth: { clientId: env.NOTION_CLIENT_ID, clientSecret: env.NOTION_CLIENT_SECRET },
      encryptionKey: env.INTEGRATIONS_ENCRYPTION_KEY,
      admin,
    },
    missing,
  };
}

export function getNotionConfig(): NotionConfig {
  const { config } = notionSetup();
  if (!config) throw new IntegrationError("not_configured");
  return config;
}

// ---------------------------------------------------------------------------
// Estado para la interfaz
// ---------------------------------------------------------------------------

export type NotionOverview = {
  configured: boolean;
  missing: string[];
  status: "disconnected" | "connected" | "error";
  workspaceName: string | null;
  importSettings: NotionImportSettings | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export type IntegrationsOverview = {
  assistant: AssistantStatus;
  notion: NotionOverview;
  /** Variables del servidor con valores no válidos (solo nombres). */
  problems: string[];
};

async function readNotionRow(session: Session) {
  const { data, error } = await session.supabase
    .from("integrations")
    .select("status, settings, last_synced_at, last_error")
    .eq("provider", "notion")
    .maybeSingle();
  if (error) throw toDataError(error);
  return data;
}

export async function getIntegrationsOverview(session: Session): Promise<IntegrationsOverview> {
  const { config, missing } = notionSetup();
  const row = await readNotionRow(session);
  const settings = parseNotionSettings(row?.settings);
  return {
    assistant: getAssistantStatus(),
    notion: {
      configured: config !== null,
      missing,
      status: row?.status ?? "disconnected",
      workspaceName: settings.workspaceName,
      importSettings: settings.import,
      lastSyncedAt: row?.last_synced_at ?? null,
      lastError: row?.last_error ?? null,
    },
    problems: getServerEnv().problems,
  };
}

// ---------------------------------------------------------------------------
// Conexión y tokens (solo servidor, con la clave secreta)
// ---------------------------------------------------------------------------

const credentialContext = (userId: string) => `${userId}:notion`;

type StoredTokens = Pick<NotionTokens, "accessToken" | "refreshToken">;

async function storeTokens(config: NotionConfig, userId: string, tokens: StoredTokens) {
  const secret = encryptSecret(JSON.stringify(tokens), config.encryptionKey, credentialContext(userId));
  const { error } = await config.admin
    .from("integration_credentials")
    .upsert({ user_id: userId, provider: "notion", secret }, { onConflict: "user_id,provider" });
  if (error) throw toDataError(error);
}

async function readTokens(config: NotionConfig, userId: string): Promise<StoredTokens> {
  const { data, error } = await config.admin
    .from("integration_credentials")
    .select("secret")
    .eq("user_id", userId)
    .eq("provider", "notion")
    .maybeSingle();
  if (error) throw toDataError(error);
  if (!data) throw new IntegrationError("not_connected");
  try {
    const parsed: unknown = JSON.parse(decryptSecret(data.secret, config.encryptionKey, credentialContext(userId)));
    const tokens = parsed as Partial<StoredTokens>;
    if (typeof tokens.accessToken !== "string") throw new Error("Token sin formato esperado");
    return { accessToken: tokens.accessToken, refreshToken: typeof tokens.refreshToken === "string" ? tokens.refreshToken : null };
  } catch (error) {
    // Clave de cifrado cambiada o dato alterado: hay que reconectar.
    throw new IntegrationError("auth", { cause: error });
  }
}

async function writeNotionRow(
  config: NotionConfig,
  userId: string,
  values: { status: NotionOverview["status"]; settings?: NotionSettings; lastError?: string | null; synced?: boolean },
) {
  const { error } = await config.admin
    .from("integrations")
    .upsert(
      {
        user_id: userId,
        provider: "notion",
        status: values.status,
        last_error: values.lastError ?? null,
        ...(values.settings ? { settings: values.settings as unknown as Json } : {}),
        ...(values.synced ? { last_synced_at: new Date().toISOString() } : {}),
      },
      { onConflict: "user_id,provider" },
    );
  if (error) throw toDataError(error);
}

async function currentSettings(config: NotionConfig, userId: string): Promise<NotionSettings> {
  const { data, error } = await config.admin
    .from("integrations")
    .select("settings")
    .eq("user_id", userId)
    .eq("provider", "notion")
    .maybeSingle();
  if (error) throw toDataError(error);
  return parseNotionSettings(data?.settings);
}

/** Guarda la conexión tras el OAuth. La fila de integrations debe existir antes que el token (FK). */
export async function saveNotionConnection(userId: string, tokens: NotionTokens) {
  const config = getNotionConfig();
  const settings = { ...(await currentSettings(config, userId)), workspaceName: tokens.workspaceName };
  await writeNotionRow(config, userId, { status: "connected", settings });
  try {
    await storeTokens(config, userId, tokens);
  } catch (error) {
    await writeNotionRow(config, userId, { status: "error", lastError: "No se pudo guardar la conexión." });
    throw error;
  }
}

/** Marca la conexión con error (p. ej. si el OAuth falló), sin tocar el token. */
export async function recordNotionError(userId: string, message: string) {
  const config = getNotionConfig();
  const { error } = await config.admin
    .from("integrations")
    .update({ status: "error", last_error: message.slice(0, 1000) })
    .eq("user_id", userId)
    .eq("provider", "notion");
  if (error) throw toDataError(error);
}

/**
 * Ejecuta `fn` con un cliente de Notion del usuario. Si el token caducó y hay
 * refresh token, lo renueva una vez, guarda el nuevo y reintenta.
 */
async function withNotion<T>(config: NotionConfig, userId: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const tokens = await readTokens(config, userId);
  try {
    return await fn(createNotionClient(tokens.accessToken));
  } catch (error) {
    const mapped = toIntegrationError(error);
    if (mapped.code !== "auth" || !tokens.refreshToken) throw mapped;
    const renewed = await refreshNotionTokens(config.oauth, tokens.refreshToken);
    await storeTokens(config, userId, renewed);
    return fn(createNotionClient(renewed.accessToken)).catch((retryError: unknown) => {
      throw toIntegrationError(retryError);
    });
  }
}

/** Marca el error en la fila (para que Ajustes lo muestre) y lo relanza. */
async function failWith(config: NotionConfig, userId: string, error: unknown): Promise<never> {
  const shown = error instanceof IntegrationError || error instanceof DataError ? error : toIntegrationError(error);
  if (shown instanceof IntegrationError && shown.code !== "not_connected") {
    await writeNotionRow(config, userId, { status: "error", lastError: shown.message }).catch(() => undefined);
  }
  throw shown;
}

export async function disconnectNotion(session: Session): Promise<{ revoked: boolean }> {
  const { config } = notionSetup();
  if (!config) {
    // Sin la clave secreta: borrar la fila propia (RLS) elimina el token en cascada.
    const { error } = await session.supabase.from("integrations").delete().eq("provider", "notion");
    if (error) throw toDataError(error);
    return { revoked: false };
  }
  const tokens = await readTokens(config, session.userId).catch(() => null);
  const revoked = tokens ? await revokeNotionToken(config.oauth, tokens.accessToken) : false;
  const { error } = await config.admin
    .from("integration_credentials")
    .delete()
    .eq("user_id", session.userId)
    .eq("provider", "notion");
  if (error) throw toDataError(error);
  const settings = { ...(await currentSettings(config, session.userId)), workspaceName: null };
  await writeNotionRow(config, session.userId, { status: "disconnected", settings });
  return { revoked };
}

// ---------------------------------------------------------------------------
// Configuración de la importación
// ---------------------------------------------------------------------------

export async function listNotionSources(session: Session) {
  const config = getNotionConfig();
  return withNotion(config, session.userId, listNotionDataSources).catch((error: unknown) =>
    failWith(config, session.userId, error),
  );
}

export async function getNotionSource(session: Session, dataSourceId: string): Promise<NotionSourceSchema> {
  const config = getNotionConfig();
  return withNotion(config, session.userId, (client) => getNotionSourceSchema(client, dataSourceId)).catch(
    (error: unknown) => failWith(config, session.userId, error),
  );
}

/** Valida la configuración contra la base real de Notion y la guarda. */
export async function saveNotionImportSettings(session: Session, values: NotionImportSettings) {
  if (values.subjectId && !(await getSubject(session, values.subjectId))) {
    throw new DataError("La materia seleccionada no existe.", "invalid");
  }
  const schema = await getNotionSource(session, values.dataSourceId);
  const problem = mappingProblem(values, schema);
  if (problem) throw new IntegrationError("invalid_settings", { message: problem });

  const row = await readNotionRow(session);
  if (!row) throw new IntegrationError("not_connected");
  const settings: NotionSettings = {
    ...parseNotionSettings(row.settings),
    import: { ...values, dataSourceName: schema.name },
  };
  // El usuario puede escribir settings (RLS); el estado lo escribe el servidor.
  const { error } = await session.supabase
    .from("integrations")
    .update({ settings: settings as unknown as Json })
    .eq("provider", "notion");
  if (error) throw toDataError(error);
}

// ---------------------------------------------------------------------------
// Importación
// ---------------------------------------------------------------------------

export type NotionImportResult = ImportOutcome & {
  skipped: { title: string | null; reason: string }[];
  skippedCount: number;
  /** Había más páginas que el límite y no se leyeron. */
  truncated: boolean;
  limit: number;
  subjectMissing: boolean;
};

export async function importFromNotion(session: Session, timeZone: string): Promise<NotionImportResult> {
  const config = getNotionConfig();
  const settings = parseNotionSettings((await readNotionRow(session))?.settings).import;
  if (!settings) {
    throw new IntegrationError("invalid_settings", { message: "Elige primero qué base de Notion importar." });
  }

  const subjectMissing = settings.subjectId !== null && !(await getSubject(session, settings.subjectId));
  const subjectId = subjectMissing ? null : settings.subjectId;

  try {
    const read = await withNotion(config, session.userId, async (client) => {
      const schema = await getNotionSourceSchema(client, settings.dataSourceId);
      const problem = mappingProblem(settings, schema);
      if (problem) throw new IntegrationError("invalid_settings", { message: problem });

      const candidates: ExternalTaskCandidate[] = [];
      const skipped: { title: string | null; reason: string }[] = [];
      let seen = 0;
      let truncated = false;
      for await (const page of notionPages(client, settings.dataSourceId, NOTION_IMPORT_LIMIT + 1)) {
        if (seen === NOTION_IMPORT_LIMIT) {
          truncated = true;
          break;
        }
        seen += 1;
        const mapped = mapNotionPage(page, settings, timeZone);
        if (mapped.ok) candidates.push(mapped.candidate);
        else skipped.push({ title: mapped.title, reason: mapped.reason });
      }
      return { candidates, skipped, truncated };
    });

    const outcome = await applyTaskImport(session.supabase, session.userId, NOTION_SOURCE, read.candidates, {
      subjectId,
    });

    // Solo se da por sincronizado si se guardó todo lo que se leyó.
    if (outcome.failed > 0) {
      await writeNotionRow(config, session.userId, {
        status: "error",
        lastError: `No se pudieron guardar ${outcome.failed} de ${read.candidates.length} tareas.`,
      });
    } else {
      await writeNotionRow(config, session.userId, { status: "connected", synced: true });
    }

    return {
      ...outcome,
      skipped: read.skipped.slice(0, 10),
      skippedCount: read.skipped.length,
      truncated: read.truncated,
      limit: NOTION_IMPORT_LIMIT,
      subjectMissing,
    };
  } catch (error) {
    return failWith(config, session.userId, error);
  }
}
