import { SectionHeading } from "@/components/page-header";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
import type { UpcomingDay } from "@/domain/agenda";
import { formatDayHeading } from "@/domain/datetime";

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
  days: UpcomingDay[];
  subjects: SubjectOption[];
  timeZone: string;
}) {
  return (
    <section aria-labelledby="upcoming-heading">
      <SectionHeading id="upcoming-heading" title="Próximas entregas y exámenes" meta="7 días" />
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
                {day.items.map((item) => {
                  const subject = subjects.find((s) => s.id === item.subjectId);
                  const isExam = item.type === "exam";
                  return (
                    <li key={`${item.type}-${item.id}`} className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {isExam ? <span className="font-semibold">Examen: </span> : null}
                        {item.title}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {subject ? <SubjectSwatch color={subject.color} /> : null}
                        <span className="truncate">{subject?.name ?? "Sin materia"}</span>
                        <time dateTime={item.at} className="tabular ml-auto shrink-0">
                          {isExam && item.allDay ? "Todo el día" : formatTime(item.at, timeZone)}
                        </time>
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
