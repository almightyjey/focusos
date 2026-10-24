import { formatDueLabel, formatMinutes } from "@/domain/datetime";
import { PRIORITY_RANK } from "@/domain/labels";
import type { PriorityLevel, Task } from "@/domain/types";
import { freeMinutesBetween, type FreeSlot } from "@/planner/availability";

// Modelo de puntuación (determinista y explicable)
//
//   puntuación = Σ peso × valor, con cada valor en [0, 1]
//
//   urgencia     45 %  cercanía del vencimiento; 1 si ya venció o si el esfuerzo
//                      restante no cabe en el tiempo libre antes de la entrega
//   prioridad    25 %  prioridad de la tarea
//   materia      10 %  prioridad de su materia
//   dificultad   10 %  lo difícil conviene empezarlo antes (sin dato = neutra)
//   encaje       10 %  si el siguiente bloque cabe en el próximo hueco libre

export const WEIGHTS = { urgency: 0.45, priority: 0.25, subject: 0.1, difficulty: 0.1, fit: 0.1 } as const;
export type FactorKey = keyof typeof WEIGHTS;

export const FACTOR_LABELS: Record<FactorKey, string> = {
  urgency: "Urgencia",
  priority: "Prioridad",
  subject: "Materia",
  difficulty: "Dificultad",
  fit: "Encaje",
};

/** Bloque máximo de trabajo seguido y bloque para tareas sin estimación. */
export const MAX_CHUNK_MINUTES = 90;
export const DEFAULT_CHUNK_MINUTES = 30;

const PRIORITY_VALUE: Record<PriorityLevel, number> = { low: 0.25, medium: 0.5, high: 0.75, urgent: 1 };
const NO_DUE_DATE_URGENCY = 0.1;
const AT_RISK_URGENCY = 0.95;
const DAY_MS = 86_400_000;

export type Factor = { value: number; weight: number; contribution: number };

export type Recommendation = {
  task: Task;
  score: number;
  factors: Record<FactorKey, Factor>;
  reasons: string[];
  /** Esfuerzo pendiente: estimación menos lo ya estudiado; null si no se puede saber. */
  remainingMinutes: number | null;
  /** Duración del siguiente bloque sugerido. */
  chunkMinutes: number;
  /** Minutos libres entre ahora y la entrega (si vence dentro del horizonte). */
  freeMinutesBeforeDue: number | null;
  atRisk: boolean;
};

const round4 = (value: number) => Math.round(value * 10_000) / 10_000;

export function remainingMinutes(task: Task): number | null {
  if (task.estimatedMinutes === null) return null;
  const left = task.estimatedMinutes - Math.floor((task.focusSeconds ?? 0) / 60);
  // Si ya se superó la estimación sin terminar, lo que falta es desconocido.
  return left > 0 ? left : null;
}

