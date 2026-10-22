import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">Crear cuenta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tus materias y tareas son privadas: solo tú puedes verlas.
        </p>
      </div>
      <SignUpForm />
    </>
  );
}
