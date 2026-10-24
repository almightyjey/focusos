import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { NewGradeItemButton } from "@/components/grades/grade-item-dialog";
import { GradeItemList } from "@/components/grades/grade-item-list";
import { GradeSummary } from "@/components/grades/grade-summary";
import { NeededGrade } from "@/components/grades/needed-grade";
import { ListSkeleton } from "@/components/list-skeleton";
import { SectionHeading } from "@/components/page-header";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskSection } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { summarizeGrades } from "@/domain/grades";
import { PRIORITY_LABELS } from "@/domain/labels";
import { compareOpenTasks } from "@/domain/tasks";
import { idSchema } from "@/schemas/common";
import { requireSession } from "@/server/auth";
import { listGradeItems } from "@/server/services/grades";
import { getProfile } from "@/server/services/profiles";
import { getSubject } from "@/server/services/subjects";
import { listTasks } from "@/server/services/tasks";

export const metadata: Metadata = { title: "Materia" };

export default function SubjectPage({ params }: PageProps<"/subjects/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton label="Cargando la materia" />}>
      <SubjectContent params={params} />
    </Suspense>
  );
}

async function SubjectContent({ params }: { params: PageProps<"/subjects/[id]">["params"] }) {
  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const session = await requireSession();
  const [profile, subject, items, tasks] = await Promise.all([
    getProfile(session),
    getSubject(session, parsedId.data),
    listGradeItems(session, parsedId.data),
    listTasks(session, { view: "open", subjectId: parsedId.data }),
  ]);
  // RLS hace que una materia ajena sea indistinguible de una inexistente.
  if (!subject) notFound();

  const timeZone = profile.timezone;
  const nowIso = new Date().toISOString();
  const summary = summarizeGrades(items);
  const subjectOption = [{ id: subject.id, name: subject.name, color: subject.color }];

  return (
    <>
      <header className="mb-8">
        <Link href="/subjects" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Materias
        </Link>
        <h1 className="mt-1 flex items-center gap-3 text-[1.75rem] leading-tight font-semibold tracking-tight">
          <SubjectSwatch color={subject.color} className="size-3.5" />
          {subject.name}
        </h1>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          {subject.code ? <span>{subject.code}</span> : null}
          <span>Prioridad {PRIORITY_LABELS[subject.priority].toLowerCase()}</span>
          {subject.isArchived ? <span>Archivada</span> : null}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <section aria-labelledby="grades-heading" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule pb-3">
            <div>
              <h2 id="grades-heading" className="text-lg font-semibold tracking-tight">
                Calificaciones
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Nota obtenida, nota máxima y ponderación de cada evaluación.
              </p>
            </div>
            <NewGradeItemButton subjectId={subject.id} timeZone={timeZone} />
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="Sin evaluaciones registradas"
              description="Añade las evaluaciones del programa de la materia con su ponderación. Las notas las completas cuando las recibas."
            />
          ) : (
            <>
              <GradeSummary summary={summary} />
              <NeededGrade summary={summary} />
              <GradeItemList items={items} timeZone={timeZone} />
            </>
          )}
        </section>

        <aside className="space-y-10" aria-label="Trabajo pendiente">
          <div>
            {tasks.length === 0 ? (
              <>
                <SectionHeading title="Tareas pendientes" meta={<span className="tabular">0</span>} />
                <p className="text-sm text-muted-foreground">No hay tareas pendientes de esta materia.</p>
              </>
            ) : (
              <TaskSection
                id="subject-tasks"
                title="Tareas pendientes"
                tasks={[...tasks].sort(compareOpenTasks)}
                subjects={subjectOption}
                nowIso={nowIso}
                timeZone={timeZone}
                showSubject={false}
              />
            )}
            {!subject.isArchived ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <NewTaskButton
                  subjects={subjectOption}
                  timeZone={timeZone}
                  nowIso={nowIso}
                  defaultSubjectId={subject.id}
                  variant="outline"
                />
                <Button asChild variant="ghost">
                  <Link href={`/tasks?subject=${subject.id}`}>Ver todas</Link>
                </Button>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}
