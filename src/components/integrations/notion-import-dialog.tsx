"use client";

import { Suspense, use, useState, useTransition } from "react";
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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
import { PROPERTY_TYPES, type NotionImportSettings, type NotionSourceSchema } from "@/integrations/notion/settings";
import { NONE } from "@/schemas/common";
import type { ActionResult } from "@/server/action-result";
import { getNotionSourceAction, saveNotionSettingsAction } from "@/server/actions/integrations";

const nativeSelectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

const TYPE_LABELS: Record<string, string> = {
  checkbox: "casilla",
  status: "estado",
  select: "selección",
  date: "fecha",
  number: "número",
};

export type NotionDialogData = {
  sources: Promise<ActionResult<{ id: string; name: string }[]>>;
  schema: Promise<ActionResult<NotionSourceSchema>> | null;
};

export function NotionImportDialog({
  data,
  current,
  subjects,
  onClose,
}: {
  /** Promesas creadas al abrir: el diálogo se monta con ellas en curso. */
  data: NotionDialogData | null;
  current: NotionImportSettings | null;
  subjects: SubjectOption[];
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={data !== null} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importación desde Notion</DialogTitle>
          <DialogDescription>
            Elige la base de Notion y qué propiedad corresponde a cada dato. FocusOS solo lee: no cambia nada en Notion.
          </DialogDescription>
        </DialogHeader>
        {data ? (
          <Suspense fallback={<Skeleton className="h-40 w-full" />}>
            <NotionImportForm data={data} current={current} subjects={subjects} onBusyChange={setBusy} onDone={onClose} />
          </Suspense>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function propertySelect(
  id: string,
  label: string,
  emptyLabel: string,
  value: string,
  options: NotionSourceSchema["properties"],
  onChange: (value: string) => void,
  description?: string,
) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select id={id} className={nativeSelectClass} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value={NONE}>{emptyLabel}</option>
        {options.map((property) => (
          <option key={property.name} value={property.name}>
            {property.name} ({TYPE_LABELS[property.type] ?? property.type})
          </option>
        ))}
      </select>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

function NotionImportForm({
  data,
  current,
  subjects,
  onBusyChange,
  onDone,
}: {
  data: NotionDialogData;
  current: NotionImportSettings | null;
  subjects: SubjectOption[];
  onBusyChange: (busy: boolean) => void;
  onDone: () => void;
}) {
  const sources = use(data.sources);
  const initialSchema = data.schema ? use(data.schema) : null;

  const [schema, setSchema] = useState<NotionSourceSchema | null>(initialSchema?.ok ? initialSchema.data : null);
  const [error, setError] = useState<string | null>(
    initialSchema && !initialSchema.ok ? initialSchema.error : sources.ok ? null : sources.error,
  );
  const [dataSourceId, setDataSourceId] = useState(current?.dataSourceId ?? "");
  const [dueProperty, setDueProperty] = useState(current?.dueProperty ?? NONE);
  const [doneProperty, setDoneProperty] = useState(current?.doneProperty ?? NONE);
  const [doneValues, setDoneValues] = useState<string[]>(current?.doneValues ?? []);
  const [estimateProperty, setEstimateProperty] = useState(current?.estimateProperty ?? NONE);
  const [subjectId, setSubjectId] = useState(current?.subjectId ?? NONE);
  const [loadingSchema, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  if (!sources.ok) return <FormAlert>{sources.error}</FormAlert>;

  const chooseSource = (id: string) => {
    setDataSourceId(id);
    setSchema(null);
    setDueProperty(NONE);
    setDoneProperty(NONE);
    setDoneValues([]);
    setEstimateProperty(NONE);
    setError(null);
    if (!id) return;
    startLoading(async () => {
      const result = await getNotionSourceAction(id);
      if (result.ok) setSchema(result.data);
      else setError(result.error);
    });
  };

  const ofTypes = (types: readonly string[]) => schema?.properties.filter((p) => types.includes(p.type)) ?? [];
  const doneSchema = schema?.properties.find((p) => p.name === doneProperty);

  const save = () =>
    startSaving(async () => {
      if (!schema) return;
      onBusyChange(true);
      setError(null);
      const result = await saveNotionSettingsAction({
        dataSourceId,
        dataSourceName: schema.name,
        dueProperty: dueProperty === NONE ? null : dueProperty,
        doneProperty: doneProperty === NONE ? null : doneProperty,
        doneValues: doneSchema && doneSchema.type !== "checkbox" ? doneValues : [],
        estimateProperty: estimateProperty === NONE ? null : estimateProperty,
        subjectId: subjectId === NONE ? null : subjectId,
      });
      onBusyChange(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Importación configurada");
      onDone();
    });

  return (
    <div className="space-y-5">
      {error ? <FormAlert>{error}</FormAlert> : null}
      {sources.data.length === 0 ? (
        <FormAlert tone="info">
          No hay bases compartidas con FocusOS. En Notion, abre la base y añade la conexión desde «Conexiones», o vuelve a
          conectar y selecciónala.
        </FormAlert>
      ) : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="notion-source">Base de Notion</FieldLabel>
          <select
            id="notion-source"
            className={nativeSelectClass}
            value={dataSourceId}
            onChange={(event) => chooseSource(event.target.value)}
          >
            <option value="">Elige una base</option>
            {sources.data.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
          <FieldDescription>El título de cada página será el título de la tarea.</FieldDescription>
        </Field>

        {loadingSchema ? <Skeleton className="h-24 w-full" /> : null}

        {schema ? (
          <>
            {propertySelect("notion-due", "Fecha límite", "Sin fecha", dueProperty, ofTypes(PROPERTY_TYPES.due), setDueProperty)}
            {propertySelect(
              "notion-done",
              "Completada",
              "No importar si está hecha",
              doneProperty,
              ofTypes(PROPERTY_TYPES.done),
              (value) => {
                setDoneProperty(value);
                setDoneValues([]);
              },
              "Las tareas hechas en Notion se marcan como completadas. Nunca se reabre una tarea.",
            )}
            {doneSchema && doneSchema.type !== "checkbox" ? (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Valores que cuentan como completada</legend>
                {doneSchema.options.map((option, index) => {
                  const id = `notion-done-${index}`;
                  return (
                    <div key={option} className="flex items-center gap-2">
                      <Checkbox
                        id={id}
                        checked={doneValues.includes(option)}
                        onCheckedChange={(checked) =>
                          setDoneValues((values) =>
                            checked === true ? [...values, option] : values.filter((v) => v !== option),
                          )
                        }
                      />
                      <Label htmlFor={id}>{option}</Label>
                    </div>
                  );
                })}
              </fieldset>
            ) : null}
            {propertySelect(
              "notion-estimate",
              "Estimación en minutos",
              "Sin estimación",
              estimateProperty,
              ofTypes(PROPERTY_TYPES.estimate),
              setEstimateProperty,
            )}
          </>
        ) : null}

        <Field>
          <FieldLabel htmlFor="notion-subject">Materia para las tareas nuevas</FieldLabel>
          <select
            id="notion-subject"
            className={nativeSelectClass}
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          >
            <option value={NONE}>Sin materia</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button onClick={save} disabled={!schema || saving || loadingSchema}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </div>
  );
}
