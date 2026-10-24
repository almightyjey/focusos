import { z } from "zod";

// Preferencias de la importación desde Notion. Se guardan en
// integrations.settings (jsonb, sin secretos). Como el usuario puede escribir
// esa columna, se validan cada vez que se leen.

export const NOTION_SOURCE = "notion";

const notionId = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i, "Id de Notion no válido");
const propertyName = z.string().trim().min(1).max(200);

/** Tipos de propiedad de Notion que admite cada campo de FocusOS. */
export const PROPERTY_TYPES = {
  due: ["date"],
  done: ["checkbox", "status", "select"],
  estimate: ["number"],
} as const;

export const notionImportSettingsSchema = z.object({
  dataSourceId: notionId,
  dataSourceName: z.string().trim().max(200).nullable(),
  dueProperty: propertyName.nullable(),
  doneProperty: propertyName.nullable(),
  /** Valores de estado o selección que cuentan como completada. */
  doneValues: z.array(z.string().trim().min(1).max(100)).max(20),
  estimateProperty: propertyName.nullable(),
  /** Materia que reciben las tareas nuevas. */
  subjectId: z.uuid().nullable(),
});

export type NotionImportSettings = z.output<typeof notionImportSettingsSchema>;

export const notionSettingsSchema = z.object({
  workspaceName: z.string().max(200).nullable().catch(null),
  import: notionImportSettingsSchema.nullable().catch(null),
});

export type NotionSettings = z.output<typeof notionSettingsSchema>;

/** Lee la columna settings. Cualquier valor raro equivale a "sin configurar". */
export function parseNotionSettings(value: unknown): NotionSettings {
  const parsed = notionSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { workspaceName: null, import: null };
}

/** Esquema simplificado de una base de Notion, para la interfaz y la validación. */
export type NotionSourceSchema = {
  id: string;
  name: string;
  properties: { name: string; type: string; options: string[] }[];
};

/** Comprueba que las propiedades elegidas existen y tienen un tipo admitido. */
export function mappingProblem(settings: NotionImportSettings, schema: NotionSourceSchema): string | null {
  const checks: [string | null, readonly string[], string][] = [
    [settings.dueProperty, PROPERTY_TYPES.due, "fecha límite"],
    [settings.doneProperty, PROPERTY_TYPES.done, "completada"],
    [settings.estimateProperty, PROPERTY_TYPES.estimate, "estimación"],
  ];
  for (const [name, types, label] of checks) {
    if (name === null) continue;
    const property = schema.properties.find((p) => p.name === name);
    if (!property) return `La propiedad «${name}» (${label}) ya no existe en la base de Notion.`;
    if (!types.includes(property.type)) return `La propiedad «${name}» (${label}) cambió de tipo en Notion.`;
  }
  const done = schema.properties.find((p) => p.name === settings.doneProperty);
  if (done && done.type !== "checkbox" && settings.doneValues.length === 0) {
    return `Indica qué valores de «${done.name}» cuentan como completada.`;
  }
  return null;
}
