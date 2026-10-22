import { addDaysToKey, dayKey, startOfWeekKey } from "@/domain/datetime";
import type { EventOccurrence } from "@/domain/events";
import type { Task } from "@/domain/types";

export type StudySessionStatus = "planned" | "active" | "completed" | "cancelled";

export type StudySession = {
  id: string;
  taskId: string | null;
  subjectId: string | null;
  status: StudySessionStatus;
  /** Objetivo de la sesión en minutos; null = sin límite. */
  plannedMinutes: number | null;
  startedAt: string | null;
  endedAt: string | null;
  pausedAt: string | null;
  pausedSeconds: number;
  /** Enfoque registrado (solo en sesiones completadas). */
  focusSeconds: number | null;
  notes: string | null;
};

/** Sesión con los datos de su tarea y materia para mostrarla. */
export type SessionWithTask = StudySession & {
  taskTitle: string | null;
  subjectName: string | null;
  subjectColor: string | null;
};

/** Duraciones propuestas al empezar (minutos). */
export const SESSION_PRESETS = [25, 50, 90] as const;

/**
 * Segundos de enfoque de una sesión en el instante `nowMs`: tiempo desde el
 * inicio menos las pausas (incluida la que esté en curso). Replica la fórmula
 * de finish_study_session para que la interfaz muestre lo que se registrará.
 */
export function focusSecondsAt(session: StudySession, nowMs: number): number {
  if (session.status === "completed") return session.focusSeconds ?? 0;
  if (!session.startedAt) return 0;
  const end = session.endedAt ? Date.parse(session.endedAt) : nowMs;
  const pausedNow = session.pausedAt ? Math.max(0, Math.floor((end - Date.parse(session.pausedAt)) / 1000)) : 0;
  const elapsed = Math.floor((end - Date.parse(session.startedAt)) / 1000);
  return Math.max(0, elapsed - session.pausedSeconds - pausedNow);
}

/** Segundos que faltan para el objetivo; negativo = tiempo extra. null si no hay objetivo. */
export function remainingSeconds(session: StudySession, nowMs: number): number | null {
  if (session.plannedMinutes === null) return null;
  return session.plannedMinutes * 60 - focusSecondsAt(session, nowMs);
}

/** "25:00", "1:05:09" */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Math.abs(totalSeconds)));
  const h = Math.floor(seconds / 3600);
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Duración legible de tiempo de enfoque: "menos de 1 min", "47 min", "2 h 5 min". */
export function formatFocus(seconds: number): string {
  if (seconds < 60) return "menos de 1 min";
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export type FocusSummary = {
  todaySeconds: number;
  weekSeconds: number;
  /** Segundos de la semana por materia (clave "" = sin materia), de mayor a menor. */
  bySubject: { subjectId: string | null; seconds: number }[];
};

/** Enfoque completado hoy y en la semana del usuario, por día local de inicio. */
export function summarizeFocus(
  sessions: StudySession[],
  now: Date,
  timeZone: string,
  weekStartsOn: number,
): FocusSummary {
  const todayKey = dayKey(now, timeZone);
  const weekStart = startOfWeekKey(todayKey, weekStartsOn);
  const weekEnd = addDaysToKey(weekStart, 6);
  let todaySeconds = 0;
  let weekSeconds = 0;
  const perSubject = new Map<string | null, number>();

  for (const session of sessions) {
    if (session.status !== "completed" || !session.startedAt || !session.focusSeconds) continue;
    const key = dayKey(session.startedAt, timeZone);
    if (key === todayKey) todaySeconds += session.focusSeconds;
    if (key >= weekStart && key <= weekEnd) {
      weekSeconds += session.focusSeconds;
      perSubject.set(session.subjectId, (perSubject.get(session.subjectId) ?? 0) + session.focusSeconds);
    }
  }

  return {
    todaySeconds,
    weekSeconds,
    bySubject: [...perSubject.entries()]
      .map(([subjectId, seconds]) => ({ subjectId, seconds }))
      .sort((a, b) => b.seconds - a.seconds),
  };
}

/** Minutos planificados: bloques de estudio del calendario en las ocurrencias dadas. */
export function plannedStudyMinutes(occurrences: EventOccurrence[]): number {
  return occurrences
    .filter((occurrence) => occurrence.kind === "study_block" && !occurrence.allDay)
    .reduce((sum, occurrence) => sum + (Date.parse(occurrence.endsAt) - Date.parse(occurrence.startsAt)) / 60_000, 0);
}

export type EstimateEntry = {
  task: Task;
  estimatedMinutes: number;
  actualMinutes: number;
  /** real / estimado */
  ratio: number;
};

export type EstimateAccuracy = {
  entries: EstimateEntry[];
  /** Mediana de real/estimado; null si hay menos de `minSamples` tareas comparables. */
  medianRatio: number | null;
  minSamples: number;
};

/**
 * Compara estimación y tiempo real en tareas completadas que tienen ambos.
 * La mediana resiste mejor que el promedio a una tarea atípica. Con pocos
 * datos no se afirma ninguna tendencia.
 */
export function estimateAccuracy(
  tasks: Task[],
  focusByTask: Map<string, number>,
  minSamples = 3,
): EstimateAccuracy {
  const entries = tasks
    .filter((task) => task.status === "completed" && task.estimatedMinutes)
    .map((task) => {
      const actualMinutes = Math.round((focusByTask.get(task.id) ?? 0) / 60);
      return { task, estimatedMinutes: task.estimatedMinutes ?? 0, actualMinutes };
    })
    .filter((entry) => entry.actualMinutes > 0)
    .map((entry) => ({ ...entry, ratio: entry.actualMinutes / entry.estimatedMinutes }))
    .sort((a, b) => Date.parse(b.task.completedAt ?? "0") - Date.parse(a.task.completedAt ?? "0"));

  let medianRatio: number | null = null;
  if (entries.length >= minSamples) {
    const ratios = entries.map((entry) => entry.ratio).sort((a, b) => a - b);
    const middle = Math.floor(ratios.length / 2);
    medianRatio = ratios.length % 2 === 1 ? ratios[middle] : (ratios[middle - 1] + ratios[middle]) / 2;
  }
  return { entries, medianRatio, minSamples };
}

/** Completa la frase "Tus tareas te toman…" a partir de real/estimado. */
export function describeRatio(ratio: number): string {
  if (ratio >= 0.9 && ratio <= 1.1) return "más o menos lo que estimas";
  if (ratio > 1) {
    const times = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 1 }).format(ratio);
    return `${times} veces lo que estimas`;
  }
  return `el ${Math.round(ratio * 100)} % de lo que estimas`;
}
