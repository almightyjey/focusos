"use client";

import { EllipsisIcon, ListChecksIcon, PencilIcon, TimerIcon, Trash2Icon } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { useAssistantStatus } from "@/components/assistant/assistant-status";
import { TaskStepsDialog } from "@/components/assistant/task-steps-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import { DueLabel } from "@/components/tasks/due-label";
import { TaskFormDialog, type SubjectOption } from "@/components/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMinutes } from "@/domain/datetime";
import { formatFocus } from "@/domain/sessions";
import { PRIORITY_LABELS } from "@/domain/labels";
import type { Task } from "@/domain/types";
import { cn } from "@/lib/utils";
import { startTaskSessionAction } from "@/server/actions/sessions";
import { deleteTaskAction, setTaskCompletedAction } from "@/server/actions/tasks";

/** "35 min de 1 h 30 min", "35 min dedicados" o "1 h 30 min estimados". */
function timeSummary(task: Task): string | null {
  const focus = task.focusSeconds ?? 0;
  if (focus > 0 && task.estimatedMinutes) return `${formatFocus(focus)} de ${formatMinutes(task.estimatedMinutes)}`;
  if (focus > 0) return `${formatFocus(focus)} dedicados`;
  if (task.estimatedMinutes) return `${formatMinutes(task.estimatedMinutes)} estimados`;
  return null;
}

export function TaskItem({
  task,
  subjects,
  nowIso,
  timeZone,
  showSubject = true,
}: {
  task: Task;
  subjects: SubjectOption[];
  nowIso: string;
  timeZone: string;
  showSubject?: boolean;
}) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(task.status === "completed");
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const assistant = useAssistantStatus();
  const subject = subjects.find((s) => s.id === task.subjectId);
  const checkboxId = `task-${task.id}`;

  const setDone = (done: boolean) =>
    startTransition(async () => {
      setOptimisticDone(done);
      const result = await setTaskCompletedAction(task.id, done);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (done) {
        toast.success("Tarea completada", {
          action: {
            label: "Deshacer",
            onClick: () =>
              startTransition(async () => {
                const undo = await setTaskCompletedAction(task.id, false);
                if (!undo.ok) toast.error(undo.error);
              }),
          },
        });
      }
    });

  const urgent = task.priority === "urgent" || task.priority === "high";
  const time = timeSummary(task);

  const studyNow = () =>
    startTransition(async () => {
      const result = await startTaskSessionAction(task.id);
      if (result.ok) toast.success("Sesión de 25 min iniciada");
      else toast.error(result.error);
    });

  return (
    <li
      className="group/task flex items-start gap-3 py-3"
      data-testid="task-item"
      data-task-title={task.title}
      data-done={optimisticDone}
    >
      <Checkbox
        id={checkboxId}
        checked={optimisticDone}
        onCheckedChange={(value) => setDone(value === true)}
        className="mt-0.5 size-5"
        aria-label={optimisticDone ? `Marcar como pendiente: ${task.title}` : `Completar: ${task.title}`}
      />
      <div className="min-w-0 flex-1">
        <label
          htmlFor={checkboxId}
          className={cn(
            "block cursor-pointer text-[0.95rem] leading-snug font-medium break-words",
            optimisticDone && "text-muted-foreground line-through decoration-muted-foreground/60",
          )}
        >
          {task.title}
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {task.dueAt ? (
            <DueLabel dueAt={task.dueAt} nowIso={nowIso} timeZone={timeZone} done={optimisticDone} />
          ) : null}
          {showSubject && subject ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <SubjectSwatch color={subject.color} />
              <span className="truncate">{subject.name}</span>
            </span>
          ) : null}
          {time ? <span className="tabular text-xs text-muted-foreground">{time}</span> : null}
          {urgent && !optimisticDone ? (
            <span className="text-xs font-medium text-foreground">
              Prioridad {PRIORITY_LABELS[task.priority].toLowerCase()}
            </span>
          ) : null}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${task.title}`}>
            <EllipsisIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {!optimisticDone ? (
            <DropdownMenuItem onSelect={studyNow}>
              <TimerIcon aria-hidden /> Estudiar ahora (25 min)
            </DropdownMenuItem>
          ) : null}
          {assistant.enabled && !optimisticDone ? (
            <DropdownMenuItem onSelect={() => setSplitting(true)}>
              <ListChecksIcon aria-hidden /> Dividir en pasos
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <PencilIcon aria-hidden /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2Icon aria-hidden /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TaskFormDialog
        task={task}
        subjects={subjects}
        timeZone={timeZone}
        nowIso={nowIso}
        open={editing}
        onOpenChange={setEditing}
      />
      {assistant.enabled ? (
        <TaskStepsDialog task={task} providerLabel={assistant.label} open={splitting} onOpenChange={setSplitting} />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="¿Eliminar esta tarea?"
        description={`"${task.title}" se eliminará definitivamente.`}
        confirmLabel="Eliminar tarea"
        pendingLabel="Eliminando…"
        successMessage="Tarea eliminada"
        onConfirm={() => deleteTaskAction(task.id)}
      />
    </li>
  );
}
