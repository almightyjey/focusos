import { AssistantBoundary } from "@/components/assistant/assistant-boundary";
import { EmptyState } from "@/components/empty-state";
import { TaskItem } from "@/components/tasks/task-item";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
import { DueLabel } from "@/components/tasks/due-label";
import { formatMinutes } from "@/domain/datetime";
import type { TodayAgenda as Agenda } from "@/domain/tasks";
import type { Task } from "@/domain/types";

function TaskGroup({
  label,
  tasks,
  subjects,
  nowIso,
  timeZone,
}: {
  label: string;
  tasks: Task[];
  subjects: SubjectOption[];
  nowIso: string;
  timeZone: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <div>
      <h3 className="pt-4 text-xs font-medium text-muted-foreground">{label}</h3>
      <ul className="divide-y divide-rule">
        <AssistantBoundary>
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} subjects={subjects} nowIso={nowIso} timeZone={timeZone} />
          ))}
        </AssistantBoundary>
      </ul>
    </div>
  );
}

export function TodayAgenda({
  agenda,
  subjects,
  nowIso,
  timeZone,
  showEmptyState = true,
}: {
  agenda: Agenda;
  subjects: SubjectOption[];
  nowIso: string;
  timeZone: string;
  /** Se oculta cuando la página ya muestra la guía de inicio. */
  showEmptyState?: boolean;
}) {
  const pending = agenda.overdue.length + agenda.today.length;

  return (
    <section aria-labelledby="today-heading">
      <div className="border-b border-rule pb-3">
        <h2 id="today-heading" className="text-lg font-semibold tracking-tight">
          Qué hacer hoy
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {pending === 0 ? (
            "No tienes nada pendiente para hoy."
          ) : (
            <>
              {`${pending} ${pending === 1 ? "tarea pendiente" : "tareas pendientes"}`}
              {agenda.estimatedMinutes > 0 ? (
                <>
                  {", unas "}
                  <span className="tabular font-medium text-foreground">
                    {formatMinutes(agenda.estimatedMinutes)}
                  </span>
                  {" estimadas"}
                </>
              ) : null}
              {agenda.unestimatedCount > 0 ? ` (${agenda.unestimatedCount} sin estimación)` : null}.
            </>
          )}
        </p>
      </div>

      {pending === 0 && showEmptyState ? (
        <div className="pt-4">
          <EmptyState
            title={agenda.completedToday.length > 0 ? "Terminaste lo de hoy" : "Nada vence hoy"}
            description={
              agenda.nextUp ? (
                <>
                  Lo siguiente es <span className="font-medium text-foreground">{agenda.nextUp.title}</span>
                  {agenda.nextUp.dueAt ? (
                    <>
                      {", "}
                      <DueLabel dueAt={agenda.nextUp.dueAt} nowIso={nowIso} timeZone={timeZone} className="text-sm" />
                    </>
                  ) : null}
                  .
                </>
              ) : (
                "No hay entregas próximas registradas. Añade la siguiente cuando la conozcas."
              )
            }
          />
        </div>
      ) : null}

      <TaskGroup label="Vencidas" tasks={agenda.overdue} subjects={subjects} nowIso={nowIso} timeZone={timeZone} />
      <TaskGroup label="Para hoy" tasks={agenda.today} subjects={subjects} nowIso={nowIso} timeZone={timeZone} />
      <TaskGroup
        label="Hecho hoy"
        tasks={agenda.completedToday}
        subjects={subjects}
        nowIso={nowIso}
        timeZone={timeZone}
      />
    </section>
  );
}
