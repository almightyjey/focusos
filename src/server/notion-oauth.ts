import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";

import { getPublicEnv } from "@/lib/env";

// Protección CSRF del flujo OAuth: un valor aleatorio viaja a Notion en
// `state` y vuelve; debe coincidir con la cookie httpOnly y con el usuario que
// inició la conexión.

export const NOTION_STATE_COOKIE = "focusos_notion_state";
export const NOTION_OAUTH_PATH = "/api/integrations/notion";

export function notionRedirectUri(): string {
  return new URL(`${NOTION_OAUTH_PATH}/callback`, getPublicEnv().NEXT_PUBLIC_SITE_URL).toString();
}

export function createOAuthState(userId: string): { state: string; cookieValue: string } {
  const state = randomBytes(32).toString("base64url");
  return { state, cookieValue: `${userId}.${state}` };
}

export function isValidOAuthState(cookieValue: string | undefined, userId: string, state: string | null): boolean {
  if (!cookieValue || !state) return false;
  const expected = Buffer.from(`${userId}.${state}`);
  const actual = Buffer.from(cookieValue);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const stateCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: NOTION_OAUTH_PATH,
  maxAge: 600,
};
