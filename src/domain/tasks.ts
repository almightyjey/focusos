import { addDaysToKey, dayKey, startOfWeekKey } from "@/domain/datetime";
import { PRIORITY_RANK } from "@/domain/labels";
import { isOpenTask, type Subject, type Task } from "@/domain/types";

/**
 * Orden para listas de trabajo: primero lo que vence antes, luego lo más
 * prioritario. Las tareas sin fecha van al final. Es un orden simple y
 * predecible; el motor de planificación (fase 8) lo reemplazará en "Hoy".
 */
export function compareOpenTasks(a: Task, b: Task): number {
  if (a.dueAt !== b.dueAt) {
    if (a.dueAt === null) return 1;
    if (b.dueAt === null) return -1;
    const diff = Date.parse(a.dueAt) - Date.parse(b.dueAt);
    if (diff !== 0) return diff;
  }
  const priority = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (priority !== 0) return priority;
  return a.title.localeCompare(b.title, "es");
}

export function compareCompletedTasks(a: Task, b: Task): number {
  return Date.parse(b.completedAt ?? "0") - Date.parse(a.completedAt ?? "0");
}

export type DueBucket = "overdue" | "today" | "tomorrow" | "this_week" | "later" | "no_date";

export const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: "Vencidas",
  today: "Hoy",
  tomorrow: "Mañana",
  this_week: "Próximos 7 días",
  later: "Más adelante",
  no_date: "Sin fecha",
};

const BUCKET_ORDER: DueBucket[] = ["overdue", "today", "tomorrow", "this_week", "later", "no_date"];

export function dueBucket(task: Task, now: Date, timeZone: string): DueBucket {
  if (!task.dueAt) return "no_date";
  if (Date.parse(task.dueAt) < now.getTime()) return "overdue";
  const todayKey = dayKey(now, timeZone);
  const dueKey = dayKey(task.dueAt, timeZone);
  if (dueKey === todayKey) return "today";
  if (dueKey === addDaysToKey(todayKey, 1)) return "tomorrow";
  if (dueKey <= addDaysToKey(todayKey, 7)) return "this_week";
  return "later";
}

export type TaskGroup = { bucket: DueBucket; label: string; tasks: Task[] };

/** Agrupa tareas abiertas por cercanía de la fecha límite. */
export function groupOpenTasksByDue(tasks: Task[], now: Date, timeZone: string): TaskGroup[] {
  const groups = new Map<DueBucket, Task[]>();
  for (const task of tasks) {
    if (!isOpenTask(task)) continue;
    const bucket = dueBucket(task, now, timeZone);
    groups.set(bucket, [...(groups.get(bucket) ?? []), task]);
  }
  return BUCKET_ORDER.filter((bucket) => groups.has(bucket)).map((bucket) => ({
    bucket,
    label: DUE_BUCKET_LABELS[bucket],
    tasks: [...(groups.get(bucket) ?? [])].sort(compareOpenTasks),
  }));
}

export type TodayAgenda = {
  overdue: Task[];
  today: Task[];
  /** Suma de estimaciones de las tareas de hoy y vencidas que tienen estimación. */
  estimatedMinutes: number;
  /** Tareas de hoy o vencidas sin estimación (no se inventa su duración). */
  unestimatedCount: number;
  /** Tareas completadas hoy: se muestran tachadas como confirmación del avance. */
  completedToday: Task[];
  /** Próxima tarea abierta después de hoy, para cuando no hay nada para hoy. */
  nextUp: Task | null;
};

