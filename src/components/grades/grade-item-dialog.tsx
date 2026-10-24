"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormAlert } from "@/components/auth/form-alert";
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
import { utcToZonedInput } from "@/domain/datetime";
import { GRADE_CATEGORY_LABELS } from "@/domain/labels";
import { GRADE_CATEGORIES, type GradeCategory, type GradeItem } from "@/domain/types";
import { gradeItemFormSchema, type GradeItemFormInput, type GradeItemFormValues } from "@/schemas/grade";
import { createGradeItemAction, updateGradeItemAction } from "@/server/actions/grades";

const asText = (value: number | null) => (value === null ? "" : String(value));

function defaults(item: GradeItem | undefined, timeZone: string): GradeItemFormInput {
  return {
    title: item?.title ?? "",
    category: item?.category ?? "exam",
    score: asText(item?.score ?? null),
    maxScore: item ? asText(item.maxScore) : "100",
    weight: asText(item?.weight ?? null),
    dueDate: item?.dueAt ? utcToZonedInput(item.dueAt, timeZone).date : "",
    notes: item?.notes ?? "",
  };
}

export function GradeItemDialog({
  subjectId,
  item,
  timeZone,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  subjectId: string;
  item?: GradeItem;
  timeZone: string;
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <GradeItemForm
          subjectId={subjectId}
          item={item}
          timeZone={timeZone}
          onBusyChange={setBusy}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

export function NewGradeItemButton({ subjectId, timeZone }: { subjectId: string; timeZone: string }) {
  return (
    <GradeItemDialog
      subjectId={subjectId}
      timeZone={timeZone}
      trigger={
        <Button variant="outline">
          <PlusIcon aria-hidden /> Nueva evaluación
        </Button>
      }
    />
  );
}

function GradeItemForm({
  subjectId,
  item,
  timeZone,
  onBusyChange,
  onDone,
}: {
  subjectId: string;
  item?: GradeItem;
  timeZone: string;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<GradeItemFormInput, unknown, GradeItemFormValues>({
    resolver: zodResolver(gradeItemFormSchema),
    defaultValues: defaults(item, timeZone),
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async () => {
    setServerError(null);
    onBusyChange(true);
    const values = form.getValues();
    const result = item ? await updateGradeItemAction(item.id, values) : await createGradeItemAction(subjectId, values);
    onBusyChange(false);
    if (!result.ok) {
      setServerError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (field in values && messages?.[0]) form.setError(field as keyof GradeItemFormInput, { message: messages[0] });
      }
      return;
    }
    toast.success(item ? "Evaluación actualizada" : "Evaluación creada");
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <DialogHeader>
        <DialogTitle>{item ? "Editar evaluación" : "Nueva evaluación"}</DialogTitle>
        <DialogDescription>
          Deja en blanco lo que aún no sepas. Copia la ponderación del programa de la materia.
        </DialogDescription>
      </DialogHeader>
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field data-invalid={Boolean(errors.title)}>
            <FieldLabel htmlFor="grade-title">Evaluación</FieldLabel>
            <Input
              id="grade-title"
              autoComplete="off"
              placeholder="Primer parcial"
              aria-invalid={Boolean(errors.title)}
              {...form.register("title")}
            />
            <FieldError errors={[errors.title]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="grade-category">Tipo</FieldLabel>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => field.onChange(value as GradeCategory)}>
                  <SelectTrigger id="grade-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {GRADE_CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field data-invalid={Boolean(errors.score)}>
            <FieldLabel htmlFor="grade-score">Nota</FieldLabel>
            <Input id="grade-score" inputMode="decimal" autoComplete="off" aria-invalid={Boolean(errors.score)} {...form.register("score")} />
          </Field>
          <Field data-invalid={Boolean(errors.maxScore)}>
            <FieldLabel htmlFor="grade-max">Sobre</FieldLabel>
            <Input id="grade-max" inputMode="decimal" autoComplete="off" aria-invalid={Boolean(errors.maxScore)} {...form.register("maxScore")} />
          </Field>
          <Field data-invalid={Boolean(errors.weight)}>
            <FieldLabel htmlFor="grade-weight">Pondera (%)</FieldLabel>
            <Input id="grade-weight" inputMode="decimal" autoComplete="off" aria-invalid={Boolean(errors.weight)} {...form.register("weight")} />
          </Field>
        </div>
        <FieldError errors={[errors.score, errors.maxScore, errors.weight]} />

        <Field data-invalid={Boolean(errors.dueDate)} className="sm:max-w-56">
          <FieldLabel htmlFor="grade-date">Fecha (opcional)</FieldLabel>
          <Input id="grade-date" type="date" aria-invalid={Boolean(errors.dueDate)} {...form.register("dueDate")} />
          <FieldDescription>Si la indicas, aparecerá en tus próximas entregas mientras no tenga nota.</FieldDescription>
          <FieldError errors={[errors.dueDate]} />
        </Field>

        <Field data-invalid={Boolean(errors.notes)}>
          <FieldLabel htmlFor="grade-notes">Notas (opcional)</FieldLabel>
          <Textarea id="grade-notes" rows={2} {...form.register("notes")} />
          <FieldError errors={[errors.notes]} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : item ? "Guardar cambios" : "Crear evaluación"}
        </Button>
      </DialogFooter>
    </form>
  );
}
