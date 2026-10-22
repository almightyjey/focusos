import { AddOnDayButton, EventItem, TaskItemButton } from "@/components/calendar/calendar-items";
import { formatDayLong } from "@/domain/calendar";
import type { EventOccurrence } from "@/domain/events";
import type { Task } from "@/domain/types";
import { cn } from "@/lib/utils";

export type SubjectLookup = Map<string, { name: string; color: string }>;

type AgendaEntry =
  | { type: "event"; at: number; allDay: boolean; occurrence: EventOccurrence }
  | { type: "task"; at: number; allDay: false; task: Task };

/** Eventos de todo el día primero; luego eventos y entregas por hora. */
export function agendaEntries(occurrences: EventOccurrence[], tasks: Task[]): AgendaEntry[] {
  const entries: AgendaEntry[] = [
    ...occurrences.map((occurrence) => ({
      type: "event" as const,
      at: Date.parse(occurrence.startsAt),
      allDay: occurrence.allDay,
      occurrence,
    })),
    ...tasks.map((task) => ({ type: "task" as const, at: Date.parse(task.dueAt ?? ""), allDay: false as const, task })),
  ];
  return entries.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.at - b.at);
}

export function DayAgenda({
  dayKey,
  occurrences,
  tasks,
  subjects,
  timeZone,
  isToday,
}: {
  dayKey: string;
  occurrences: EventOccurrence[];
  tasks: Task[];
  subjects: SubjectLookup;
  timeZone: string;
  isToday: boolean;
}) {
  const entries = agendaEntries(occurrences, tasks);
  const label = formatDayLong(dayKey);
  const headingId = `day-${dayKey}`;

  return (
    <section aria-labelledby={headingId} data-testid="day-agenda" data-day={dayKey}>
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-rule pb-2">
        <h3 id={headingId} className={cn("text-sm font-semibold first-letter:uppercase", isToday && "text-primary")}>
          {label}
          {isToday ? <span className="sr-only"> (hoy)</span> : null}
        </h3>
        <AddOnDayButton dateKey={dayKey} dayLabel={label} />
      </div>
      {entries.length === 0 ? (
        <p className="py-1 text-sm text-muted-foreground">Nada programado.</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry) =>
            entry.type === "event" ? (
              <li key={entry.occurrence.key}>
                <EventItem
                  occurrence={entry.occurrence}
                  color={subjects.get(entry.occurrence.subjectId ?? "")?.color}
                  subjectName={subjects.get(entry.occurrence.subjectId ?? "")?.name}
                  timeZone={timeZone}
                  variant="row"
                />
              </li>
            ) : (
              <li key={entry.task.id}>
                <TaskItemButton
                  task={entry.task}
                  color={subjects.get(entry.task.subjectId ?? "")?.color}
                  subjectName={subjects.get(entry.task.subjectId ?? "")?.name}
                  timeZone={timeZone}
                  variant="row"
                />
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
