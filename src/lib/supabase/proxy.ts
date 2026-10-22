import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/** Rutas accesibles sin sesión. */
const PUBLIC_PATHS = ["/login", "/signup", "/auth"];
/** Rutas de autenticación: si ya hay sesión, se envía al dashboard. */
const GUEST_ONLY_PATHS = ["/login", "/signup"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Refresca el token de Supabase en cada petición y aplica una redirección
 * optimista. La autorización real ocurre en el servidor (getClaims en la capa
 * de datos) y en la base de datos (RLS); esto solo evita pintar páginas
 * privadas a quien no ha iniciado sesión.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // No ejecutar código entre createServerClient y getClaims (ver docs de Supabase).
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
    const redirect = NextResponse.redirect(url);
    // Conserva las cookies de sesión refrescadas.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (pathname === "/") {
    return redirectTo(isSignedIn ? "/dashboard" : "/login");
  }

  if (!isSignedIn && !matches(pathname, PUBLIC_PATHS)) {
    return redirectTo("/login", { next: `${pathname}${search}` });
  }

  if (isSignedIn && matches(pathname, GUEST_ONLY_PATHS)) {
    return redirectTo("/dashboard");
  }

  return response;
}
