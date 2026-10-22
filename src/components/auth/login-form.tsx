"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signInSchema, type SignInInput, type SignInValues } from "@/schemas/auth";
import { signInAction } from "@/server/actions/auth";

const CALLBACK_ERRORS: Record<string, string> = {
  confirmation: "El enlace de confirmación no es válido o ya expiró. Inicia sesión o regístrate de nuevo.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;
  const callbackError = CALLBACK_ERRORS[searchParams.get("error") ?? ""];
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<SignInInput, unknown, SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  // El servidor vuelve a validar los valores tal como los escribió el usuario.
  const onSubmit = form.handleSubmit(async () => {
    setServerError(null);
    const result = await signInAction(form.getValues(), next);
    // Si tiene éxito, la acción redirige y no devuelve nada.
    if (result && !result.ok) setServerError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {callbackError && !serverError ? <FormAlert>{callbackError}</FormAlert> : null}
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <FieldGroup>
        <Field data-invalid={Boolean(errors.email)}>
          <FieldLabel htmlFor="email">Correo</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(errors.email)}
            {...form.register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={Boolean(errors.password)}>
          <FieldLabel htmlFor="password">Contraseña</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            {...form.register("password")}
          />
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
