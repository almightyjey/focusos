import "server-only";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { createClient, type ServerSupabaseClient } from "@/lib/supabase/server";

export type Session = {
  supabase: ServerSupabaseClient;
  userId: string;
  email: string | null;
};

/**
 * Lee y verifica la sesión (getClaims valida la firma del JWT). Es la única
 * puerta de entrada a los datos del usuario: los servicios reciben esta sesión.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  // Validar el JWT compara su expiración con la hora actual: debe ocurrir en
  // cada petición, nunca durante un prerender o prefetch (Cache Components).
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
