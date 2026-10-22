"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath, signInSchema, signUpSchema, type SignInInput, type SignUpInput } from "@/schemas/auth";
import { fail, invalidInput, ok, type ActionResult } from "@/server/action-result";

export async function signInAction(input: SignInInput, next?: string): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return fail("Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.");
    }
    if (error.code === "invalid_credentials") {
      return fail("Correo o contraseña incorrectos.");
    }
    console.error("[auth] signIn", error.code, error.message);
    return fail("No se pudo iniciar sesión. Inténtalo de nuevo en unos minutos.");
  }

  revalidatePath("/", "layout");
  redirect(safeRedirectPath(next));
}

export async function signUpAction(
  input: SignUpInput,
): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  const { email, password, displayName, timezone } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getPublicEnv().NEXT_PUBLIC_SITE_URL}/auth/callback?next=/dashboard`,
      data: { display_name: displayName, timezone },
    },
  });

  if (error) {
    if (error.code === "weak_password") return fail("Esa contraseña es demasiado débil. Usa una más larga.");
    if (error.code === "over_email_send_rate_limit") {
      return fail("Se alcanzó el límite de correos de confirmación. Inténtalo más tarde.");
    }
    if (error.code === "email_address_not_authorized") {
      return fail(
        "El servidor de correo de prueba de Supabase no puede enviar a esta dirección. Configura SMTP propio (ver README).",
      );
    }
    console.error("[auth] signUp", error.code, error.message);
    return fail("No se pudo crear la cuenta. Inténtalo de nuevo.");
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }
  return ok({ needsConfirmation: true });
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
