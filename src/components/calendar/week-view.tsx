import { AddOnDayButton, EventItem, TaskItemButton } from "@/components/calendar/calendar-items";
import { DayAgenda, type SubjectLookup } from "@/components/calendar/day-agenda";
import { formatDayLong } from "@/domain/calendar";
import { layoutDay, minutesOfDay, visibleHours, type EventOccurrence } from "@/domain/events";
import { WEEKDAY_SHORT_LABELS } from "@/domain/labels";
import { weekdayOfKey } from "@/domain/datetime";
import type { Task } from "@/domain/types";
import { cn } from "@/lib/utils";

/** Alto de una hora en la rejilla (rem). */
const HOUR = 3;
const GRID_COLUMNS = "grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]";

export function WeekView({
  days,
  occurrencesByDay,
  tasksByDay,
  subjects,
  timeZone,
  todayKey,
  nowIso,
}: {
  days: string[];
  occurrencesByDay: Map<string, EventOccurrence[]>;
  tasksByDay: Map<string, Task[]>;
  subjects: SubjectLookup;
  timeZone: string;
  todayKey: string;
  nowIso: string;
}) {
  const positioned = new Map(days.map((day) => [day, layoutDay(occurrencesByDay.get(day) ?? [], day, timeZone)]));
  const { start, end } = visibleHours([...positioned.values()].flat());
  const hours = Array.from({ length: end - start }, (_, index) => start + index);
  const nowMinute = days.includes(todayKey) ? minutesOfDay(nowIso, timeZone) : null;
  const showNow = nowMinute !== null && nowMinute >= start * 60 && nowMinute <= end * 60;
  const toRem = (minute: number) => ((minute - start * 60) / 60) * HOUR;

  return (
    <>
      {/* Escritorio: rejilla horaria */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block" data-testid="week-grid">
        <div className={cn(GRID_COLUMNS, "border-b")}>
          <div />
          {days.map((day) => {
            const isToday = day === todayKey;
            return (
              <div key={day} className="flex items-center justify-between gap-1 border-l px-2 py-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs text-muted-foreground">{WEEKDAY_SHORT_LABELS[weekdayOfKey(day)]}</span>
                  <span
                    className={cn(
                      "tabular inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                      isToday && "bg-primary text-primary-foreground",
                    )}
                    aria-current={isToday ? "date" : undefined}
                  >
                    {Number(day.slice(8, 10))}
                  </span>
                </div>
                <AddOnDayButton dateKey={day} dayLabel={formatDayLong(day)} />
              </div>
            );
          })}
        </div>

        <div className={cn(GRID_COLUMNS, "border-b bg-muted/30")}>
          <div className="px-1.5 py-2 text-right text-[0.7rem] leading-tight text-muted-foreground">
            Todo el día
          </div>
          {days.map((day) => {
            const allDay = (occurrencesByDay.get(day) ?? []).filter((o) => o.allDay);
            const dayTasks = tasksByDay.get(day) ?? [];
            return (
              <ul key={day} aria-label={`Todo el día y entregas, ${formatDayLong(day)}`} className="min-h-10 space-y-1 border-l p-1.5">
                {allDay.map((occurrence) => (
                  <li key={occurrence.key}>
                    <EventItem
                      occurrence={occurrence}
                      color={subjects.get(occurrence.subjectId ?? "")?.color}
                      timeZone={timeZone}
                      variant="chip"
                    />
                  </li>
                ))}
                {dayTasks.map((task) => (
                  <li key={task.id}>
                    <TaskItemButton
                      task={task}
                      color={subjects.get(task.subjectId ?? "")?.color}
                      timeZone={timeZone}
                      variant="chip"
                    />
                  </li>
                ))}
              </ul>
            );
          })}
        </div>

        <div className={GRID_COLUMNS}>
          <div aria-hidden className="relative" style={{ height: `${hours.length * HOUR}rem` }}>
            {hours.map((hour, index) =>
              index === 0 ? null : (
                <span
                  key={hour}
                  className="tabular absolute right-1.5 -translate-y-1/2 text-[0.7rem] text-muted-foreground"
                  style={{ top: `${index * HOUR}rem` }}
                >
                  {String(hour).padStart(2, "0")}:00
                </span>
              ),
            )}
          </div>
          {days.map((day) => (
            <section
              key={day}
              aria-label={formatDayLong(day)}
              className={cn("relative border-l", day === todayKey && "bg-accent/30")}
              style={{ height: `${hours.length * HOUR}rem` }}
            >
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  aria-hidden
                  className={cn("absolute inset-x-0", index > 0 && "border-t border-rule")}
                  style={{ top: `${index * HOUR}rem` }}
                />
              ))}
              <ul>
                {(positioned.get(day) ?? []).map((item) => (
                  <li
                    key={item.occurrence.key}
                    className="absolute"
                    style={{
                      top: `${toRem(item.startMinute)}rem`,
                      height: `${toRem(item.endMinute) - toRem(item.startMinute)}rem`,
                      left: `calc(${(item.column / item.columns) * 100}% + 2px)`,
                      width: `calc(${100 / item.columns}% - 4px)`,
                    }}
                  >
                    <EventItem
                      occurrence={item.occurrence}
                      color={subjects.get(item.occurrence.subjectId ?? "")?.color}
                      timeZone={timeZone}
                      variant="block"
                      style={{ inset: 0 }}
                    />
                  </li>
                ))}
              </ul>
              {showNow && day === todayKey ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-primary"
                  style={{ top: `${toRem(nowMinute)}rem` }}
                >
                  <span className="absolute -top-[5px] -left-[5px] size-2 rounded-full bg-primary" />
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>

      {/* Móvil: agenda por día */}
      <div className="space-y-6 md:hidden">
        {days.map((day) => (
          <DayAgenda
            key={day}
            dayKey={day}
            occurrences={occurrencesByDay.get(day) ?? []}
            tasks={tasksByDay.get(day) ?? []}
            subjects={subjects}
            timeZone={timeZone}
            isToday={day === todayKey}
          />
        ))}
      </div>
    </>
  );
}
