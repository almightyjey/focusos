import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";
import { ActiveTimer } from "@/components/sessions/active-timer";
import { EstimateAccuracy } from "@/components/sessions/estimate-accuracy";
import { FocusSummary } from "@/components/sessions/focus-summary";
import { ManualSessionButton } from "@/components/sessions/manual-session-dialog";
import { SessionHistory } from "@/components/sessions/session-history";
import { StartSessionForm } from "@/components/sessions/start-session-form";
import { Skeleton } from "@/components/ui/skeleton";
import { addDaysToKey, dayKey, zonedInputToUtc } from "@/domain/datetime";
import { estimateAccuracy } from "@/domain/sessions";
import { requireSession } from "@/server/auth";
import { getProfile } from "@/server/services/profiles";
import { getActiveSession, listCompletedSessions } from "@/server/services/sessions";
import { loadWeekStudyStats } from "@/server/services/study-stats";
import { listSubjects } from "@/server/services/subjects";
import { listTasks } from "@/server/services/tasks";

export const metadata: Metadata = { title: "Estudio" };

const HISTORY_DAYS = 14;

export default function StudyPage({ searchParams }: PageProps<"/study">) {
  return (
    <>
      <PageHeader
        title="Estudio"
        description="Concéntrate en una cosa a la vez y registra el tiempo real que le dedicas."
      />
      <Suspense fallback={<StudySkeleton />}>
        <StudyContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function StudyContent({ searchParams }: { searchParams: PageProps<"/study">["searchParams"] }) {
  const raw = await searchParams;
  const session = await requireSession();
  const profile = await getProfile(session);
  const now = new Date();
  const timeZone = profile.timezone;
  const todayKey = dayKey(now, timeZone);
  const historySince = zonedInputToUtc(addDaysToKey(todayKey, -(HISTORY_DAYS - 1)), "00:00", timeZone);

  const [subjects, openTasks, completedTasks, active, history, stats] = await Promise.all([
    listSubjects(session),
    listTasks(session, { view: "open" }),
    listTasks(session, { view: "completed" }),
    getActiveSession(session),
    listCompletedSessions(session, historySince.toISOString()),
    loadWeekStudyStats(session, profile, now),
  ]);

  const subjectOptions = subjects.map(({ id, name, color }) => ({ id, name, color }));
  const taskOptions = openTasks.map(({ id, title, subjectId }) => ({ id, title, subjectId }));
  const requestedTask = typeof raw.task === "string" ? openTasks.find((task) => task.id === raw.task) : undefined;
  const focusByTask = new Map(completedTasks.map((task) => [task.id, task.focusSeconds ?? 0]));

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
      <div className="space-y-10">
        {active ? (
          <ActiveTimer session={active} serverNowIso={now.toISOString()} variant="full" />
        ) : (
          <div className="rounded-xl border bg-card p-5 sm:p-6">
            <StartSessionForm
              tasks={taskOptions}
              subjects={subjectOptions}
              defaultTarget={requestedTask ? `task:${requestedTask.id}` : undefined}
            />
          </div>
        )}
        <div className="flex justify-end">
          <ManualSessionButton tasks={taskOptions} subjects={subjectOptions} todayKey={todayKey} timeZone={timeZone} />
        </div>
        <SessionHistory sessions={history} timeZone={timeZone} days={HISTORY_DAYS} />
      </div>
      <aside className="space-y-10" aria-label="Resumen de estudio">
        <FocusSummary
          summary={stats.summary}
          plannedMinutes={stats.plannedMinutes}
          subjects={subjectOptions}
          showBySubject
          calendarHref={`/calendar?view=week&date=${todayKey}`}
        />
        <EstimateAccuracy accuracy={estimateAccuracy(completedTasks, focusByTask)} />
      </aside>
    </div>
  );
}

function StudySkeleton() {
  return (
    <div role="status" aria-label="Cargando sesiones de estudio" className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
