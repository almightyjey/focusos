"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatFocus } from "@/domain/sessions";
import { finishSessionSchema, type FinishSessionInput } from "@/schemas/session";
import { finishSessionAction } from "@/server/actions/sessions";

type Output = ReturnType<typeof finishSessionSchema.parse>;

export function FinishSessionDialog({
  open,
  onOpenChange,
  sessionId,
  taskTitle,
  measuredMinutes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  taskTitle: string | null;
  /** Minutos medidos al abrir el diálogo. */
  measuredMinutes: number;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <FinishForm
          sessionId={sessionId}
          taskTitle={taskTitle}
          measuredMinutes={measuredMinutes}
          onBusyChange={setBusy}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function FinishForm({
  sessionId,
  taskTitle,
  measuredMinutes,
  onBusyChange,
  onDone,
}: {
  sessionId: string;
  taskTitle: string | null;
  measuredMinutes: number;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FinishSessionInput, unknown, Output>({
    resolver: zodResolver(finishSessionSchema),
    defaultValues: { focusMinutes: String(measuredMinutes), notes: "", completeTask: false },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    if (values.focusMinutes !== null && values.focusMinutes > measuredMinutes) {
      form.setError("focusMinutes", { message: `No puede superar lo medido (${measuredMinutes} min).` });
      return;
    }
    setServerError(null);
    onBusyChange(true);
    const raw = form.getValues();
    // Sin cambios: registrar exactamente lo medido por la base, al segundo.
    const unchanged = raw.focusMinutes.trim() === String(measuredMinutes);
    const result = await finishSessionAction(sessionId, { ...raw, focusMinutes: unchanged ? "" : raw.focusMinutes });
    onBusyChange(false);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    toast.success(
      `Registraste ${formatFocus(result.data.focusSeconds)} de estudio${result.data.taskCompleted ? " y completaste la tarea" : ""}`,
    );
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <DialogHeader>
        <DialogTitle>Terminar sesión</DialogTitle>
        <DialogDescription>
          {taskTitle ? `Estudiaste "${taskTitle}". ` : ""}Revisa el tiempo antes de guardarlo.
        </DialogDescription>
      </DialogHeader>
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <FieldGroup>
        <Field data-invalid={Boolean(errors.focusMinutes)}>
          <FieldLabel htmlFor="finish-minutes">Minutos de enfoque</FieldLabel>
          <Input
            id="finish-minutes"
            inputMode="numeric"
            autoComplete="off"
            className="max-w-32"
            aria-invalid={Boolean(errors.focusMinutes)}
            {...form.register("focusMinutes")}
          />
          <FieldDescription>
            Medido: {measuredMinutes} min sin contar pausas. Puedes bajarlo si olvidaste parar el temporizador.
          </FieldDescription>
          <FieldError errors={[errors.focusMinutes]} />
        </Field>
        <Field data-invalid={Boolean(errors.notes)}>
          <FieldLabel htmlFor="finish-notes">Notas (opcional)</FieldLabel>
          <Textarea id="finish-notes" rows={2} placeholder="Qué avanzaste o dónde te quedaste" {...form.register("notes")} />
          <FieldError errors={[errors.notes]} />
        </Field>
        {taskTitle ? (
          <Controller
            control={form.control}
            name="completeTask"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="finish-complete-task"
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value === true)}
                />
                <label htmlFor="finish-complete-task" className="text-sm">
                  Marcar la tarea como completada
                </label>
              </div>
            )}
          />
        ) : null}
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          Seguir estudiando
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar sesión"}
        </Button>
      </DialogFooter>
    </form>
  );
}
