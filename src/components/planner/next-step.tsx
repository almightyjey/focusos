import Link from "next/link";

import { StartRecommendedButton } from "@/components/planner/start-recommended-button";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/planner";

/** La recomendación principal del motor, con sus motivos y un botón para empezar. */
export function NextStep({
  recommendation,
  subject,
  hasActiveSession,
  showPlanLink = true,
}: {
  recommendation: Recommendation | undefined;
  subject?: { name: string; color: string };
  hasActiveSession: boolean;
  showPlanLink?: boolean;
}) {
  return (
    <section aria-labelledby="next-step-heading" className="rounded-xl border bg-card p-5" data-testid="next-step">
      <h2 id="next-step-heading" className="text-sm font-medium text-muted-foreground">
        Siguiente paso
      </h2>
      {!recommendation ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No tienes tareas pendientes. Cuando añadas una, aquí verás por cuál empezar.
        </p>
      ) : (
        <>
          <p className="mt-1 text-lg font-semibold tracking-tight">{recommendation.task.title}</p>
          {subject ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <SubjectSwatch color={subject.color} />
              {subject.name}
            </p>
          ) : null}
          <ul className="mt-3 space-y-1 text-sm" aria-label="Por qué ahora">
            {recommendation.reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground" />
                {reason}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {hasActiveSession ? (
              <Button asChild variant="outline">
                <Link href="/study">Ver la sesión en curso</Link>
              </Button>
            ) : (
              <StartRecommendedButton taskId={recommendation.task.id} minutes={recommendation.chunkMinutes} />
            )}
            {showPlanLink ? (
              <Button asChild variant="ghost">
                <Link href="/plan">Ver plan completo</Link>
              </Button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
