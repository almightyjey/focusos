import Link from "next/link";

import { SectionHeading } from "@/components/page-header";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
import { Progress } from "@/components/ui/progress";
import { formatMinutes } from "@/domain/datetime";
import { formatFocus, type FocusSummary as Summary } from "@/domain/sessions";

/**
 * Tiempo de estudio completado frente al planificado. Lo planificado son los
 * bloques de estudio del calendario de esta semana.
 */
export function FocusSummary({
  summary,
  plannedMinutes,
  subjects,
  showBySubject = false,
  calendarHref,
}: {
  summary: Summary;
  plannedMinutes: number;
  subjects: SubjectOption[];
  showBySubject?: boolean;
  calendarHref: string;
}) {
  const weekMinutes = Math.floor(summary.weekSeconds / 60);
  const percent = plannedMinutes > 0 ? Math.min(100, Math.round((weekMinutes / plannedMinutes) * 100)) : null;
  const max = summary.bySubject[0]?.seconds ?? 0;

  return (
    <section aria-labelledby="focus-heading">
      <SectionHeading id="focus-heading" title="Tiempo de estudio" />
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-muted-foreground">Hoy</dt>
          <dd className="tabular text-2xl font-semibold tracking-tight" data-testid="focus-today">
            {summary.todaySeconds === 0 ? "0 min" : formatFocus(summary.todaySeconds)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Esta semana</dt>
          <dd className="tabular text-2xl font-semibold tracking-tight" data-testid="focus-week">
            {summary.weekSeconds === 0 ? "0 min" : formatFocus(summary.weekSeconds)}
          </dd>
        </div>
      </dl>
      {percent !== null ? (
        <div className="mt-3 space-y-1.5">
          <Progress value={percent} aria-label={`${percent}% del tiempo planificado esta semana`} />
          <p className="text-xs text-muted-foreground">
            De {formatMinutes(plannedMinutes)} planificados en bloques de estudio.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Sin bloques de estudio esta semana.{" "}
          <Link href={calendarHref} className="font-medium text-primary underline-offset-4 hover:underline">
            Planifícalos en el calendario
          </Link>{" "}
          para comparar.
        </p>
      )}

      {showBySubject && summary.bySubject.length > 0 ? (
        <ul className="mt-5 space-y-2.5" aria-label="Tiempo por materia esta semana">
          {summary.bySubject.map(({ subjectId, seconds }) => {
            const subject = subjects.find((s) => s.id === subjectId);
            return (
              <li key={subjectId ?? "none"}>
                <div className="flex items-center gap-2 text-sm">
                  {subject ? <SubjectSwatch color={subject.color} /> : null}
                  <span className="min-w-0 flex-1 truncate">{subject?.name ?? "Sin materia"}</span>
                  <span className="tabular text-xs text-muted-foreground">{formatFocus(seconds)}</span>
                </div>
                <div aria-hidden className="mt-1 h-1 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(seconds / max) * 100}%`, backgroundColor: subject?.color ?? "var(--muted-foreground)" }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
