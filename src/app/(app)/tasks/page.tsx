import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { EmptyState } from "@/components/empty-state";
import { ListSkeleton } from "@/components/list-skeleton";
import { PageHeader } from "@/components/page-header";
import { NewTaskButton } from "@/components/tasks/new-task-button";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskSection } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { compareCompletedTasks, groupOpenTasksByDue } from "@/domain/tasks";
import { taskFiltersSchema } from "@/schemas/task";
import { requireSession } from "@/server/auth";
import { getProfile } from "@/server/services/profiles";
import { listSubjects } from "@/server/services/subjects";
import { listTasks } from "@/server/services/tasks";

export const metadata: Metadata = { title: "Tareas" };

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <>
      <PageHeader title="Tareas" description="Todo lo pendiente, ordenado por fecha límite." />
      <Suspense fallback={<ListSkeleton label="Cargando tareas" />}>
        <TasksContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function TasksContent({ searchParams }: { searchParams: PageProps<"/tasks">["searchParams"] }) {
  const raw = await searchParams;
  const filters = taskFiltersSchema.parse({
    view: typeof raw.view === "string" ? raw.view : undefined,
    subject: typeof raw.subject === "string" ? raw.subject : undefined,
  });
  const session = await requireSession();
  const [profile, subjects, tasks] = await Promise.all([
    getProfile(session),
    listSubjects(session, { includeArchived: true }),
    listTasks(session, { view: filters.view, subjectId: filters.subject }),
  ]);
  const nowIso = new Date().toISOString();
  const timeZone = profile.timezone;
  const subjectOptions = subjects.map(({ id, name, color }) => ({ id, name, color }));
  const activeOptions = subjects
    .filter((subject) => !subject.isArchived)
    .map(({ id, name, color }) => ({ id, name, color }));
  const filteredSubject = subjects.find((subject) => subject.id === filters.subject);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <TaskFilters view={filters.view} subjectId={filters.subject} subjects={subjectOptions} />
        </div>
        <NewTaskButton
          subjects={activeOptions}
          timeZone={timeZone}
          nowIso={nowIso}
          defaultSubjectId={filteredSubject && !filteredSubject.isArchived ? filteredSubject.id : undefined}
        />
      </div>

      {tasks.length === 0 ? (
        filters.view === "completed" ? (
          <EmptyState
            title="Aún no hay tareas completadas"
            description="Cuando marques una tarea como hecha aparecerá aquí."
          />
        ) : subjects.length === 0 ? (
          <EmptyState
            title="Empieza por tus materias"
            description="Crea tus materias para poder organizar las tareas por asignatura. También puedes crear tareas sin materia."
            actions={
              <Button asChild variant="outline">
                <Link href="/subjects">Ir a materias</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={filteredSubject ? `No hay tareas pendientes de ${filteredSubject.name}` : "No tienes tareas pendientes"}
            description="Añade la próxima entrega, lectura o sesión de estudio con su fecha límite."
          />
        )
      ) : filters.view === "completed" ? (
        <TaskSection
          id="completed-tasks"
          title="Completadas recientemente"
          tasks={[...tasks].sort(compareCompletedTasks)}
          subjects={subjectOptions}
          nowIso={nowIso}
          timeZone={timeZone}
        />
      ) : (
        groupOpenTasksByDue(tasks, new Date(nowIso), timeZone).map((group) => (
          <TaskSection
            key={group.bucket}
            id={`group-${group.bucket}`}
            title={group.label}
            tasks={group.tasks}
            subjects={subjectOptions}
            nowIso={nowIso}
            timeZone={timeZone}
          />
        ))
      )}
    </div>
  );
}
