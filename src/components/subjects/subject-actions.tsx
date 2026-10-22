"use client";

import { ArchiveIcon, ArchiveRestoreIcon, EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { SubjectFormDialog } from "@/components/subjects/subject-form-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Subject } from "@/domain/types";
import { deleteSubjectAction, setSubjectArchivedAction } from "@/server/actions/subjects";

export function SubjectActions({ subject, openTaskCount }: { subject: Subject; openTaskCount: number }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggleArchived = () =>
    startTransition(async () => {
      const result = await setSubjectArchivedAction(subject.id, !subject.isArchived);
      if (result.ok) toast.success(subject.isArchived ? "Materia restaurada" : "Materia archivada");
      else toast.error(result.error);
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${subject.name}`} disabled={pending}>
            <EllipsisIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <PencilIcon aria-hidden /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleArchived}>
            {subject.isArchived ? (
              <>
                <ArchiveRestoreIcon aria-hidden /> Restaurar
              </>
            ) : (
              <>
                <ArchiveIcon aria-hidden /> Archivar
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2Icon aria-hidden /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SubjectFormDialog subject={subject} open={editing} onOpenChange={setEditing} />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`¿Eliminar ${subject.name}?`}
        description={
          openTaskCount > 0
            ? `Sus ${openTaskCount} tareas pendientes se conservarán, pero quedarán sin materia. Si solo terminó el periodo, mejor archívala.`
            : "Esta acción no se puede deshacer. Si solo terminó el periodo, mejor archívala."
        }
        confirmLabel="Eliminar materia"
        pendingLabel="Eliminando…"
        successMessage="Materia eliminada"
        onConfirm={() => deleteSubjectAction(subject.id)}
      />
    </>
  );
}
