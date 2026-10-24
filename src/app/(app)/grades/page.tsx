import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/page-header";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import { Button } from "@/components/ui/button";
import { formatGrade, gradeStatusText, summarizeGrades } from "@/domain/grades";
import { PRIORITY_RANK } from "@/domain/labels";
import type { GradeItem } from "@/domain/types";
import { requireSession } from "@/server/auth";
import { listGradeItems } from "@/server/services/grades";
import { listSubjects } from "@/server/services/subjects";

export const metadata: Metadata = { title: "Calificaciones" };

export default function GradesPage() {
  return (
    <>
      <PageHeader title="Calificaciones" description="Cómo vas en cada materia según las notas que has registrado." />
      <Suspense fallback={<ListSkeleton label="Cargando calificaciones" />}>
        <GradesContent />
      </Suspense>
    </>
  );
}

async function GradesContent() {
  const session = await requireSession();
  const [subjects, items] = await Promise.all([listSubjects(session), listGradeItems(session)]);

  if (subjects.length === 0) {
    return (
      <EmptyState
        title="Aún no tienes materias"
        description="Crea tus materias y luego registra sus evaluaciones."
        actions={
          <Button asChild variant="outline">
            <Link href="/subjects">Ir a materias</Link>
          </Button>
        }
      />
    );
  }

  const bySubject = new Map<string, GradeItem[]>();
  for (const item of items) bySubject.set(item.subjectId, [...(bySubject.get(item.subjectId) ?? []), item]);
  const rows = subjects
    .map((subject) => ({ subject, summary: summarizeGrades(bySubject.get(subject.id) ?? []) }))
    .sort(
      (a, b) =>
        PRIORITY_RANK[b.subject.priority] - PRIORITY_RANK[a.subject.priority] ||
        a.subject.name.localeCompare(b.subject.name, "es"),
    );

  return (
    <ul className="divide-y divide-rule">
      {rows.map(({ subject, summary }) => (
        <li key={subject.id} data-testid="grades-row">
          <Link
            href={`/subjects/${subject.id}`}
            className="flex items-center gap-4 rounded-md py-3 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <SubjectSwatch color={subject.color} className="size-3" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{subject.name}</span>
              <span className="block text-xs text-muted-foreground">{gradeStatusText(summary)}</span>
            </span>
            <span className="tabular w-16 shrink-0 text-right text-xl font-semibold tracking-tight">
              {summary.currentAverage !== null ? formatGrade(summary.currentAverage) : <span className="text-sm font-normal text-muted-foreground">Sin nota</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
