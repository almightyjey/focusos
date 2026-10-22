import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SubjectsOverview } from "@/components/dashboard/subjects-overview";
import { TodayAgenda } from "@/components/dashboard/today-agenda";
import { UpcomingDeadlines } from "@/components/dashboard/upcoming-deadlines";
import { WeekProgress } from "@/components/dashboard/week-progress";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { dayKey, formatLongDate, startOfWeekKey, zonedInputToUtc } from "@/domain/datetime";
import { buildTodayAgenda, summarizeSubjects, upcomingDeadlines, weeklyProgress } from "@/domain/tasks";
import { requireSession } from "@/server/auth";
import { getProfile } from "@/server/services/profiles";
import { listSubjects } from "@/server/services/subjects";
import { listDashboardTasks } from "@/server/services/tasks";

export const metadata: Metadata = { title: "Hoy" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const session = await requireSession();
  const profile = await getProfile(session);
  const timeZone = profile.timezone;
  const now = new Date();
  const nowIso = now.toISOString();
  const weekStart = zonedInputToUtc(startOfWeekKey(dayKey(now, timeZone), profile.weekStartsOn), "00:00", timeZone);

  const [subjects, tasks] = await Promise.all([
    listSubjects(session),
    listDashboardTasks(session, weekStart.toISOString()),
  ]);

  const subjectOptions = subjects.map(({ id, name, color }) => ({ id, name, color }));
  const agenda = buildTodayAgenda(tasks, now, timeZone);
  const longDate = formatLongDate(now, timeZone);
  const isNewAccount = subjects.length === 0 && tasks.length === 0;

  return (
    <>
      <PageHeader
        title="Hoy"
        description={
          <time dateTime={dayKey(now, timeZone)}>
            {longDate.charAt(0).toUpperCase() + longDate.slice(1)}
          </time>
        }
        actions={<NewTaskButton subjects={subjectOptions} timeZone={timeZone} nowIso={nowIso} />}
      />

      {isNewAccount ? (
        <EmptyState
          className="mb-10"
          title="Empieza por tus materias"
          description="Con tus materias creadas podrás registrar entregas y verlas aquí ordenadas por fecha."
          actions={
            <Button asChild>
              <Link href="/subjects">Añadir materias</Link>
            </Button>
          }
        />
      ) : null}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <TodayAgenda
          agenda={agenda}
          subjects={subjectOptions}
          nowIso={nowIso}
          timeZone={timeZone}
          showEmptyState={!isNewAccount}
        />
        <aside className="space-y-10" aria-label="Resumen">
          <WeekProgress progress={weeklyProgress(tasks, now, timeZone, profile.weekStartsOn)} />
          <UpcomingDeadlines days={upcomingDeadlines(tasks, now, timeZone)} subjects={subjectOptions} timeZone={timeZone} />
          <SubjectsOverview summaries={summarizeSubjects(subjects, tasks, now)} nowIso={nowIso} timeZone={timeZone} />
        </aside>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Cargando el resumen de hoy">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
        <div className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
