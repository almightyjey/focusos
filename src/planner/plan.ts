import { dayKey } from "@/domain/datetime";
import type { FreeSlot } from "@/planner/availability";
import { DEFAULT_CHUNK_MINUTES, MAX_CHUNK_MINUTES, type Recommendation } from "@/planner/scoring";

/** Descanso entre bloques seguidos y bloque mínimo que vale la pena planificar. */
export const BREAK_MINUTES = 10;
export const MIN_BLOCK_MINUTES = 15;

export type PlanBlock = {
  taskId: string;
  title: string;
  subjectId: string | null;
  start: string;
  end: string;
  minutes: number;
  /** false cuando la duración es el bloque por defecto (sin estimación). */
  estimated: boolean;
};

export type PlanWarning = { taskId: string; title: string; missingMinutes: number };

export type DayPlan = {
  blocks: PlanBlock[];
  /** Tareas que vencen hoy (o ya vencieron) cuyo esfuerzo no cabe en el tiempo libre de hoy. */
  warnings: PlanWarning[];
  freeMinutes: number;
  plannedMinutes: number;
};

/**
 * Reparte las tareas, en el orden recomendado, en los huecos libres de un día.
 * Cada tarea ocupa bloques de hasta 90 min con 10 min de descanso hasta cubrir
 * su esfuerzo pendiente; las tareas sin estimación reciben un bloque de 30 min.
 */
export function planDay({
  ranking,
  slots,
  day,
  now,
  timeZone,
}: {
  ranking: Recommendation[];
  slots: FreeSlot[];
  day: string;
  now: Date;
  timeZone: string;
}): DayPlan {
  const daySlots = slots.filter((slot) => slot.dayKey === day);
  const queue = ranking.map((recommendation) => ({
    recommendation,
    left: recommendation.remainingMinutes ?? DEFAULT_CHUNK_MINUTES,
  }));
  const blocks: PlanBlock[] = [];

  for (const slot of daySlots) {
    let cursor = Math.max(Date.parse(slot.start), now.getTime());
    const slotEnd = Date.parse(slot.end);
    while (true) {
      const item = queue.find((entry) => entry.left > 0);
      if (!item) break;
      const available = Math.floor((slotEnd - cursor) / 60_000);
      const minutes = Math.min(item.left, MAX_CHUNK_MINUTES, available);
      if (minutes < Math.min(MIN_BLOCK_MINUTES, item.left)) break;
      const { task, remainingMinutes } = item.recommendation;
      blocks.push({
        taskId: task.id,
        title: task.title,
        subjectId: task.subjectId,
        start: new Date(cursor).toISOString(),
        end: new Date(cursor + minutes * 60_000).toISOString(),
        minutes,
        estimated: remainingMinutes !== null,
      });
      item.left -= minutes;
      cursor += (minutes + BREAK_MINUTES) * 60_000;
    }
  }

  const endOfDayKey = day;
  const warnings = queue
    .filter(({ recommendation, left }) => {
      const dueAt = recommendation.task.dueAt;
      return left > 0 && dueAt !== null && dayKey(dueAt, timeZone) <= endOfDayKey && recommendation.remainingMinutes !== null;
    })
    .map(({ recommendation, left }) => ({
      taskId: recommendation.task.id,
      title: recommendation.task.title,
      missingMinutes: left,
    }));

  return {
    blocks,
    warnings,
    freeMinutes: daySlots.reduce((sum, slot) => sum + slot.minutes, 0),
    plannedMinutes: blocks.reduce((sum, block) => sum + block.minutes, 0),
  };
}
