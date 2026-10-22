"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { FormAlert } from "@/components/auth/form-alert";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { utcToZonedInput, weekdayOfKey } from "@/domain/datetime";
import { EVENT_KIND_LABELS, WEEKDAY_LABELS, WEEKDAY_SHORT_LABELS } from "@/domain/labels";
import { parseWeeklyRule } from "@/domain/recurrence";
import { EVENT_KINDS, type EventKind, type ScheduleEvent } from "@/domain/types";
import { cn } from "@/lib/utils";
import { NONE } from "@/schemas/common";
import { eventFormSchema, type EventFormInput, type EventFormValues } from "@/schemas/event";
import { createEventAction, deleteEventAction, updateEventAction } from "@/server/actions/events";

function defaults(event: ScheduleEvent | undefined, dateKey: string, timeZone: string): EventFormInput {
  if (!event) {
    return {
      title: "",
      kind: "class",
      subjectId: NONE,
      date: dateKey,
      allDay: false,
      startTime: "",
      endTime: "",
      location: "",
      notes: "",
      repeat: "none",
      repeatDays: [],
      repeatUntil: "",
    };
  }
  const tz = event.timezone ?? timeZone;
  const start = utcToZonedInput(event.startsAt, tz);
  const end = utcToZonedInput(event.endsAt, tz);
  const rule = event.recurrenceRule ? parseWeeklyRule(event.recurrenceRule) : null;
  return {
    title: event.title,
    kind: event.kind,
    subjectId: event.subjectId ?? NONE,
    date: start.date,
    allDay: event.allDay,
    startTime: event.allDay ? "" : start.time,
    endTime: event.allDay ? "" : end.time,
    location: event.location ?? "",
    notes: event.notes ?? "",
    repeat: rule ? "weekly" : "none",
    repeatDays: rule?.byDay ?? [],
    repeatUntil: rule?.until ?? "",
  };
}

