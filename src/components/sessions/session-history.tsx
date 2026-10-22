import { DeleteSessionButton } from "@/components/sessions/delete-session-button";
import { SectionHeading } from "@/components/page-header";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import { dayKey, formatDayHeading } from "@/domain/datetime";
import { formatFocus, type SessionWithTask } from "@/domain/sessions";

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-DO", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function SessionHistory({
  sessions,
  timeZone,
  days,
}: {
  sessions: SessionWithTask[];
  timeZone: string;
  days: number;
}) {
  const byDay = new Map<string, SessionWithTask[]>();
  for (const session of sessions) {
    if (!session.startedAt) continue;
    const key = dayKey(session.startedAt, timeZone);
    byDay.set(key, [...(byDay.get(key) ?? []), session]);
  }

  return (
    <section aria-labelledby="history-heading">
      <SectionHeading id="history-heading" title="Sesiones registradas" meta={`Últimos ${days} días`} />
      {byDay.size === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay sesiones en estos días.</p>
      ) : (
        <ol className="space-y-6">
          {[...byDay.entries()].map(([key, daySessions]) => {
            const total = daySessions.reduce((sum, s) => sum + (s.focusSeconds ?? 0), 0);
            return (
              <li key={key}>
                <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
                  <h3 className="font-medium text-foreground">{formatDayHeading(key)}</h3>
                  <span className="tabular">{formatFocus(total)}</span>
                </div>
                <ul className="divide-y divide-rule">
                  {daySessions.map((session) => (
                    <li key={session.id} className="flex items-start gap-3 py-2.5" data-testid="session-row">
                      <span className="tabular w-24 shrink-0 pt-0.5 text-xs text-muted-foreground">
                        {formatTime(session.startedAt!, timeZone)}
                        {session.endedAt ? ` a ${formatTime(session.endedAt, timeZone)}` : ""}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {session.taskTitle ?? (session.subjectName ? `Repaso de ${session.subjectName}` : "Estudio libre")}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {session.subjectColor ? <SubjectSwatch color={session.subjectColor} /> : null}
                          <span className="truncate">{session.subjectName ?? "Sin materia"}</span>
                        </p>
                        {session.notes ? <p className="mt-1 text-xs text-muted-foreground">{session.notes}</p> : null}
                      </div>
                      <span className="tabular shrink-0 pt-0.5 text-sm font-medium">
                        {formatFocus(session.focusSeconds ?? 0)}
                      </span>
                      <DeleteSessionButton sessionId={session.id} />
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
