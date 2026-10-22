"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlayIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { FormAlert } from "@/components/auth/form-alert";
import { SessionTargetSelect, type TaskOption } from "@/components/sessions/session-target-select";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SESSION_PRESETS } from "@/domain/sessions";
import { cn } from "@/lib/utils";
import { NONE } from "@/schemas/common";
import { startSessionSchema, type StartSessionInput } from "@/schemas/session";
import { startSessionAction } from "@/server/actions/sessions";

type Output = ReturnType<typeof startSessionSchema.parse>;

const CUSTOM = "custom";

export function StartSessionForm({
  tasks,
  subjects,
  defaultTarget,
}: {
  tasks: TaskOption[];
  subjects: SubjectOption[];
  defaultTarget?: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [mode, setMode] = useState<string>(String(SESSION_PRESETS[0]));

  const form = useForm<StartSessionInput, unknown, Output>({
    resolver: zodResolver(startSessionSchema),
    defaultValues: { target: defaultTarget ?? (tasks[0] ? `task:${tasks[0].id}` : NONE), plannedMinutes: "25" },
  });
  const { errors, isSubmitting } = form.formState;
  const planned = useWatch({ control: form.control, name: "plannedMinutes" });

  const choose = (value: string) => {
    setMode(value);
    if (value === CUSTOM) {
      form.setValue("plannedMinutes", "");
      form.setFocus("plannedMinutes");
    } else {
      form.setValue("plannedMinutes", value === NONE ? "" : value, { shouldValidate: form.formState.isSubmitted });
    }
  };

  const onSubmit = form.handleSubmit(async () => {
    setServerError(null);
    const result = await startSessionAction(form.getValues());
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    toast.success("Sesión iniciada");
  });

  const options = [
    ...SESSION_PRESETS.map((minutes) => ({ value: String(minutes), label: `${minutes} min` })),
    { value: NONE, label: "Sin límite" },
    { value: CUSTOM, label: "Otra" },
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6" aria-labelledby="start-heading">
      <div>
        <h2 id="start-heading" className="text-lg font-semibold tracking-tight">
          Empezar a estudiar
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          El tiempo se mide en el servidor: puedes cerrar la pestaña y seguirá contando.
        </p>
      </div>
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <FieldGroup>
        <Field data-invalid={Boolean(errors.target)}>
          <FieldLabel htmlFor="session-target">Qué vas a estudiar</FieldLabel>
          <Controller
            control={form.control}
            name="target"
            render={({ field }) => (
              <SessionTargetSelect
                id="session-target"
                value={field.value}
                onChange={field.onChange}
                tasks={tasks}
                subjects={subjects}
                invalid={Boolean(errors.target)}
              />
            )}
          />
          <FieldError errors={[errors.target as { message?: string } | undefined]} />
        </Field>

        <FieldSet>
          <FieldLegend variant="label">Duración</FieldLegend>
          <div role="radiogroup" aria-label="Duración de la sesión" className="flex flex-wrap gap-2">
            {options.map((option) => {
              const selected = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(option.value)}
                  className={cn(
                    "h-8 rounded-lg border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input text-muted-foreground hover:bg-muted",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {mode === CUSTOM ? (
            <Field data-invalid={Boolean(errors.plannedMinutes)} className="max-w-40">
              <FieldLabel htmlFor="session-minutes">Minutos</FieldLabel>
              <Input
                id="session-minutes"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={Boolean(errors.plannedMinutes)}
                {...form.register("plannedMinutes")}
              />
            </Field>
          ) : null}
          <FieldDescription>
            {planned === "" && mode !== CUSTOM
              ? "Cuenta hacia arriba hasta que termines."
              : "Al llegar a cero, el temporizador sigue contando como tiempo extra."}
          </FieldDescription>
          <FieldError errors={[errors.plannedMinutes]} />
        </FieldSet>
      </FieldGroup>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        <PlayIcon aria-hidden /> {isSubmitting ? "Empezando…" : "Empezar"}
      </Button>
    </form>
  );
}
