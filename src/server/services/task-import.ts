import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { planTaskImport, type ExistingExternalTask, type ExternalTaskCandidate } from "@/domain/task-import";
import type { Database } from "@/lib/supabase/database.types";
import { toDataError } from "@/server/errors";

// Aplica un plan de importación con el cliente del usuario (RLS): solo puede
// leer y escribir sus propias tareas. Cuenta lo que de verdad se guardó.

export type ImportOutcome = {
  created: number;
  updated: number;
  unchanged: number;
  /** Filas que la base rechazó. Si es > 0, la importación no fue completa. */
  failed: number;
  duplicates: number;
};

const CHUNK = 100;
const UPDATE_CONCURRENCY = 5;

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

async function loadExisting(
  supabase: SupabaseClient<Database>,
  source: string,
  externalIds: string[],
): Promise<ExistingExternalTask[]> {
  const existing: ExistingExternalTask[] = [];
  for (const ids of chunks(externalIds, CHUNK)) {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, external_id, title, due_at, status, estimated_minutes")
      .eq("external_source", source)
      .in("external_id", ids);
    if (error) throw toDataError(error);
    for (const row of data) {
      if (row.external_id === null) continue;
      existing.push({
        id: row.id,
        externalId: row.external_id,
        title: row.title,
        dueAt: row.due_at,
        status: row.status,
        estimatedMinutes: row.estimated_minutes,
      });
    }
  }
  return existing;
}

export async function applyTaskImport(
  supabase: SupabaseClient<Database>,
  userId: string,
  source: string,
  candidates: ExternalTaskCandidate[],
  defaults: { subjectId: string | null },
): Promise<ImportOutcome> {
  const existing = await loadExisting(supabase, source, [...new Set(candidates.map((c) => c.externalId))]);
  const plan = planTaskImport(candidates, existing);
  const outcome: ImportOutcome = { created: 0, updated: 0, unchanged: plan.unchanged, failed: 0, duplicates: plan.duplicates };

  for (const batch of chunks(plan.inserts, CHUNK)) {
    const rows = batch.map((candidate) => ({
      user_id: userId,
      title: candidate.title,
      due_at: candidate.dueAt,
      estimated_minutes: candidate.estimatedMinutes,
      status: candidate.done ? ("completed" as const) : ("pending" as const),
      subject_id: defaults.subjectId,
      external_source: source,
      external_id: candidate.externalId,
    }));
    // ON CONFLICT DO NOTHING: si otra importación simultánea ya la creó, no se duplica.
    const { data, error } = await supabase
      .from("tasks")
      .upsert(rows, { onConflict: "user_id,external_source,external_id", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.error("[import] No se pudieron crear tareas", { source, code: error.code, count: rows.length });
      outcome.failed += rows.length;
      continue;
    }
    outcome.created += data.length;
    outcome.unchanged += rows.length - data.length;
  }

  for (const batch of chunks(plan.updates, UPDATE_CONCURRENCY)) {
    await Promise.all(
      batch.map(async (update) => {
        const { data, error } = await supabase
          .from("tasks")
          .update(update.changes)
          .eq("id", update.id)
          .eq("external_source", source)
          .select("id")
          .maybeSingle();
        if (error || !data) {
          if (error) console.error("[import] No se pudo actualizar una tarea", { source, code: error.code });
          outcome.failed += 1;
        } else {
          outcome.updated += 1;
        }
      }),
    );
  }

  return outcome;
}
