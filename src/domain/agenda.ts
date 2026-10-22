import { addDaysToKey, dayKey } from "@/domain/datetime";
import { occurrencesByDay, type EventOccurrence } from "@/domain/events";
import { compareOpenTasks } from "@/domain/tasks";
import { isOpenTask, type Task } from "@/domain/types";

/** Lo que el dashboard lista como próximo: entregas y exámenes. */
export type UpcomingItem =
  | { type: "task"; id: string; title: string; subjectId: string | null; at: string }
  | { type: "exam"; id: string; title: string; subjectId: string | null; at: string; allDay: boolean };

export type UpcomingDay = { dayKey: string; items: UpcomingItem[] };

/**
 * Entregas abiertas y exámenes de los próximos `days` días (sin contar hoy),
 * agrupados por día local y ordenados por hora.
 */
export function upcomingAgenda(
  tasks: Task[],
  occurrences: EventOccurrence[],
  now: Date,
  timeZone: string,
  days = 7,
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

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => ({
      dayKey: key,
      // Los exámenes primero dentro del día: suelen condicionar el resto.
      items: items.sort(
        (a, b) => Number(b.type === "exam") - Number(a.type === "exam") || Date.parse(a.at) - Date.parse(b.at),
      ),
    }));
}

/** Ocurrencias de hoy en la zona del usuario. */
export function todaySchedule(occurrences: EventOccurrence[], now: Date, timeZone: string): EventOccurrence[] {
  const todayKey = dayKey(now, timeZone);
  return occurrencesByDay(occurrences, [todayKey], timeZone).get(todayKey) ?? [];
}