export function buildTodayAgenda(tasks: Task[], now: Date, timeZone: string): TodayAgenda {
  const open = tasks.filter(isOpenTask).sort(compareOpenTasks);
  const overdue = open.filter((task) => dueBucket(task, now, timeZone) === "overdue");
  const today = open.filter((task) => dueBucket(task, now, timeZone) === "today");
  const focus = [...overdue, ...today];
  const estimated = focus.filter((task) => task.estimatedMinutes !== null);

  const nextUp =
    open.find((task) => {
      const bucket = dueBucket(task, now, timeZone);
      return bucket === "tomorrow" || bucket === "this_week" || bucket === "later";
    }) ?? null;

  const todayKey = dayKey(now, timeZone);
  const completedToday = tasks
    .filter(
      (task) =>
        task.status === "completed" &&
        task.completedAt !== null &&
        dayKey(task.completedAt, timeZone) === todayKey,
    )
    .sort(compareCompletedTasks);

  return {
    overdue,
    today,
    completedToday,
    estimatedMinutes: estimated.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0),
    unestimatedCount: focus.length - estimated.length,
    nextUp,
  };
}

export type DayDeadlines = { dayKey: string; tasks: Task[] };

/** Tareas abiertas que vencen después de hoy y dentro de `days` días, agrupadas por día. */
export function upcomingDeadlines(
  tasks: Task[],
  now: Date,
  timeZone: string,
  days = 7,
): DayDeadlines[] {
  const todayKey = dayKey(now, timeZone);
  const lastKey = addDaysToKey(todayKey, days);
  const byDay = new Map<string, Task[]>();

  for (const task of tasks) {
    if (!isOpenTask(task) || !task.dueAt) continue;
    const key = dayKey(task.dueAt, timeZone);
    if (key <= todayKey || key > lastKey) continue;
    byDay.set(key, [...(byDay.get(key) ?? []), task]);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayTasks]) => ({ dayKey: key, tasks: dayTasks.sort(compareOpenTasks) }));
}

export type WeeklyProgress = {
  weekStartKey: string;
  weekEndKey: string;
  /** Tareas con fecha límite esta semana (sin canceladas). */
  dueThisWeek: number;
  /** De esas, cuántas están completadas. */
  dueThisWeekCompleted: number;
  /** Tareas completadas esta semana, vencieran cuando vencieran. */
  completedThisWeek: number;
};

export function weeklyProgress(
  tasks: Task[],
  now: Date,
  timeZone: string,
  weekStartsOn: number,
): WeeklyProgress {
  const weekStartKey = startOfWeekKey(dayKey(now, timeZone), weekStartsOn);
  const weekEndKey = addDaysToKey(weekStartKey, 6);
  const inWeek = (instant: string) => {
    const key = dayKey(instant, timeZone);
    return key >= weekStartKey && key <= weekEndKey;
  };

  const due = tasks.filter(
    (task) => task.status !== "cancelled" && task.dueAt !== null && inWeek(task.dueAt),
  );

  return {
    weekStartKey,
    weekEndKey,
    dueThisWeek: due.length,
    dueThisWeekCompleted: due.filter((task) => task.status === "completed").length,
    completedThisWeek: tasks.filter(
      (task) => task.status === "completed" && task.completedAt !== null && inWeek(task.completedAt),
    ).length,
  };
}

export type SubjectSummary = {
  subject: Subject;
  openCount: number;
  overdueCount: number;
  nextDue: Task | null;
};

/** Estado por materia activa, ordenado por prioridad de la materia y luego por nombre. */
export function summarizeSubjects(
  subjects: Subject[],
  tasks: Task[],
  now: Date,
): SubjectSummary[] {
  return subjects
    .filter((subject) => !subject.isArchived)
    .map((subject) => {
      const open = tasks
        .filter((task) => task.subjectId === subject.id && isOpenTask(task))
        .sort(compareOpenTasks);
      return {
        subject,
        openCount: open.length,
        overdueCount: open.filter(
          (task) => task.dueAt !== null && Date.parse(task.dueAt) < now.getTime(),
        ).length,
        nextDue: open.find((task) => task.dueAt !== null) ?? null,
      };
    })
    .sort(
      (a, b) =>
        PRIORITY_RANK[b.subject.priority] - PRIORITY_RANK[a.subject.priority] ||
        a.subject.name.localeCompare(b.subject.name, "es"),
    );
}
