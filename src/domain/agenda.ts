import { addDaysToKey, dayKey } from "@/domain/datetime";
import { occurrencesByDay, type EventOccurrence } from "@/domain/events";
import { compareOpenTasks } from "@/domain/tasks";
import { isOpenTask, type GradeItem, type Task } from "@/domain/types";

/** Lo que el dashboard lista como próximo: entregas y exámenes. */
export type UpcomingItem =
  | { type: "task"; id: string; title: string; subjectId: string | null; at: string }
  | { type: "exam"; id: string; title: string; subjectId: string | null; at: string; allDay: boolean }
  | { type: "evaluation"; id: string; title: string; subjectId: string | null; at: string; weight: number | null };

export type UpcomingDay = { dayKey: string; items: UpcomingItem[] };

/**
 * Entregas abiertas, exámenes y evaluaciones sin nota de los próximos `days`
 * días (sin contar hoy), agrupados por día local y ordenados por hora. Una
 * evaluación se omite si ese día ya hay un examen de la misma materia en el
 * calendario, para no mostrar dos veces lo mismo.
 */
export function upcomingAgenda(
  tasks: Task[],
  occurrences: EventOccurrence[],
  now: Date,
  timeZone: string,
  days = 7,
  evaluations: GradeItem[] = [],
): UpcomingDay[] {
  const todayKey = dayKey(now, timeZone);
  const lastKey = addDaysToKey(todayKey, days);
  const byDay = new Map<string, UpcomingItem[]>();
  const add = (key: string, item: UpcomingItem) => {
    if (key <= todayKey || key > lastKey) return;
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  };

  for (const task of [...tasks].sort(compareOpenTasks)) {
    if (!isOpenTask(task) || !task.dueAt) continue;
    add(dayKey(task.dueAt, timeZone), {
      type: "task",
      id: task.id,
      title: task.title,
      subjectId: task.subjectId,
      at: task.dueAt,
    });
  }
  for (const occurrence of occurrences) {
    if (occurrence.kind !== "exam") continue;
    add(dayKey(occurrence.startsAt, timeZone), {
      type: "exam",
      id: occurrence.key,
      title: occurrence.title,
      subjectId: occurrence.subjectId,
      at: occurrence.startsAt,
      allDay: occurrence.allDay,
    });
  }

  const examDays = new Set(
    occurrences
      .filter((occurrence) => occurrence.kind === "exam")
      .map((occurrence) => `${occurrence.subjectId}:${dayKey(occurrence.startsAt, timeZone)}`),
  );
  for (const evaluation of evaluations) {
    if (evaluation.score !== null || !evaluation.dueAt) continue;
    const key = dayKey(evaluation.dueAt, timeZone);
    if (examDays.has(`${evaluation.subjectId}:${key}`)) continue;
    add(key, {
      type: "evaluation",
      id: evaluation.id,
      title: evaluation.title,
      subjectId: evaluation.subjectId,
      at: evaluation.dueAt,
      weight: evaluation.weight,
    });
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      dayKey: key,
      // Exámenes y evaluaciones primero dentro del día: suelen condicionar el resto.
      items: items.sort(
        (a, b) => Number(b.type !== "task") - Number(a.type !== "task") || Date.parse(a.at) - Date.parse(b.at),
      ),
    }));
}

/** Ocurrencias de hoy en la zona del usuario. */
export function todaySchedule(occurrences: EventOccurrence[], now: Date, timeZone: string): EventOccurrence[] {
  const todayKey = dayKey(now, timeZone);
  return occurrencesByDay(occurrences, [todayKey], timeZone).get(todayKey) ?? [];
}
