import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { getServerEnv } from "@/lib/server-env";

export type AdminClient = SupabaseClient<Database>;

/**
 * Cliente con la clave secreta: salta RLS. Solo para lo que el usuario no
 * puede escribir (estado de integraciones y tokens cifrados), y siempre
 * filtrando por el user_id de la sesión. Devuelve null si no hay clave.
 */
export function createAdminClient(): AdminClient | null {
  const secretKey = getServerEnv().SUPABASE_SECRET_KEY;
  if (!secretKey) return null;
  return createClient<Database>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
