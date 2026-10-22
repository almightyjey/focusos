"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ClockPlusIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormAlert } from "@/components/auth/form-alert";
import { SessionTargetSelect, type TaskOption } from "@/components/sessions/session-target-select";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NONE } from "@/schemas/common";
import { manualSessionSchema, type ManualSessionInput, type ManualSessionValues } from "@/schemas/session";
import { logManualSessionAction } from "@/server/actions/sessions";

/** Registra tiempo estudiado sin el temporizador (biblioteca, grupo de estudio…). */
export function ManualSessionButton({
  tasks,
  subjects,
  todayKey,
  timeZone,
}: {
  tasks: TaskOption[];
  subjects: SubjectOption[];
  todayKey: string;
  timeZone: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ClockPlusIcon aria-hidden /> Registrar tiempo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <ManualForm
          tasks={tasks}
          subjects={subjects}
          todayKey={todayKey}
          timeZone={timeZone}
          onBusyChange={setBusy}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ManualForm({
  tasks,
  subjects,
  todayKey,
  timeZone,
  onBusyChange,
  onDone,
}: {
  tasks: TaskOption[];
  subjects: SubjectOption[];
  todayKey: string;
  timeZone: string;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ManualSessionInput, unknown, ManualSessionValues>({
    resolver: zodResolver(manualSessionSchema),
    defaultValues: { target: NONE, date: todayKey, startTime: "", minutes: "", notes: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async () => {
    setServerError(null);
    onBusyChange(true);
    const result = await logManualSessionAction(form.getValues());
    onBusyChange(false);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    toast.success("Tiempo registrado");
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <DialogHeader>
        <DialogTitle>Registrar tiempo de estudio</DialogTitle>
        <DialogDescription>
          Para lo que estudiaste sin el temporizador. Horas en {timeZone.replace(/_/g, " ")}.
        </DialogDescription>
      </DialogHeader>
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <FieldGroup>
        <Field data-invalid={Boolean(errors.target)}>
          <FieldLabel htmlFor="manual-target">Qué estudiaste</FieldLabel>
          <Controller
            control={form.control}
            name="target"
            render={({ field }) => (
              <SessionTargetSelect
                id="manual-target"
                value={field.value}
                onChange={field.onChange}
                tasks={tasks}
                subjects={subjects}
              />
            )}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={Boolean(errors.date)}>
            <FieldLabel htmlFor="manual-date">Día</FieldLabel>
            <Input id="manual-date" type="date" max={todayKey} aria-invalid={Boolean(errors.date)} {...form.register("date")} />
            <FieldError errors={[errors.date]} />
          </Field>
          <Field data-invalid={Boolean(errors.startTime)}>
            <FieldLabel htmlFor="manual-start">Empezaste</FieldLabel>
            <Input id="manual-start" type="time" aria-invalid={Boolean(errors.startTime)} {...form.register("startTime")} />
            <FieldError errors={[errors.startTime]} />
          </Field>
        </div>
        <Field data-invalid={Boolean(errors.minutes)} className="max-w-40">
          <FieldLabel htmlFor="manual-minutes">Minutos de enfoque</FieldLabel>
          <Input
            id="manual-minutes"
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={Boolean(errors.minutes)}
            {...form.register("minutes")}
          />
          <FieldError errors={[errors.minutes]} />
        </Field>
        <Field data-invalid={Boolean(errors.notes)}>
          <FieldLabel htmlFor="manual-notes">Notas (opcional)</FieldLabel>
          <Textarea id="manual-notes" rows={2} {...form.register("notes")} />
          <FieldError errors={[errors.notes]} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Registrar tiempo"}
        </Button>
      </DialogFooter>
    </form>
  );
}
