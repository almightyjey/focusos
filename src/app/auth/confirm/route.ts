import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/schemas/auth";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Destino de plantillas de correo con token_hash
 * ({{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email).
 * Funciona aunque el enlace se abra en otro navegador.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeRedirectPath(searchParams.get("next"));

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error("[auth] verifyOtp", error.code);
  }

  return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
}
