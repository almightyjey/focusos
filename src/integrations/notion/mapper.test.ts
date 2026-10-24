import type { PageObjectResponse } from "@notionhq/client";
import { describe, expect, it } from "vitest";

import { mapNotionPage, notionDateToUtc } from "@/integrations/notion/mapper";
import {
  mappingProblem,
  parseNotionSettings,
  type NotionImportSettings,
  type NotionSourceSchema,
} from "@/integrations/notion/settings";

const TZ = "America/Santo_Domingo"; // UTC−4, sin horario de verano

function page(properties: Record<string, unknown>, extra: Record<string, unknown> = {}): PageObjectResponse {
  return {
    object: "page",
    id: "1f2e3d4c-0000-4000-8000-000000000001",
    url: "https://www.notion.so/x",
    in_trash: false,
    archived: false,
    properties,
    ...extra,
  } as unknown as PageObjectResponse;
}

const title = (...parts: string[]) => ({ id: "title", type: "title", title: parts.map((plain_text) => ({ plain_text })) });

const settings: Pick<NotionImportSettings, "dueProperty" | "doneProperty" | "doneValues" | "estimateProperty"> = {
  dueProperty: "Entrega",
  doneProperty: "Estado",
  doneValues: ["Listo"],
  estimateProperty: "Minutos",
};

describe("mapeo de páginas de Notion", () => {
  it("convierte título, fecha, estado y estimación", () => {
    const mapped = mapNotionPage(
      page({
        Nombre: title("Práctica ", " 3"),
        Entrega: { id: "a", type: "date", date: { start: "2026-10-30", end: null, time_zone: null } },
        Estado: { id: "b", type: "status", status: { id: "s", name: "listo", color: "green" } },
        Minutos: { id: "c", type: "number", number: 44.6 },
      }),
      settings,
      TZ,
    );
    expect(mapped).toEqual({
      ok: true,
      candidate: {
        externalId: "1f2e3d4c-0000-4000-8000-000000000001",
        title: "Práctica 3",
        // Una fecha sin hora vence a las 23:59 locales.
        dueAt: "2026-10-31T03:59:00.000Z",
        done: true,
        estimatedMinutes: 45,
      },
    });
  });

  it("respeta la hora y el desfase de una fecha con hora", () => {
    expect(notionDateToUtc("2026-10-30T14:00:00.000-04:00", TZ)).toBe("2026-10-30T18:00:00.000Z");
    expect(notionDateToUtc("no es fecha", TZ)).toBeNull();
  });

  it("sin propiedades mapeadas, solo importa el título", () => {
    const mapped = mapNotionPage(
      page({ Nombre: title("Leer") }),
      { dueProperty: null, doneProperty: null, doneValues: [], estimateProperty: null },
      TZ,
    );
    expect(mapped).toMatchObject({ ok: true, candidate: { dueAt: null, done: null, estimatedMinutes: null } });
  });

  it("una casilla marca la tarea como hecha", () => {
    const mapped = mapNotionPage(
      page({ Nombre: title("Leer"), Hecho: { id: "h", type: "checkbox", checkbox: true } }),
      { ...settings, doneProperty: "Hecho", doneValues: [] },
      TZ,
    );
    expect(mapped).toMatchObject({ ok: true, candidate: { done: true } });
  });

  it("un estado que no está en la lista no cuenta como hecho", () => {
    const mapped = mapNotionPage(
      page({ Nombre: title("Leer"), Estado: { id: "b", type: "status", status: { id: "s", name: "En curso" } } }),
      settings,
      TZ,
    );
    expect(mapped).toMatchObject({ ok: true, candidate: { done: false } });
  });

  it("descarta estimaciones fuera de rango", () => {
    const mapped = mapNotionPage(
      page({ Nombre: title("Leer"), Minutos: { id: "c", type: "number", number: -5 } }),
      settings,
      TZ,
    );
    expect(mapped).toMatchObject({ ok: true, candidate: { estimatedMinutes: null } });
  });

  it("omite páginas sin título o en la papelera, con el motivo", () => {
    expect(mapNotionPage(page({ Nombre: title("  ") }), settings, TZ)).toEqual({
      ok: false,
      title: null,
      reason: "No tiene título.",
    });
    expect(mapNotionPage(page({ Nombre: title("Vieja") }, { in_trash: true }), settings, TZ)).toEqual({
      ok: false,
      title: "Vieja",
      reason: "Está en la papelera de Notion.",
    });
  });

  it("recorta títulos largos al máximo de FocusOS", () => {
    const mapped = mapNotionPage(page({ Nombre: title("x".repeat(300)) }), settings, TZ);
    expect(mapped.ok && mapped.candidate.title.length).toBe(200);
  });
});

describe("configuración de la importación", () => {
  const schema: NotionSourceSchema = {
    id: "s",
    name: "Tareas",
    properties: [
      { name: "Entrega", type: "date", options: [] },
      { name: "Estado", type: "status", options: ["Pendiente", "Listo"] },
      { name: "Minutos", type: "number", options: [] },
      { name: "Notas", type: "rich_text", options: [] },
    ],
  };
  const valid: NotionImportSettings = {
    dataSourceId: "1f2e3d4c-0000-4000-8000-000000000002",
    dataSourceName: "Tareas",
    subjectId: null,
    ...settings,
  };

  it("acepta propiedades existentes con el tipo correcto", () => {
    expect(mappingProblem(valid, schema)).toBeNull();
  });

  it("detecta propiedades borradas, de otro tipo o estados sin valores", () => {
    expect(mappingProblem({ ...valid, dueProperty: "Fecha" }, schema)).toContain("ya no existe");
    expect(mappingProblem({ ...valid, estimateProperty: "Notas" }, schema)).toContain("cambió de tipo");
    expect(mappingProblem({ ...valid, doneValues: [] }, schema)).toContain("cuentan como completada");
  });

  it("una configuración guardada con basura equivale a no configurada", () => {
    expect(parseNotionSettings({ import: { dataSourceId: "<script>" }, workspaceName: 3 })).toEqual({
      workspaceName: null,
      import: null,
    });
    expect(parseNotionSettings(null)).toEqual({ workspaceName: null, import: null });
    expect(parseNotionSettings({ workspaceName: "Mi espacio", import: valid })).toEqual({
      workspaceName: "Mi espacio",
      import: valid,
    });
  });
});
