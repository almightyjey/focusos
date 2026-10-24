import { describe, expect, it } from "vitest";

import {
  diffExternalTask,
  planTaskImport,
  type ExistingExternalTask,
  type ExternalTaskCandidate,
} from "@/domain/task-import";

const candidate = (overrides: Partial<ExternalTaskCandidate> = {}): ExternalTaskCandidate => ({
  externalId: "page-1",
  title: "Leer capítulo 3",
  dueAt: "2026-10-31T03:59:00.000Z",
  done: false,
  estimatedMinutes: 45,
  ...overrides,
});

const existing = (overrides: Partial<ExistingExternalTask> = {}): ExistingExternalTask => ({
  id: "task-1",
  externalId: "page-1",
  title: "Leer capítulo 3",
  // Postgres devuelve otro formato del mismo instante.
  dueAt: "2026-10-31T03:59:00+00:00",
  status: "pending",
  estimatedMinutes: 45,
  ...overrides,
});

describe("plan de importación", () => {
  it("crea lo nuevo y deja igual lo que no cambió", () => {
    const plan = planTaskImport([candidate(), candidate({ externalId: "page-2", title: "Otra" })], [existing()]);
    expect(plan.inserts.map((c) => c.externalId)).toEqual(["page-2"]);
    expect(plan.updates).toEqual([]);
    expect(plan.unchanged).toBe(1);
  });

  it("importar dos veces lo mismo no crea nada", () => {
    const first = planTaskImport([candidate()], []);
    expect(first.inserts).toHaveLength(1);
    const second = planTaskImport([candidate()], [existing()]);
    expect(second.inserts).toHaveLength(0);
    expect(second.unchanged).toBe(1);
  });

  it("ignora ids repetidos dentro de la misma importación", () => {
    const plan = planTaskImport([candidate(), candidate({ title: "Duplicada" })], []);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.duplicates).toBe(1);
  });

  it("actualiza solo los campos que cambiaron en la fuente", () => {
    const plan = planTaskImport(
      [candidate({ title: "Leer capítulo 4", dueAt: "2026-11-01T03:59:00.000Z", estimatedMinutes: 60 })],
      [existing()],
    );
    expect(plan.updates).toEqual([
      {
        id: "task-1",
        externalId: "page-1",
        changes: { title: "Leer capítulo 4", due_at: "2026-11-01T03:59:00.000Z", estimated_minutes: 60 },
      },
    ]);
  });
});

describe("reglas de actualización", () => {
  it("un campo vacío en la fuente no borra el dato de FocusOS", () => {
    expect(diffExternalTask(existing(), candidate({ dueAt: null, estimatedMinutes: null, done: null }))).toEqual({});
  });

  it("marca como completada lo que se hizo en la fuente", () => {
    expect(diffExternalTask(existing(), candidate({ done: true }))).toEqual({ status: "completed" });
    expect(diffExternalTask(existing({ status: "in_progress" }), candidate({ done: true }))).toEqual({
      status: "completed",
    });
  });

  it("nunca reabre una tarea completada ni toca una cancelada", () => {
    expect(diffExternalTask(existing({ status: "completed" }), candidate({ done: false }))).toEqual({});
    expect(diffExternalTask(existing({ status: "cancelled" }), candidate({ done: true }))).toEqual({});
  });

  it("no vuelve a marcar una tarea ya completada", () => {
    expect(diffExternalTask(existing({ status: "completed" }), candidate({ done: true }))).toEqual({});
  });
});
