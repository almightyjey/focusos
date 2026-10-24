import { NextResponse, type NextRequest } from "next/server";

import { IntegrationError } from "@/integrations/errors";
import { exchangeNotionCode } from "@/integrations/notion/client";
import { getSession } from "@/server/auth";
import { getNotionConfig, recordNotionError, saveNotionConnection } from "@/server/services/integrations";
import {
  isValidOAuthState,
  NOTION_OAUTH_PATH,
  NOTION_STATE_COOKIE,
  notionRedirectUri,
} from "@/server/notion-oauth";

/** Vuelta del OAuth de Notion. Solo se informa "conectado" si el token quedó guardado. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login?next=/settings", request.url));

  const params = request.nextUrl.searchParams;
  const back = (result: string) => {
    const response = NextResponse.redirect(new URL(`/settings?notion=${result}`, request.url));
    response.cookies.delete({ name: NOTION_STATE_COOKIE, path: NOTION_OAUTH_PATH });
    return response;
  };

  if (!isValidOAuthState(request.cookies.get(NOTION_STATE_COOKIE)?.value, session.userId, params.get("state"))) {
    return back("state");
  }
  // El usuario canceló en Notion.
  if (params.get("error")) return back("denied");
  const code = params.get("code");
  if (!code) return back("error");

  let config;
  try {
    config = getNotionConfig();
  } catch {
    return back("not_configured");
  }

  try {
    const tokens = await exchangeNotionCode(config.oauth, code, notionRedirectUri());
    await saveNotionConnection(session.userId, tokens);
  } catch (error) {
    console.error("[notion] No se completó la conexión", {
      code: error instanceof IntegrationError ? error.code : "unknown",
    });
    await recordNotionError(session.userId, "No se pudo completar la conexión con Notion.").catch(() => undefined);
    return back("error");
  }
  return back("connected");
}
