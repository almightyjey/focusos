import type { PriorityLevel, TaskKind, TaskStatus } from "@/domain/types";

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

/** Mayor número = más prioritario. Lo usan el orden de listas y el planificador. */
export const PRIORITY_RANK: Record<PriorityLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  assignment: "Entrega",
  study: "Estudio",
  project: "Proyecto",
  reading: "Lectura",
  exam_prep: "Preparar examen",
  lab: "Laboratorio",
  other: "Otra",
};

export const WEEKDAY_LABELS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;
