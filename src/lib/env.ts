import { z } from "zod";

// Variables públicas: Next las incrusta en el bundle del navegador, por eso
// cada una se lee con su nombre literal (process.env.NEXT_PUBLIC_...).
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL debe ser una URL" }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({ message: "Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" })
    .min(1, "Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    .refine((key) => !key.startsWith("sb_secret_"), {
      message: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contiene una clave secreta",
    }),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  if (cached) return cached;
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `- ${issue.message}`).join("\n");
    throw new Error(`Configuración incompleta. Revisa .env.local (ver .env.example):\n${details}`);
  }
  cached = parsed.data;
  return cached;
}
