import { SectionHeading } from "@/components/page-header";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
import { formatDayHeading } from "@/domain/datetime";
import type { DayDeadlines } from "@/domain/tasks";

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function UpcomingDeadlines({
  days,
  subjects,
  timeZone,
}: {
  days: DayDeadlines[];
  subjects: SubjectOption[];
  timeZone: string;
}) {
  return (
    <section aria-labelledby="upcoming-heading">
      <SectionHeading id="upcoming-heading" title="Próximas entregas" meta="7 días" />
      {days.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada con fecha en los próximos 7 días.</p>
      ) : (
        <ol className="space-y-4">
          {days.map((day) => (
            <li key={day.dayKey} className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3">
              <time dateTime={day.dayKey} className="pt-0.5 text-xs font-medium text-muted-foreground">
                {formatDayHeading(day.dayKey)}
              </time>
              <ul className="space-y-2">
                {day.tasks.map((task) => {
                  const subject = subjects.find((s) => s.id === task.subjectId);
                  return (
                    <li key={task.id} className="min-w-0">
                      <p className="truncate text-sm font-medium">{task.title}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {subject ? <SubjectSwatch color={subject.color} /> : null}
                        <span className="truncate">{subject?.name ?? "Sin materia"}</span>
                        {task.dueAt ? (
                          <time dateTime={task.dueAt} className="ml-auto shrink-0">
                            {formatTime(task.dueAt, timeZone)}
                          </time>
                        ) : null}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
