"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteSessionAction } from "@/server/actions/sessions";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Eliminar sesión" onClick={() => setOpen(true)}>
        <Trash2Icon aria-hidden />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Eliminar esta sesión?"
        description="Su tiempo dejará de contar en tus totales y en el tiempo real de la tarea."
        confirmLabel="Eliminar sesión"
        pendingLabel="Eliminando…"
        successMessage="Sesión eliminada"
        onConfirm={() => deleteSessionAction(sessionId)}
      />
    </>
  );
}
