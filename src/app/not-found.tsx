import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Esta página no existe</h1>
      <p className="mt-2 text-sm text-muted-foreground">Revisa la dirección o vuelve al resumen de hoy.</p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Ir a Hoy</Link>
      </Button>
    </main>
  );
}
