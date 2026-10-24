import type { TaskStatus } from "@/domain/types";

// Reglas de importación de tareas desde fuentes externas (Notion hoy, otras
// mañana). Función pura: decide qué crear, qué actualizar y qué dejar igual.
//
// - Cada tarea externa se identifica por (fuente, id externo): importar dos
//   veces no duplica; la base lo garantiza además con una restricción única.
// - La importación añade y actualiza, nunca borra ni vacía datos en FocusOS:
//   un campo vacío en la fuente significa "sin información", no "borrar".
// - Nunca reabre una tarea completada ni toca una cancelada en FocusOS.

export type ExternalTaskCandidate = {
  externalId: string;
  title: string;
  /** Instante ISO 8601 en UTC. */
  dueAt: string | null;
  /** true/false si la fuente indica si está hecha; null si no se sabe. */
  done: boolean | null;
  estimatedMinutes: number | null;
};

export type ExistingExternalTask = {
  id: string;
  externalId: string;
  title: string;
  dueAt: string | null;
  status: TaskStatus;
  estimatedMinutes: number | null;
};

export type TaskChanges = {
  title?: string;
  due_at?: string;
  status?: "completed";
  estimated_minutes?: number;
};

export type TaskImportPlan = {
  inserts: ExternalTaskCandidate[];
  updates: { id: string; externalId: string; changes: TaskChanges }[];
  unchanged: number;
  /** Repeticiones del mismo id externo dentro de la misma importación. */
  duplicates: number;
};

function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return new Date(a).getTime() === new Date(b).getTime();
}

export function diffExternalTask(existing: ExistingExternalTask, candidate: ExternalTaskCandidate): TaskChanges {
  const changes: TaskChanges = {};
  if (candidate.title !== existing.title) changes.title = candidate.title;
  if (candidate.dueAt !== null && !sameInstant(candidate.dueAt, existing.dueAt)) changes.due_at = candidate.dueAt;
  if (candidate.estimatedMinutes !== null && candidate.estimatedMinutes !== existing.estimatedMinutes) {
    changes.estimated_minutes = candidate.estimatedMinutes;
  }
  if (candidate.done === true && (existing.status === "pending" || existing.status === "in_progress")) {
    changes.status = "completed";
  }
  return changes;
}

export function planTaskImport(
  candidates: ExternalTaskCandidate[],
  existing: ExistingExternalTask[],
): TaskImportPlan {
  const byExternalId = new Map(existing.map((task) => [task.externalId, task]));
  const seen = new Set<string>();
  const plan: TaskImportPlan = { inserts: [], updates: [], unchanged: 0, duplicates: 0 };

  for (const candidate of candidates) {
    if (seen.has(candidate.externalId)) {
      plan.duplicates += 1;
      continue;
    }
    seen.add(candidate.externalId);

    const current = byExternalId.get(candidate.externalId);
    if (!current) {
      plan.inserts.push(candidate);
      continue;
    }
    const changes = diffExternalTask(current, candidate);
    if (Object.keys(changes).length === 0) plan.unchanged += 1;
    else plan.updates.push({ id: current.id, externalId: candidate.externalId, changes });
  }
  return plan;
}
