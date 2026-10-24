import "server-only";

import {
  APIErrorCode,
  Client,
  isFullDataSource,
  isFullPage,
  isNotionClientError,
  iterateAllDataSourceRows,
  type PageObjectResponse,
} from "@notionhq/client";

import { IntegrationError } from "@/integrations/errors";
import type { NotionSourceSchema } from "@/integrations/notion/settings";

// Adaptador de Notion sobre el SDK oficial (@notionhq/client, versión de API
// por defecto del SDK). Todo lo específico de Notion vive aquí y en mapper.ts.

export type NotionOAuthConfig = { clientId: string; clientSecret: string };

export type NotionTokens = {
  accessToken: string;
  refreshToken: string | null;
  workspaceName: string | null;
};

type FetchOption = { fetch?: typeof fetch };

const TIMEOUT_MS = 20_000;
const MAX_SOURCES = 200;

export function createNotionClient(accessToken: string, options: FetchOption = {}): Client {
  return new Client({ auth: accessToken, timeoutMs: TIMEOUT_MS, fetch: options.fetch });
}

export function notionAuthorizeUrl(config: NotionOAuthConfig, redirectUri: string, state: string): string {
  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("owner", "user");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export function toIntegrationError(error: unknown): IntegrationError {
  if (error instanceof IntegrationError) return error;
  if (isNotionClientError(error)) {
    switch (error.code) {
      case APIErrorCode.Unauthorized:
        return new IntegrationError("auth", { cause: error });
      case APIErrorCode.ObjectNotFound:
      case APIErrorCode.RestrictedResource:
        return new IntegrationError("not_found", { cause: error });
      case APIErrorCode.RateLimited:
        return new IntegrationError("rate_limited", { cause: error });
    }
  }
  return new IntegrationError("unavailable", { cause: error });
}

function toTokens(response: { access_token: string; refresh_token: string | null; workspace_name: string | null }): NotionTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    workspaceName: response.workspace_name,
  };
}

/** Canjea el código de la redirección OAuth por tokens. */
export async function exchangeNotionCode(
  config: NotionOAuthConfig,
  code: string,
  redirectUri: string,
  options: FetchOption = {},
): Promise<NotionTokens> {
  const client = new Client({ timeoutMs: TIMEOUT_MS, fetch: options.fetch });
  try {
    const response = await client.oauth.token({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    return toTokens(response);
  } catch (error) {
    throw toIntegrationError(error);
  }
}

/** Renueva el token. Notion entrega también un refresh token nuevo: hay que guardarlo. */
export async function refreshNotionTokens(
  config: NotionOAuthConfig,
  refreshToken: string,
  options: FetchOption = {},
): Promise<NotionTokens> {
  const client = new Client({ timeoutMs: TIMEOUT_MS, fetch: options.fetch });
  try {
    const response = await client.oauth.token({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });
    return toTokens(response);
  } catch (error) {
    // Un refresh token rechazado obliga a reconectar.
    const mapped = toIntegrationError(error);
    throw mapped.code === "unavailable" ? mapped : new IntegrationError("auth", { cause: error });
  }
}

/** Revoca el token en Notion. Devuelve false si no se pudo (la desconexión local sigue). */
export async function revokeNotionToken(config: NotionOAuthConfig, token: string): Promise<boolean> {
  const client = new Client({ timeoutMs: TIMEOUT_MS });
  try {
    await client.oauth.revoke({ token, client_id: config.clientId, client_secret: config.clientSecret });
    return true;
  } catch {
    return false;
  }
}

function plain(parts: { plain_text: string }[]): string {
  return parts.map((part) => part.plain_text).join("").trim();
}

/** Bases (data sources) compartidas con la integración. */
export async function listNotionDataSources(client: Client): Promise<{ id: string; name: string }[]> {
  const sources: { id: string; name: string }[] = [];
  let cursor: string | undefined;
  try {
    do {
      const response = await client.search({
        filter: { property: "object", value: "data_source" },
        start_cursor: cursor,
        page_size: 100,
      });
      for (const result of response.results) {
        if (isFullDataSource(result) && !result.in_trash) {
          sources.push({ id: result.id, name: plain(result.title) || "Sin título" });
        }
      }
      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor && sources.length < MAX_SOURCES);
  } catch (error) {
    throw toIntegrationError(error);
  }
  return sources.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function getNotionSourceSchema(client: Client, dataSourceId: string): Promise<NotionSourceSchema> {
  try {
    const source = await client.dataSources.retrieve({ data_source_id: dataSourceId });
    if (!isFullDataSource(source)) throw new IntegrationError("not_found");
    return {
      id: source.id,
      name: plain(source.title) || "Sin título",
      properties: Object.values(source.properties)
        .map((property) => ({
          name: property.name,
          type: property.type,
          options:
            property.type === "status"
              ? property.status.options.map((option) => option.name)
              : property.type === "select"
                ? property.select.options.map((option) => option.name)
                : [],
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    };
  } catch (error) {
    throw toIntegrationError(error);
  }
}

/**
 * Recorre las páginas de una base. El ayudante del SDK pagina y evita el tope
 * de resultados de una sola consulta; `limit` acota cuántas se leen.
 */
export async function* notionPages(
  client: Client,
  dataSourceId: string,
  limit: number,
): AsyncGenerator<PageObjectResponse> {
  let count = 0;
  try {
    for await (const row of iterateAllDataSourceRows(client, { data_source_id: dataSourceId, page_size: 100 })) {
      if (!isFullPage(row)) continue;
      yield row;
      count += 1;
      if (count >= limit) return;
    }
  } catch (error) {
    throw toIntegrationError(error);
  }
}