/** Lunes primero si la semana empieza en lunes. */
function orderedWeekdays(weekStartsOn: number) {
  return Array.from({ length: 7 }, (_, index) => (weekStartsOn + index) % 7);
}

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  dateKey,
  subjects,
  timeZone,
  weekStartsOn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: ScheduleEvent;
  /** Día propuesto para un evento nuevo. */
  dateKey: string;
  subjects: SubjectOption[];
  timeZone: string;
  weekStartsOn: number;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <EventForm
          event={event}
          dateKey={dateKey}
          subjects={subjects}
          timeZone={timeZone}
          weekStartsOn={weekStartsOn}
          onBusyChange={setBusy}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  event,
  dateKey,
  subjects,
  timeZone,
  weekStartsOn,
  onBusyChange,
  onDone,
}: {
  event?: ScheduleEvent;
  dateKey: string;
  subjects: SubjectOption[];
  timeZone: string;
  weekStartsOn: number;
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isEdit = Boolean(event);
  const unsupportedRule = Boolean(event?.recurrenceRule && !parseWeeklyRule(event.recurrenceRule));

  const form = useForm<EventFormInput, unknown, EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: defaults(event, dateKey, timeZone),
  });
  const { errors, isSubmitting } = form.formState;
  const [allDay, repeat, repeatDays] = useWatch({
    control: form.control,
    name: ["allDay", "repeat", "repeatDays"],
  });

  const onSubmit = form.handleSubmit(async () => {
    setServerError(null);
    onBusyChange(true);
    const values = form.getValues();
    const result = event ? await updateEventAction(event.id, values) : await createEventAction(values);
    onBusyChange(false);
    if (!result.ok) {
      setServerError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (field in values && messages?.[0]) {
          form.setError(field as keyof EventFormInput, { message: messages[0] });
        }
      }
      return;
    }
    toast.success(isEdit ? "Evento actualizado" : "Evento creado");
    onDone();
  });

  const toggleDay = (day: number) => {
    const current = form.getValues("repeatDays");
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    form.setValue("repeatDays", next, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  };

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar evento" : "Nuevo evento"}</DialogTitle>
          <DialogDescription>
            {event?.recurrenceRule
              ? "Los cambios se aplican a todas las repeticiones."
              : `Clases, exámenes o bloques de estudio. Horas en ${timeZone.replace(/_/g, " ")}.`}
          </DialogDescription>
        </DialogHeader>

        {serverError ? <FormAlert>{serverError}</FormAlert> : null}
        {unsupportedRule ? (
          <FormAlert tone="info">
            Este evento tiene una repetición que FocusOS aún no sabe editar. Si guardas, quedará como un evento único.
          </FormAlert>
        ) : null}

        <FieldGroup>
          <Field data-invalid={Boolean(errors.title)}>
            <FieldLabel htmlFor="event-title">Título</FieldLabel>
            <Input id="event-title" autoComplete="off" aria-invalid={Boolean(errors.title)} {...form.register("title")} />
            <FieldError errors={[errors.title]} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="event-kind">Tipo</FieldLabel>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(value) => field.onChange(value as EventKind)}>
                    <SelectTrigger id="event-kind" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {EVENT_KIND_LABELS[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field data-invalid={Boolean(errors.subjectId)}>
              <FieldLabel htmlFor="event-subject">Materia</FieldLabel>
              <Controller
                control={form.control}
                name="subjectId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="event-subject" className="w-full">
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
          </div>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Cuándo</legend>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <Field data-invalid={Boolean(errors.date)}>
                <FieldLabel htmlFor="event-date" className="sr-only">
                  {repeat === "weekly" ? "Desde" : "Fecha"}
                </FieldLabel>
                <Input id="event-date" type="date" aria-invalid={Boolean(errors.date)} {...form.register("date")} />
              </Field>
              <Controller
                control={form.control}
                name="allDay"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="event-all-day"
                      checked={field.value}
                      onCheckedChange={(value) => field.onChange(value === true)}
                    />
                    <label htmlFor="event-all-day" className="text-sm">
                      Todo el día
                    </label>
                  </div>
                )}
              />
            </div>
            {!allDay ? (
              <div className="grid grid-cols-2 gap-3">
                <Field data-invalid={Boolean(errors.startTime)}>
                  <FieldLabel htmlFor="event-start">Empieza</FieldLabel>
                  <Input id="event-start" type="time" aria-invalid={Boolean(errors.startTime)} {...form.register("startTime")} />
                  <FieldError errors={[errors.startTime]} />
                </Field>
                <Field data-invalid={Boolean(errors.endTime)}>
                  <FieldLabel htmlFor="event-end">Termina</FieldLabel>
                  <Input id="event-end" type="time" aria-invalid={Boolean(errors.endTime)} {...form.register("endTime")} />
                  <FieldError errors={[errors.endTime]} />
                </Field>
              </div>
            ) : null}
            <FieldError errors={[errors.date]} />
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Repetición</legend>
            <Controller
              control={form.control}
              name="repeat"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Propone el día de la fecha elegida; el usuario puede cambiarlo.
                    if (value === "weekly" && form.getValues("repeatDays").length === 0) {
                      const date = form.getValues("date");
                      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) form.setValue("repeatDays", [weekdayOfKey(date)]);
                    }
                  }}
                >
                  <SelectTrigger aria-label="Repetición" className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No se repite</SelectItem>
                    <SelectItem value="weekly">Cada semana</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {repeat === "weekly" ? (
              <>
                <div role="group" aria-label="Días de la semana" className="flex flex-wrap gap-1.5">
                  {orderedWeekdays(weekStartsOn).map((day) => {
                    const selected = repeatDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={selected}
                        aria-label={WEEKDAY_LABELS[day]}
                        onClick={() => toggleDay(day)}
                        className={cn(
                          "h-8 min-w-11 rounded-md border px-2 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {WEEKDAY_SHORT_LABELS[day]}
                      </button>
                    );
                  })}
                </div>
                <FieldError errors={[errors.repeatDays as { message?: string } | undefined]} />
                <Field data-invalid={Boolean(errors.repeatUntil)} className="sm:w-56">
                  <FieldLabel htmlFor="event-until">Hasta (opcional)</FieldLabel>
                  <Input id="event-until" type="date" aria-invalid={Boolean(errors.repeatUntil)} {...form.register("repeatUntil")} />
                  <FieldError errors={[errors.repeatUntil]} />
                </Field>
              </>
            ) : null}
          </fieldset>

          <Field data-invalid={Boolean(errors.location)}>
            <FieldLabel htmlFor="event-location">Lugar (opcional)</FieldLabel>
            <Input id="event-location" autoComplete="off" {...form.register("location")} />
            <FieldError errors={[errors.location]} />
          </Field>
          <Field data-invalid={Boolean(errors.notes)}>
            <FieldLabel htmlFor="event-notes">Notas (opcional)</FieldLabel>
            <Textarea id="event-notes" rows={2} {...form.register("notes")} />
            <FieldError errors={[errors.notes]} />
          </Field>
        </FieldGroup>

        <DialogFooter className="sm:justify-between">
          {event ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive sm:mr-auto"
              onClick={() => setConfirmingDelete(true)}
              disabled={isSubmitting}
            >
              <Trash2Icon aria-hidden /> Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear evento"}
            </Button>
          </div>
        </DialogFooter>
      </form>

      {event ? (
        <ConfirmDialog
          open={confirmingDelete}
          onOpenChange={(open) => {
            setConfirmingDelete(open);
          }}
          title="¿Eliminar este evento?"
          description={
            event.recurrenceRule
              ? `Se eliminarán todas las repeticiones de "${event.title}".`
              : `"${event.title}" se eliminará definitivamente.`
          }
          confirmLabel="Eliminar evento"
          pendingLabel="Eliminando…"
          successMessage="Evento eliminado"
          onConfirm={async () => {
            const result = await deleteEventAction(event.id);
            if (result.ok) onDone();
            return result;
          }}
        />
      ) : null}
    </>
  );
}
