"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { FormAlert } from "@/components/auth/form-alert";
import { PrioritySelect } from "@/components/forms/priority-select";
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
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DEFAULT_SUBJECT_COLOR, SUBJECT_COLORS } from "@/config/subject-colors";
import type { Subject } from "@/domain/types";
import { cn } from "@/lib/utils";
import { subjectFormSchema, type SubjectFormInput, type SubjectFormValues } from "@/schemas/subject";
import { createSubjectAction, updateSubjectAction } from "@/server/actions/subjects";

export function SubjectFormDialog({
  subject,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  subject?: Subject;
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
      <DialogContent className="sm:max-w-md">
        {/* El contenido se monta al abrir: cada apertura empieza con valores limpios. */}
        <SubjectForm subject={subject} onBusyChange={setBusy} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function SubjectForm({
  subject,
  onBusyChange,
  onDone,
}: {
  subject?: Subject;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = Boolean(subject);

  const form = useForm<SubjectFormInput, unknown, SubjectFormValues>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: {
      name: subject?.name ?? "",
      code: subject?.code ?? "",
      color: subject?.color ?? DEFAULT_SUBJECT_COLOR,
      priority: subject?.priority ?? "medium",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const currentColor = useWatch({ control: form.control, name: "color" });

  const onSubmit = form.handleSubmit(async () => {
    setServerError(null);
    onBusyChange(true);
    const values = form.getValues();
    const result = subject
      ? await updateSubjectAction(subject.id, values)
      : await createSubjectAction(values);
    onBusyChange(false);
    if (!result.ok) {
      setServerError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (field in values && messages?.[0]) {
          form.setError(field as keyof SubjectFormInput, { message: messages[0] });
        }
      }
      return;
    }
    toast.success(isEdit ? "Materia actualizada" : "Materia creada");
    onDone();
  });

  const palette = SUBJECT_COLORS.some((c) => c.value.toLowerCase() === currentColor.toLowerCase())
    ? SUBJECT_COLORS
    : [...SUBJECT_COLORS, { value: currentColor, label: "Color actual" }];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar materia" : "Nueva materia"}</DialogTitle>
        <DialogDescription>
          La prioridad indica qué materias necesitan más atención este periodo.
        </DialogDescription>
      </DialogHeader>

      {serverError ? <FormAlert>{serverError}</FormAlert> : null}

      <FieldGroup>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="subject-name">Nombre</FieldLabel>
          <Input
            id="subject-name"
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            {...form.register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(errors.code)}>
            <FieldLabel htmlFor="subject-code">Código (opcional)</FieldLabel>
            <Input id="subject-code" autoComplete="off" {...form.register("code")} />
            <FieldError errors={[errors.code]} />
          </Field>
          <Field data-invalid={Boolean(errors.priority)}>
            <FieldLabel htmlFor="subject-priority">Prioridad</FieldLabel>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <PrioritySelect
                  id="subject-priority"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(errors.priority)}
                />
              )}
            />
            <FieldError errors={[errors.priority]} />
          </Field>
        </div>

        <FieldSet>
          <FieldLegend variant="label">Color</FieldLegend>
          <div role="radiogroup" aria-label="Color de la materia" className="flex flex-wrap gap-2">
            {palette.map((option) => {
              const selected = option.value.toLowerCase() === currentColor.toLowerCase();
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.label}
                  onClick={() => form.setValue("color", option.value, { shouldDirty: true })}
                  className={cn(
                    "size-8 rounded-md border-2 border-transparent outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected && "border-foreground",
                  )}
                >
                  <span
                    className="block size-full rounded-[4px] border border-black/10"
                    style={{ backgroundColor: option.value }}
                  />
                </button>
              );
            })}
          </div>
          <FieldError errors={[errors.color]} />
        </FieldSet>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear materia"}
        </Button>
      </DialogFooter>
    </form>
  );
}
