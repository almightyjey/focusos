import Link from "next/link";

import { EventItem, TaskItemButton } from "@/components/calendar/calendar-items";
import { DayAgenda, agendaEntries, type SubjectLookup } from "@/components/calendar/day-agenda";
import { formatDayLong, isSameMonth } from "@/domain/calendar";
import type { EventOccurrence } from "@/domain/events";
import { WEEKDAY_SHORT_LABELS } from "@/domain/labels";
import { weekdayOfKey } from "@/domain/datetime";
import type { Task } from "@/domain/types";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 3;

export function MonthView({
  weeks,
  anchorKey,
  occurrencesByDay,
  tasksByDay,
  subjects,
  timeZone,
  todayKey,
}: {
  weeks: string[][];
  anchorKey: string;
  occurrencesByDay: Map<string, EventOccurrence[]>;
  tasksByDay: Map<string, Task[]>;
  subjects: SubjectLookup;
  timeZone: string;
  todayKey: string;
}) {
  const href = (key: string) => `/calendar?view=month&date=${key}`;

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-xl border bg-card" data-testid="month-grid">
        <div className="grid grid-cols-7 border-b">
          {weeks[0].map((day) => (
            <div key={day} className="px-2 py-2 text-xs font-medium text-muted-foreground">
              {WEEKDAY_SHORT_LABELS[weekdayOfKey(day)]}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((day, index) => {
            const entries = agendaEntries(occurrencesByDay.get(day) ?? [], tasksByDay.get(day) ?? []);
            const inMonth = isSameMonth(day, anchorKey);
            const isToday = day === todayKey;
            const selected = day === anchorKey;
            const hidden = entries.length - MAX_VISIBLE;
            return (
              <div
                key={day}
                data-testid="month-day"
                data-day={day}
                className={cn(
                  "min-h-16 border-b p-1 md:min-h-28 md:p-1.5",
                  index % 7 !== 0 && "border-l",
                  !inMonth && "bg-muted/40",
                )}
              >
                <Link
                  href={href(day)}
                  aria-label={`${formatDayLong(day)}${entries.length ? `, ${entries.length} en la agenda` : ""}`}
                  aria-current={selected ? "date" : undefined}
                  className={cn(
                    "tabular inline-flex size-7 items-center justify-center rounded-full text-xs font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                    !inMonth && "text-muted-foreground",
                    selected && !isToday && "ring-2 ring-primary",
                    isToday && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >
                  {Number(day.slice(8, 10))}
                </Link>

                {/* Escritorio: hasta 3 elementos por día */}
                <ul className="mt-1 hidden space-y-1 md:block">
                  {entries.slice(0, MAX_VISIBLE).map((entry) =>
                    entry.type === "event" ? (
                      <li key={entry.occurrence.key}>
                        <EventItem
                          occurrence={entry.occurrence}
                          color={subjects.get(entry.occurrence.subjectId ?? "")?.color}
                          timeZone={timeZone}
                          variant="chip"
                        />
                      </li>
                    ) : (
                      <li key={entry.task.id}>
                        <TaskItemButton
                          task={entry.task}
                          color={subjects.get(entry.task.subjectId ?? "")?.color}
                          timeZone={timeZone}
                          variant="chip"
                        />
                      </li>
                    ),
                  )}
                  {hidden > 0 ? (
                    <li>
                      <Link
                        href={href(day)}
                        className="px-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {hidden} más
                      </Link>
                    </li>
                  ) : null}
                </ul>

                {/* Móvil: marcas de color */}
                {entries.length > 0 ? (
                  <div aria-hidden className="mt-1 flex flex-wrap gap-0.5 px-1 md:hidden">
                    {entries.slice(0, 4).map((entry) => {
                      const subjectId = entry.type === "event" ? entry.occurrence.subjectId : entry.task.subjectId;
                      return (
                        <span
                          key={entry.type === "event" ? entry.occurrence.key : entry.task.id}
                          className="size-1.5 rounded-full bg-muted-foreground"
                          style={{ backgroundColor: subjects.get(subjectId ?? "")?.color }}
                        />
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <DayAgenda
        dayKey={anchorKey}
        occurrences={occurrencesByDay.get(anchorKey) ?? []}
        tasks={tasksByDay.get(anchorKey) ?? []}
        subjects={subjects}
        timeZone={timeZone}
        isToday={anchorKey === todayKey}
      />
    </div>
  );
}
