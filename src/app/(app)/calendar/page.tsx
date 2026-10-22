import type { Metadata } from "next";
import { Suspense } from "react";

import { CalendarProvider } from "@/components/calendar/calendar-provider";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import type { SubjectLookup } from "@/components/calendar/day-agenda";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatMonthTitle,
  formatWeekTitle,
  monthWeeks,
  parseAnchor,
  rangeToUtc,
  viewRange,
  weekDays,
} from "@/domain/calendar";
import { dayKey } from "@/domain/datetime";
import { expandOccurrences, occurrencesByDay } from "@/domain/events";
import type { Task } from "@/domain/types";
import { calendarSearchSchema } from "@/schemas/event";
import { requireSession } from "@/server/auth";
import { listEventsInRange } from "@/server/services/events";
import { getProfile } from "@/server/services/profiles";
import { listSubjects } from "@/server/services/subjects";
import { listTasksDueInRange } from "@/server/services/tasks";

export const metadata: Metadata = { title: "Calendario" };

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <>
      <PageHeader title="Calendario" description="Clases, exámenes y entregas en tu zona horaria." />
      <Suspense fallback={<CalendarSkeleton />}>
        <CalendarContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CalendarContent({ searchParams }: { searchParams: PageProps<"/calendar">["searchParams"] }) {
  const raw = await searchParams;
  const session = await requireSession();
  const profile = await getProfile(session);
  const timeZone = profile.timezone;
  const now = new Date();
  const nowIso = now.toISOString();
  const todayKey = dayKey(now, timeZone);

  const { view } = calendarSearchSchema.parse({ view: typeof raw.view === "string" ? raw.view : undefined });
  const anchorKey = parseAnchor(raw.date, todayKey);
  const range = viewRange(view, anchorKey, profile.weekStartsOn);
  const { startIso, endIso } = rangeToUtc(range, timeZone);

  const [subjects, events, tasks] = await Promise.all([
    listSubjects(session, { includeArchived: true }),
    listEventsInRange(session, startIso, endIso),
    listTasksDueInRange(session, startIso, endIso),
  ]);

  const weeks = view === "month" ? monthWeeks(anchorKey, profile.weekStartsOn) : [];
  const days = view === "week" ? weekDays(anchorKey, profile.weekStartsOn) : weeks.flat();
  const occurrences = expandOccurrences(events, startIso, endIso, timeZone);
  const byDay = occurrencesByDay(occurrences, days, timeZone);
  const tasksByDay = new Map<string, Task[]>(days.map((day) => [day, []]));
  for (const task of tasks) {
    if (task.dueAt) tasksByDay.get(dayKey(task.dueAt, timeZone))?.push(task);
  }

  const lookup: SubjectLookup = new Map(subjects.map((s) => [s.id, { name: s.name, color: s.color }]));
  const subjectOptions = subjects
    .filter((subject) => !subject.isArchived)
    .map(({ id, name, color }) => ({ id, name, color }));
  const title = view === "week" ? formatWeekTitle(days) : formatMonthTitle(anchorKey);

  return (
    <CalendarProvider
      events={events}
      tasks={tasks}
      subjects={subjectOptions}
      timeZone={timeZone}
      weekStartsOn={profile.weekStartsOn}
      nowIso={nowIso}
      defaultDateKey={anchorKey}
    >
      <CalendarToolbar view={view} anchorKey={anchorKey} todayKey={todayKey} title={title} />
      {view === "week" ? (
        <WeekView
          days={days}
          occurrencesByDay={byDay}
          tasksByDay={tasksByDay}
          subjects={lookup}
          timeZone={timeZone}
          todayKey={todayKey}
          nowIso={nowIso}
        />
      ) : (
        <MonthView
          weeks={weeks}
          anchorKey={anchorKey}
          occurrencesByDay={byDay}
          tasksByDay={tasksByDay}
          subjects={lookup}
          timeZone={timeZone}
          todayKey={todayKey}
        />
      )}
    </CalendarProvider>
  );
}

function CalendarSkeleton() {
  return (
    <div role="status" aria-label="Cargando el calendario" className="space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-56" />
      </div>
      <Skeleton className="h-[32rem] w-full rounded-xl" />
    </div>
  );
}
