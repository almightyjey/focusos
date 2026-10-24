import type { PageObjectResponse } from "@notionhq/client";

import { DEFAULT_DUE_TIME, isValidDateInput, zonedInputToUtc } from "@/domain/datetime";
import type { ExternalTaskCandidate } from "@/domain/task-import";
import type { NotionImportSettings } from "@/integrations/notion/settings";

// Traduce una página de Notion a una tarea candidata. Función pura: no llama a
// la API ni a la base, así se prueba con páginas de ejemplo.

type PropertyValue = PageObjectResponse["properties"][string];

export type MappedPage =
  | { ok: true; candidate: ExternalTaskCandidate }
  | { ok: false; title: string | null; reason: string };

const TITLE_MAX = 200;
const ESTIMATE_RANGE = { min: 1, max: 10080 };

function plainText(parts: { plain_text: string }[]): string {
  return parts
    .map((part) => part.plain_text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function titleOf(page: PageObjectResponse): string {
  const property = Object.values(page.properties).find((value) => value.type === "title");
  return property?.type === "title" ? plainText(property.title) : "";
}

/**
 * Fecha de Notion → instante UTC. Una fecha sin hora vence a las 23:59 en la
 * zona del usuario, igual que en el resto de FocusOS.
 */
export function notionDateToUtc(start: string, timeZone: string): string | null {
  if (isValidDateInput(start)) return zonedInputToUtc(start, DEFAULT_DUE_TIME, timeZone).toISOString();
  const instant = new Date(start);
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

function doneOf(value: PropertyValue | undefined, doneValues: string[]): boolean | null {
  if (!value) return null;
  const accepted = new Set(doneValues.map((v) => v.trim().toLocaleLowerCase("es")));
  switch (value.type) {
    case "checkbox":
      return value.checkbox;
    case "status":
      return value.status ? accepted.has(value.status.name.trim().toLocaleLowerCase("es")) : false;
    case "select":
      return value.select ? accepted.has(value.select.name.trim().toLocaleLowerCase("es")) : false;
    default:
      return null;
  }
}

function estimateOf(value: PropertyValue | undefined): number | null {
  if (value?.type !== "number" || value.number === null) return null;
  const minutes = Math.round(value.number);
  return minutes >= ESTIMATE_RANGE.min && minutes <= ESTIMATE_RANGE.max ? minutes : null;
}

export function mapNotionPage(
  page: PageObjectResponse,
  settings: Pick<NotionImportSettings, "dueProperty" | "doneProperty" | "doneValues" | "estimateProperty">,
  timeZone: string,
): MappedPage {
  const title = titleOf(page);
  if (page.in_trash || page.archived) return { ok: false, title: title || null, reason: "Está en la papelera de Notion." };
  if (title === "") return { ok: false, title: null, reason: "No tiene título." };

  const due = settings.dueProperty ? page.properties[settings.dueProperty] : undefined;
  const dueAt = due?.type === "date" && due.date ? notionDateToUtc(due.date.start, timeZone) : null;

  return {
    ok: true,
    candidate: {
      externalId: page.id,
      title: title.slice(0, TITLE_MAX),
      dueAt,
      done: settings.doneProperty ? doneOf(page.properties[settings.doneProperty], settings.doneValues) : null,
      estimatedMinutes: settings.estimateProperty ? estimateOf(page.properties[settings.estimateProperty]) : null,
    },
  };
}
