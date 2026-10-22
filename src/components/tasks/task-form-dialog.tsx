"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormAlert } from "@/components/auth/form-alert";
import { PrioritySelect } from "@/components/forms/priority-select";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addDaysToKey, dayKey, utcToZonedInput } from "@/domain/datetime";
import { TASK_KIND_LABELS } from "@/domain/labels";
import { TASK_KINDS, type Task, type TaskKind } from "@/domain/types";
import { NONE } from "@/schemas/common";
import { DIFFICULTY_OPTIONS, taskFormSchema, type TaskFormInput, type TaskFormValues } from "@/schemas/task";
import { createTaskAction, updateTaskAction } from "@/server/actions/tasks";

export type SubjectOption = { id: string; name: string; color: string };

function defaults(task: Task | undefined, timeZone: string, defaultSubjectId?: string): TaskFormInput {
  const due = task?.dueAt ? utcToZonedInput(task.dueAt, timeZone) : null;
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    subjectId: task ? (task.subjectId ?? NONE) : (defaultSubjectId ?? NONE),
    kind: task?.kind ?? "assignment",
    priority: task?.priority ?? "medium",
    dueDate: due?.date ?? "",
    dueTime: due?.time ?? "",
    estimatedMinutes: task?.estimatedMinutes ? String(task.estimatedMinutes) : "",
    difficulty: task?.difficulty ? (String(task.difficulty) as TaskFormInput["difficulty"]) : NONE,
  };
}

export function TaskFormDialog({
  task,
  subjects,
  timeZone,
  nowIso,
  defaultSubjectId,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  task?: Task;
  subjects: SubjectOption[];
  timeZone: string;
  nowIso: string;
  defaultSubjectId?: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {/* El contenido se monta al abrir: cada apertura empieza con valores limpios. */}
        <TaskForm
          task={task}
          subjects={subjects}
          timeZone={timeZone}
          nowIso={nowIso}
          defaultSubjectId={defaultSubjectId}
          onBusyChange={setBusy}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({
  task,
  subjects,
  timeZone,
  nowIso,
  defaultSubjectId,
  onBusyChange,
  onDone,
}: {
  task?: Task;
  subjects: SubjectOption[];
  timeZone: string;
  nowIso: string;
  defaultSubjectId?: string;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = Boolean(task);
  const todayKey = dayKey(nowIso, timeZone);

  const form = useForm<TaskFormInput, unknown, TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: defaults(task, timeZone, defaultSubjectId),
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async () => {
    setServerError(null);
    onBusyChange(true);
    const values = form.getValues();
    const result = task ? await updateTaskAction(task.id, values) : await createTaskAction(values);
    onBusyChange(false);
    if (!result.ok) {
      setServerError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (field in values && messages?.[0]) {
          form.setError(field as keyof TaskFormInput, { message: messages[0] });
        }
      }
      return;
    }
    toast.success(isEdit ? "Tarea actualizada" : "Tarea creada");
    onDone();
  });

  const setDueDate = (key: string) => form.setValue("dueDate", key, { shouldDirty: true, shouldValidate: true });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar tarea" : "Nueva tarea"}</DialogTitle>
        <DialogDescription>
          Las horas se interpretan en tu zona horaria ({timeZone.replace(/_/g, " ")}).
        </DialogDescription>
      </DialogHeader>

      {serverError ? <FormAlert>{serverError}</FormAlert> : null}

      <FieldGroup>
        <Field data-invalid={Boolean(errors.title)}>
          <FieldLabel htmlFor="task-title">Qué hay que hacer</FieldLabel>
          <Input
            id="task-title"
            autoComplete="off"
            aria-invalid={Boolean(errors.title)}
            {...form.register("title")}
          />
          <FieldError errors={[errors.title]} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(errors.subjectId)}>
            <FieldLabel htmlFor="task-subject">Materia</FieldLabel>
            <Controller
              control={form.control}
              name="subjectId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="task-subject" className="w-full" aria-invalid={Boolean(errors.subjectId)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin materia</SelectItem>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        <SubjectSwatch color={subject.color} />
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.subjectId]} />
          </Field>
          <Field data-invalid={Boolean(errors.kind)}>
            <FieldLabel htmlFor="task-kind">Tipo</FieldLabel>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => field.onChange(value as TaskKind)}>
                  <SelectTrigger id="task-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_KINDS.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {TASK_KIND_LABELS[kind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium">Fecha límite</legend>
          <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
            <Field data-invalid={Boolean(errors.dueDate)}>
              <FieldLabel htmlFor="task-due-date" className="sr-only">
                Fecha
              </FieldLabel>
              <Input
                id="task-due-date"
                type="date"
                aria-invalid={Boolean(errors.dueDate)}
                {...form.register("dueDate")}
              />
            </Field>
            <Field data-invalid={Boolean(errors.dueTime)}>
              <FieldLabel htmlFor="task-due-time" className="sr-only">
                Hora
              </FieldLabel>
              <Input id="task-due-time" type="time" {...form.register("dueTime")} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDueDate(todayKey)}>
              Hoy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDueDate(addDaysToKey(todayKey, 1))}
            >
              Mañana
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDueDate("");
                form.setValue("dueTime", "");
              }}
            >
              Sin fecha
            </Button>
          </div>
          <FieldDescription>Si no indicas hora, vence a las 23:59.</FieldDescription>
          <FieldError errors={[errors.dueDate, errors.dueTime]} />
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field data-invalid={Boolean(errors.priority)}>
            <FieldLabel htmlFor="task-priority">Prioridad</FieldLabel>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <PrioritySelect id="task-priority" value={field.value} onChange={field.onChange} />
              )}
            />
          </Field>
          <Field data-invalid={Boolean(errors.estimatedMinutes)}>
            <FieldLabel htmlFor="task-estimate">Estimación (min)</FieldLabel>
            <Input
              id="task-estimate"
              inputMode="numeric"
              autoComplete="off"
              placeholder="60"
              aria-invalid={Boolean(errors.estimatedMinutes)}
              {...form.register("estimatedMinutes")}
            />
            <FieldError errors={[errors.estimatedMinutes]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="task-difficulty">Dificultad</FieldLabel>
            <Controller
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="task-difficulty" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin indicar</SelectItem>
                    {DIFFICULTY_OPTIONS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level} de 5
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <Field data-invalid={Boolean(errors.description)}>
          <FieldLabel htmlFor="task-description">Notas (opcional)</FieldLabel>
          <Textarea id="task-description" rows={3} {...form.register("description")} />
          <FieldError errors={[errors.description]} />
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear tarea"}
        </Button>
      </DialogFooter>
    </form>
  );
}
