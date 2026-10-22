import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-tight">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mira qué te toca hoy y qué entregas se acercan.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <LoginForm />
      </Suspense>
    </>
  );
}
