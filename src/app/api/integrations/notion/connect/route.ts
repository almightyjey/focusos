import { NextResponse, type NextRequest } from "next/server";

import { notionAuthorizeUrl } from "@/integrations/notion/client";
import { getSession } from "@/server/auth";
import { getNotionConfig } from "@/server/services/integrations";
import {
  createOAuthState,
  NOTION_STATE_COOKIE,
  notionRedirectUri,
  stateCookieOptions,
} from "@/server/notion-oauth";

/** Inicia el OAuth de Notion: el usuario elige en Notion qué páginas y bases comparte. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login?next=/settings", request.url));

  let config;
  try {
    config = getNotionConfig();
  } catch {
    return NextResponse.redirect(new URL("/settings?notion=not_configured", request.url));
  }

  const { state, cookieValue } = createOAuthState(session.userId);
  const response = NextResponse.redirect(notionAuthorizeUrl(config.oauth, notionRedirectUri(), state));
  response.cookies.set(NOTION_STATE_COOKIE, cookieValue, stateCookieOptions);
  return response;
}
