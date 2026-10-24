import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader, SectionHeading } from "@/components/page-header";
import { NextStep } from "@/components/planner/next-step";
import { PlanTimeline } from "@/components/planner/plan-timeline";
import { RankingList } from "@/components/planner/ranking-list";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDayHeading, formatMinutes } from "@/domain/datetime";
import { requireSession } from "@/server/auth";
import { loadPlan } from "@/server/services/planner";
import { getProfile } from "@/server/services/profiles";
import { getActiveSession } from "@/server/services/sessions";

export const metadata: Metadata = { title: "Plan" };

export default function PlanPage() {
  return (
    <>
      <PageHeader
        title="Plan"
        description="Qué conviene hacer primero y cuándo, según tus entregas, prioridades y tiempo libre."
      />
      <Suspense fallback={<PlanSkeleton />}>
        <PlanContent />
      </Suspense>
    </>
  );
}

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-DO", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );
}

async function PlanContent() {
  const session = await requireSession();
  const profile = await getProfile(session);
  const now = new Date();
  const [{ plan, subjects }, active] = await Promise.all([loadPlan(session, profile, now), getActiveSession(session)]);
  const lookup = new Map(subjects.map((s) => [s.id, { name: s.name, color: s.color }]));
  const top = plan.ranking[0];
  const upcomingSlots = plan.slots.filter((slot) => slot.dayKey !== plan.todayKey).slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
      <div className="space-y-10">
        <NextStep
          recommendation={top}
          subject={top?.task.subjectId ? lookup.get(top.task.subjectId) : undefined}
          hasActiveSession={active !== null}
          showPlanLink={false}
        />
        <RankingList ranking={plan.ranking} subjects={lookup} />
      </div>
      <aside className="space-y-10" aria-label="Plan del día">
        <PlanTimeline plan={plan.today} subjects={lookup} timeZone={profile.timezone} studyWindow={profile.studyWindow} />
        <section aria-labelledby="slots-heading">
          <SectionHeading id="slots-heading" title="Próximos huecos libres" />
          {upcomingSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay tiempo libre en los próximos días dentro de tu horario.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {upcomingSlots.map((slot) => (
                <li key={slot.start} className="flex justify-between gap-3">
                  <span>
                    {formatDayHeading(slot.dayKey)}, {formatTime(slot.start, profile.timezone)} a{" "}
                    {formatTime(slot.end, profile.timezone)}
                  </span>
                  <span className="tabular text-muted-foreground">{formatMinutes(slot.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="method-heading" className="text-xs text-muted-foreground">
          <SectionHeading id="method-heading" title="Cómo se calcula" />
          <p>
            Cada tarea recibe una puntuación de 0 a 1: urgencia por la fecha límite (45 %), prioridad de la tarea
            (25 %), prioridad de la materia (10 %), dificultad (10 %) y si cabe en tu próximo hueco libre (10 %). Si lo
            que falta no cabe en el tiempo libre antes de la entrega, la tarea se marca en riesgo. Con los mismos datos,
            el resultado es siempre el mismo.
          </p>
        </section>
      </aside>
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div role="status" aria-label="Calculando el plan" className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
