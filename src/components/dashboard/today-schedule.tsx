import Link from "next/link";

import { SectionHeading } from "@/components/page-header";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import type { SubjectOption } from "@/components/tasks/task-form-dialog";
import type { EventOccurrence } from "@/domain/events";
import { EVENT_KIND_LABELS } from "@/domain/labels";
import { cn } from "@/lib/utils";

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** Clases, exámenes y bloques de estudio de hoy, con lo que ya pasó atenuado. */
export function TodaySchedule({
  occurrences,
  subjects,
  nowIso,
  timeZone,
  calendarHref,
}: {
  occurrences: EventOccurrence[];
  subjects: SubjectOption[];
  nowIso: string;
  timeZone: string;
  calendarHref: string;
}) {
  const now = Date.parse(nowIso);

  return (
    <section aria-labelledby="schedule-heading">
      <SectionHeading
        id="schedule-heading"
        title="Horario de hoy"
        action={
          <Link href={calendarHref} className="font-medium text-primary underline-offset-4 hover:underline">
            Calendario
          </Link>
        }
      />
      {occurrences.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tienes clases ni eventos hoy.</p>
      ) : (
        <ul className="space-y-2.5">
          {occurrences.map((occurrence) => {
            const subject = subjects.find((s) => s.id === occurrence.subjectId);
            const past = !occurrence.allDay && Date.parse(occurrence.endsAt) <= now;
            const current =
              !occurrence.allDay && Date.parse(occurrence.startsAt) <= now && Date.parse(occurrence.endsAt) > now;
            return (
              <li
                key={occurrence.key}
                className={cn("grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3", past && "opacity-60")}
              >
                <span className="tabular pt-0.5 text-xs text-muted-foreground">
                  {occurrence.allDay ? "Todo el día" : formatTime(occurrence.startsAt, timeZone)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {occurrence.kind === "exam" ? <span className="font-semibold">Examen: </span> : null}
                    {occurrence.title}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {subject ? <SubjectSwatch color={subject.color} /> : null}
                    <span className="truncate">
                      {current ? "Ahora, " : ""}
                      {EVENT_KIND_LABELS[occurrence.kind].toLowerCase()}
                      {occurrence.allDay ? "" : ` hasta las ${formatTime(occurrence.endsAt, timeZone)}`}
                      {occurrence.location ? `, ${occurrence.location}` : ""}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
