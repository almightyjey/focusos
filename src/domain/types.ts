// Tipos de dominio. Son independientes de Supabase: los servicios de datos
// traducen las filas de la base a estas formas.

export const PRIORITY_LEVELS = ["low", "medium", "high", "urgent"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_KINDS = [
  "assignment",
  "study",
  "project",
  "reading",
  "exam_prep",
  "lab",
  "other",
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const EVENT_KINDS = [
  "class",
  "lab",
  "exam",
  "study_block",
  "deadline",
  "personal",
  "other",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** Estados que siguen pendientes de trabajo. */
export const OPEN_TASK_STATUSES = ["pending", "in_progress"] as const satisfies readonly TaskStatus[];

export type Subject = {
  id: string;
  name: string;
  code: string | null;
  color: string;
  priority: PriorityLevel;
  credits: number | null;
  instructor: string | null;
  isArchived: boolean;
};

export type Task = {
  id: string;
  subjectId: string | null;
  title: string;
  description: string | null;
  kind: TaskKind;
  status: TaskStatus;
  priority: PriorityLevel;
  /** Instante ISO 8601 en UTC. */
  dueAt: string | null;
  estimatedMinutes: number | null;
  difficulty: number | null;
  completedAt: string | null;
  /** Segundos de enfoque registrados en sesiones de estudio, si se consultaron. */
  focusSeconds?: number;
};

export type ScheduleEvent = {
  id: string;
  subjectId: string | null;
  title: string;
  kind: EventKind;
  /** Primera ocurrencia (instantes ISO 8601 en UTC). */
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  /** Regla RRULE (subconjunto semanal, ver domain/recurrence.ts) o null. */
  recurrenceRule: string | null;
  /** Zona IANA en la que se expande la repetición. */
  timezone: string | null;
};

export type Profile = {
  id: string;
  displayName: string | null;
  timezone: string;
  /** 0 = domingo … 6 = sábado */
  weekStartsOn: number;
};

export function isOpenTask(task: Pick<Task, "status">): boolean {
  return task.status === "pending" || task.status === "in_progress";
}
