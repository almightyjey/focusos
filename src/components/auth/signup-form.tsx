"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signUpSchema, type SignUpInput, type SignUpValues } from "@/schemas/auth";
import { signUpAction } from "@/server/actions/auth";

export function SignUpForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<SignUpInput, unknown, SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const result = await signUpAction({ ...form.getValues(), timezone });
    if (!result) return;
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    if (result.data.needsConfirmation) setSentTo(values.email);
  });

  if (sentTo) {
    return (
      <div className="space-y-4">
        <FormAlert tone="info">
          Te enviamos un enlace de confirmación a <strong className="font-semibold">{sentTo}</strong>.
          Ábrelo en este mismo navegador para activar tu cuenta.
        </FormAlert>
        <p className="text-sm text-muted-foreground">
          ¿No llega? Revisa la carpeta de spam o{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            vuelve a iniciar sesión
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <FieldGroup>
        <Field data-invalid={Boolean(errors.displayName)}>
          <FieldLabel htmlFor="displayName">Nombre</FieldLabel>
          <Input id="displayName" autoComplete="given-name" {...form.register("displayName")} />
          <FieldError errors={[errors.displayName]} />
        </Field>
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
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby="password-hint"
            {...form.register("password")}
          />
          <FieldDescription id="password-hint">Al menos 8 caracteres.</FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
