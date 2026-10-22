import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/schemas/auth";

/** Destino de los enlaces de confirmación con flujo PKCE (?code=...). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error("[auth] exchangeCodeForSession", error.code);
  }

  return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
}
