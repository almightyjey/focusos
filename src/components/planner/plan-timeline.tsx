import Link from "next/link";

import { SectionHeading } from "@/components/page-header";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import { formatMinutes, minutesToTime } from "@/domain/datetime";
import type { DayPlan } from "@/planner";

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-DO", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );
}

export function PlanTimeline({
  plan,
  subjects,
  timeZone,
  studyWindow,
  limit,
}: {
  plan: DayPlan;
  subjects: Map<string, { name: string; color: string }>;
  timeZone: string;
  studyWindow: { start: number; end: number };
  /** Muestra solo los primeros bloques (dashboard). */
  limit?: number;
}) {
  const blocks = limit ? plan.blocks.slice(0, limit) : plan.blocks;
  const hidden = plan.blocks.length - blocks.length;

  return (
    <section aria-labelledby="plan-heading">
      <SectionHeading
        id="plan-heading"
        title="Plan para hoy"
        meta={
          plan.freeMinutes > 0 ? (
            <span className="tabular">
              {formatMinutes(plan.plannedMinutes)} de {formatMinutes(plan.freeMinutes)} libres
            </span>
          ) : null
        }
      />
      {plan.freeMinutes === 0 ? (
        <p className="text-sm text-muted-foreground">
          No te queda tiempo libre hoy dentro de tu horario de estudio.
        </p>
      ) : blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay tareas pendientes que planificar.</p>
      ) : (
        <ol className="space-y-2" data-testid="plan-blocks">
          {blocks.map((block) => {
            const subject = block.subjectId ? subjects.get(block.subjectId) : undefined;
            return (
              <li key={`${block.taskId}-${block.start}`} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3" data-testid="plan-block">
                <span className="tabular pt-0.5 text-xs text-muted-foreground">
                  {formatTime(block.start, timeZone)} a {formatTime(block.end, timeZone)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{block.title}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {subject ? <SubjectSwatch color={subject.color} /> : null}
                    <span className="truncate">{subject?.name ?? "Sin materia"}</span>
                    <span className="tabular ml-auto shrink-0">
                      {block.minutes} min{block.estimated ? "" : ", sin estimación"}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {hidden > 0 ? (
        <p className="mt-2 text-xs">
          <Link href="/plan" className="font-medium text-primary underline-offset-4 hover:underline">
            {hidden} bloque{hidden === 1 ? "" : "s"} más en el plan completo
          </Link>
        </p>
      ) : null}
      {plan.warnings.length > 0 ? (
        <ul role="status" className="mt-3 space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {plan.warnings.map((warning) => (
            <li key={warning.taskId}>
              No alcanza el tiempo de hoy para «{warning.title}»: faltan {formatMinutes(warning.missingMinutes)}.
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        Según tu horario de estudio, de {minutesToTime(studyWindow.start)} a {minutesToTime(studyWindow.end)}, sin
        contar clases ni eventos.{" "}
        <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
          Cambiar horario
        </Link>
      </p>
    </section>
  );
}
