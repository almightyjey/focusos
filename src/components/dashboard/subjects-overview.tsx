import Link from "next/link";

import { SectionHeading } from "@/components/page-header";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import { DueLabel } from "@/components/tasks/due-label";
import type { SubjectSummary } from "@/domain/tasks";

export function SubjectsOverview({
  summaries,
  nowIso,
  timeZone,
}: {
  summaries: SubjectSummary[];
  nowIso: string;
  timeZone: string;
}) {
  return (
    <section aria-labelledby="subjects-heading">
      <SectionHeading
        id="subjects-heading"
        title="Materias"
        action={
          <Link href="/subjects" className="font-medium text-primary underline-offset-4 hover:underline">
            Ver todas
          </Link>
        }
      />
      {summaries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          <Link href="/subjects" className="font-medium text-primary underline-offset-4 hover:underline">
            Añade tus materias
          </Link>{" "}
          para ver su estado aquí.
        </p>
      ) : (
        <ul className="divide-y divide-rule">
          {summaries.map(({ subject, openCount, overdueCount, nextDue }) => (
            <li key={subject.id} className="py-2.5">
              <Link
                href={`/tasks?subject=${subject.id}`}
                className="flex items-center gap-2 rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <SubjectSwatch color={subject.color} />
                <span className="truncate">{subject.name}</span>
              </Link>
              <p className="mt-0.5 flex flex-wrap gap-x-3 pl-[1.125rem] text-xs text-muted-foreground">
                <span className="tabular">
                  {openCount === 0 ? "Sin pendientes" : `${openCount} pendiente${openCount === 1 ? "" : "s"}`}
                </span>
                {overdueCount > 0 ? (
                  <span className="tabular font-medium text-destructive">
                    {overdueCount} vencida{overdueCount === 1 ? "" : "s"}
                  </span>
                ) : null}
                {nextDue?.dueAt && overdueCount === 0 ? (
                  <span>
                    Próxima: <DueLabel dueAt={nextDue.dueAt} nowIso={nowIso} timeZone={timeZone} highlight={false} />
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
