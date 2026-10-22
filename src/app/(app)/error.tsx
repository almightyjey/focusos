"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight">No se pudo cargar esta página</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Puede ser un problema de conexión con la base de datos. Tus datos no se han modificado.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-muted-foreground">Referencia: {error.digest}</p>
      ) : null}
      <Button className="mt-6" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
