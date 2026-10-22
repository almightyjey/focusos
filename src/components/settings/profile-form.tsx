"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FormAlert } from "@/components/auth/form-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { WEEKDAY_LABELS } from "@/domain/labels";
import type { Profile } from "@/domain/types";
import { profileFormSchema, WEEK_START_OPTIONS, type ProfileFormInput, type ProfileFormValues } from "@/schemas/profile";
import { updateProfileAction } from "@/server/actions/profile";

const nativeSelectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

export function ProfileForm({
  profile,
  email,
  timeZones,
}: {
  profile: Profile;
  email: string | null;
  /** Lista calculada en el servidor para que coincida al hidratar. */
  timeZones: string[];
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: profile.displayName ?? "",
      timezone: profile.timezone,
      weekStartsOn: String(profile.weekStartsOn) as ProfileFormInput["weekStartsOn"],
    },
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  const onSubmit = form.handleSubmit(async () => {
    setServerError(null);
    const values = form.getValues();
    const result = await updateProfileAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    form.reset(values);
    toast.success("Ajustes guardados");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-lg space-y-6">
      {serverError ? <FormAlert>{serverError}</FormAlert> : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="settings-email">Correo</FieldLabel>
          <Input id="settings-email" value={email ?? ""} readOnly disabled />
        </Field>
        <Field data-invalid={Boolean(errors.displayName)}>
          <FieldLabel htmlFor="settings-name">Nombre</FieldLabel>
          <Input id="settings-name" autoComplete="given-name" {...form.register("displayName")} />
          <FieldError errors={[errors.displayName]} />
        </Field>
        <Field data-invalid={Boolean(errors.timezone)}>
          <FieldLabel htmlFor="settings-timezone">Zona horaria</FieldLabel>
          <select
            id="settings-timezone"
            className={nativeSelectClass}
            aria-invalid={Boolean(errors.timezone)}
            {...form.register("timezone")}
          >
            {timeZones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <FieldDescription>
            Las fechas límite y el resumen de &quot;Hoy&quot; se calculan con esta zona.
          </FieldDescription>
          <FieldError errors={[errors.timezone]} />
        </Field>
        <Field data-invalid={Boolean(errors.weekStartsOn)}>
          <FieldLabel htmlFor="settings-week">La semana empieza el</FieldLabel>
          <select id="settings-week" className={nativeSelectClass} {...form.register("weekStartsOn")}>
            {WEEK_START_OPTIONS.map((day) => (
              <option key={day} value={day}>
                {WEEKDAY_LABELS[Number(day)]}
              </option>
            ))}
          </select>
          <FieldError errors={[errors.weekStartsOn]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? "Guardando…" : "Guardar ajustes"}
      </Button>
    </form>
  );
}