/** Urgencia por cercanía: 1 al vencer, 0.5 a dos días, ~0.22 a una semana. */
export function proximityUrgency(dueAt: string | null, now: Date): number {
  if (!dueAt) return NO_DUE_DATE_URGENCY;
  const days = (Date.parse(dueAt) - now.getTime()) / DAY_MS;
  if (days <= 0) return 1;
  return 1 / (1 + days / 2);
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Ordena las tareas abiertas por lo que conviene hacer primero. Mismas
 * entradas, mismo resultado: los empates se resuelven por fecha límite,
 * prioridad y, por último, el id.
 */
export function rankTasks({
  tasks,
  subjectPriority,
  slots,
  horizonEnd,
  now,
  timeZone,
}: {
  tasks: Task[];
  /** Prioridad de cada materia por id. */
  subjectPriority: Map<string, PriorityLevel>;
  /** Huecos libres desde ahora hasta el fin del horizonte, en orden. */
  slots: FreeSlot[];
  horizonEnd: Date;
  now: Date;
  timeZone: string;
}): Recommendation[] {
  const nextSlot = slots.find((slot) => Date.parse(slot.end) > now.getTime()) ?? null;

  const recommendations = tasks
    .filter((task) => task.status === "pending" || task.status === "in_progress")
    .map((task): Recommendation => {
      const remaining = remainingMinutes(task);
      const chunk = Math.min(remaining ?? DEFAULT_CHUNK_MINUTES, MAX_CHUNK_MINUTES);
      const due = task.dueAt ? Date.parse(task.dueAt) : null;
      const withinHorizon = due !== null && due > now.getTime() && due <= horizonEnd.getTime();
      const freeBeforeDue = withinHorizon ? freeMinutesBetween(slots, now.getTime(), due) : null;
      const atRisk = remaining !== null && freeBeforeDue !== null && remaining > freeBeforeDue;

      const proximity = proximityUrgency(task.dueAt, now);
      const values: Record<FactorKey, number> = {
        urgency: atRisk ? Math.max(proximity, AT_RISK_URGENCY) : proximity,
        priority: PRIORITY_VALUE[task.priority],
        subject: task.subjectId ? PRIORITY_VALUE[subjectPriority.get(task.subjectId) ?? "medium"] : PRIORITY_VALUE.medium,
        difficulty: task.difficulty === null ? 0.5 : (task.difficulty - 1) / 4,
        fit: nextSlot ? Math.min(1, nextSlot.minutes / chunk) : 0,
      };
      const factors = Object.fromEntries(
        (Object.keys(WEIGHTS) as FactorKey[]).map((key) => [
          key,
          { value: round4(values[key]), weight: WEIGHTS[key], contribution: round4(values[key] * WEIGHTS[key]) },
        ]),
      ) as Record<FactorKey, Factor>;
      const score = round4((Object.keys(WEIGHTS) as FactorKey[]).reduce((sum, key) => sum + factors[key].contribution, 0));

      const reasons: string[] = [];
      if (due !== null && due <= now.getTime()) {
        reasons.push(`Venció ${lowerFirst(formatDueLabel(task.dueAt!, now, timeZone))}`);
      } else if (due !== null && due - now.getTime() <= 2 * DAY_MS) {
        reasons.push(`Vence ${lowerFirst(formatDueLabel(task.dueAt!, now, timeZone))}`);
      }
      if (atRisk) {
        reasons.push(
          `Necesita unas ${formatMinutes(remaining!)} y antes de la entrega tienes ${formatMinutes(freeBeforeDue!)} libres`,
        );
      }
      if (task.priority === "urgent") reasons.push("Prioridad urgente");
      else if (task.priority === "high") reasons.push("Prioridad alta");
      const subjectLevel = task.subjectId ? subjectPriority.get(task.subjectId) : undefined;
      if (subjectLevel === "high" || subjectLevel === "urgent") reasons.push("Materia prioritaria");
      if (task.difficulty !== null && task.difficulty >= 4) reasons.push("Es difícil: conviene empezar con tiempo");
      if (nextSlot && nextSlot.minutes >= chunk) reasons.push(`Cabe en tu próximo hueco libre (${formatMinutes(nextSlot.minutes)})`);
      if (remaining === null) {
        reasons.push(
          task.estimatedMinutes === null
            ? `Sin estimación: se propone un bloque de ${DEFAULT_CHUNK_MINUTES} min`
            : `Ya superaste la estimación: se propone un bloque de ${DEFAULT_CHUNK_MINUTES} min`,
        );
      }

      return {
        task,
        score,
        factors,
        reasons,
        remainingMinutes: remaining,
        chunkMinutes: chunk,
        freeMinutesBeforeDue: freeBeforeDue,
        atRisk,
      };
    });

  return recommendations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const dueA = a.task.dueAt ? Date.parse(a.task.dueAt) : Number.POSITIVE_INFINITY;
    const dueB = b.task.dueAt ? Date.parse(b.task.dueAt) : Number.POSITIVE_INFINITY;
    if (dueA !== dueB) return dueA - dueB;
    const priority = PRIORITY_RANK[b.task.priority] - PRIORITY_RANK[a.task.priority];
    if (priority !== 0) return priority;
    return a.task.id < b.task.id ? -1 : a.task.id > b.task.id ? 1 : 0;
  });
}
