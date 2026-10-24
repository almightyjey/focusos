"use client";

import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { GradeItemDialog } from "@/components/grades/grade-item-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GradeItem } from "@/domain/types";
import { deleteGradeItemAction } from "@/server/actions/grades";

export function GradeItemActions({ item, timeZone }: { item: GradeItem; timeZone: string }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${item.title}`}>
            <EllipsisIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <PencilIcon aria-hidden /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2Icon aria-hidden /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <GradeItemDialog subjectId={item.subjectId} item={item} timeZone={timeZone} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="¿Eliminar esta evaluación?"
        description={`"${item.title}" y su nota dejarán de contar en el promedio.`}
        confirmLabel="Eliminar evaluación"
        pendingLabel="Eliminando…"
        successMessage="Evaluación eliminada"
        onConfirm={() => deleteGradeItemAction(item.id)}
      />
    </>
  );
}
