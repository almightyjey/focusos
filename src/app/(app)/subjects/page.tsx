import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { DemoSubjectsButton } from "@/components/subjects/demo-subjects-button";
import { NewSubjectButton } from "@/components/subjects/new-subject-button";
import { SubjectActions } from "@/components/subjects/subject-actions";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import { DEMO_SUBJECTS } from "@/config/demo-subjects";
import { formatGrade, gradeStatusText, summarizeGrades, type GradeSummary } from "@/domain/grades";
import { PRIORITY_LABELS, PRIORITY_RANK } from "@/domain/labels";
import { isOpenTask, type Subject } from "@/domain/types";
import { cn } from "@/lib/utils";
import { requireSession } from "@/server/auth";
import { listGradeItems } from "@/server/services/grades";
import { listSubjects } from "@/server/services/subjects";
import { listTasks } from "@/server/services/tasks";

export const metadata: Metadata = { title: "Materias" };

export default function SubjectsPage() {
  return (
    <>
      <PageHeader
        title="Materias"
        description="Lo que cursas este periodo y cuánto trabajo pendiente tiene cada una."
        actions={<NewSubjectButton />}
      />
      <Suspense fallback={<ListSkeleton label="Cargando materias" />}>
        <SubjectsContent />
      </Suspense>
    </>
  );
}

async function SubjectsContent() {
  const session = await requireSession();
  const [subjects, openTasks, gradeItems] = await Promise.all([
    listSubjects(session, { includeArchived: true }),
    listTasks(session, { view: "open" }),
    listGradeItems(session),
  ]);
  const grades = new Map(
    subjects.map((subject) => [subject.id, summarizeGrades(gradeItems.filter((item) => item.subjectId === subject.id))]),
  );

  const openCount = new Map<string, number>();
  for (const task of openTasks) {
    if (task.subjectId && isOpenTask(task)) {
      openCount.set(task.subjectId, (openCount.get(task.subjectId) ?? 0) + 1);
    }
  }

  const byPriority = (a: Subject, b: Subject) =>
    PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.name.localeCompare(b.name, "es");
  const active = subjects.filter((subject) => !subject.isArchived).sort(byPriority);
  const archived = subjects.filter((subject) => subject.isArchived).sort(byPriority);

  if (subjects.length === 0) {
    return (
      <EmptyState
        title="Aún no tienes materias"
        description={`Crea la primera o añade las ${DEMO_SUBJECTS.length} materias de tu periodo en INTEC. Solo se crean los nombres y la prioridad; los horarios y evaluaciones los añades tú.`}
        actions={
          <>
            <NewSubjectButton />
            <DemoSubjectsButton count={DEMO_SUBJECTS.length} />
          </>
        }
      />
    );
  }

  return (
    <div className="space-y-10">
      <SubjectTable
        id="active-subjects"
        title="Activas"
        subjects={active}
        openCount={openCount}
        grades={grades}
        empty="Todas tus materias están archivadas."
      />
      {archived.length > 0 ? (
        <SubjectTable
          id="archived-subjects"
          title="Archivadas"
          subjects={archived}
          openCount={openCount}
          grades={grades}
          muted
        />
      ) : null}
    </div>
  );
}

function SubjectTable({
  id,
  title,
  subjects,
  openCount,
  grades,
  empty,
  muted = false,
}: {
  id: string;
  title: string;
  subjects: Subject[];
  openCount: Map<string, number>;
  grades: Map<string, GradeSummary>;
  empty?: string;
  muted?: boolean;
}) {
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id} title={title} meta={<span className="tabular">{subjects.length}</span>} />
      {subjects.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-rule">
          {subjects.map((subject) => {
            const pending = openCount.get(subject.id) ?? 0;
            const grade = grades.get(subject.id);
            return (
              <li
                key={subject.id}
                data-testid="subject-row"
                className={cn("flex items-center gap-3 py-3", muted && "opacity-70")}
              >
                <SubjectSwatch color={subject.color} className="size-3" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/subjects/${subject.id}`}
                    className="block truncate font-medium underline-offset-4 hover:underline"
                  >
                    {subject.name}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {subject.code ? <span>{subject.code}</span> : null}
                    <span>Prioridad {PRIORITY_LABELS[subject.priority].toLowerCase()}</span>
                    {grade ? <span>{gradeStatusText(grade)}</span> : null}
                  </p>
                </div>
                {grade?.currentAverage != null ? (
                  <span className="tabular text-base font-semibold" title="Nota actual sobre lo evaluado">
                    {formatGrade(grade.currentAverage)}
                  </span>
                ) : null}
                <span className="tabular hidden text-sm text-muted-foreground sm:inline">
                  {pending === 0 ? "Sin pendientes" : pending === 1 ? "1 pendiente" : `${pending} pendientes`}
                </span>
                <SubjectActions subject={subject} openTaskCount={pending} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
