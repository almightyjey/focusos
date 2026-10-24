import { Progress } from "@/components/ui/progress";
import { formatGrade, type GradeSummary as Summary } from "@/domain/grades";

const MISSING_LABELS = { maxScore: "nota máxima", weight: "ponderación" } as const;

/** Estado de la nota de una materia, explicando por qué no hay promedio cuando falta información. */
export function GradeSummary({ summary }: { summary: Summary }) {
  if (summary.status === "no_items") return null;

  if (summary.status === "weights_over_100") {
    return (
      <p role="status" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
        Las ponderaciones suman {formatGrade(summary.plannedWeight, 2)} %. Corrígelas para poder calcular el promedio.
      </p>
    );
  }

  if (summary.status === "incomplete_data") {
    return (
      <div role="status" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
        <p className="font-medium text-destructive">No se puede calcular el promedio todavía.</p>
        <ul className="mt-1 list-disc pl-5 text-muted-foreground">
          {summary.missing.map(({ item, missing }) => (
            <li key={item.id}>
              {item.title}: falta {missing.map((key) => MISSING_LABELS[key]).join(" y ")}.
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (summary.status === "no_grades") {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay notas registradas.
        {summary.plannedWeight > 0 ? ` Tienes definido el ${formatGrade(summary.plannedWeight, 2)} % de la nota.` : ""}
      </p>
    );
  }

  const remaining = Math.max(0, 100 - summary.gradedWeight);
  return (
    <div className="space-y-3" data-testid="grade-summary">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Nota actual sobre lo evaluado</p>
          <p className="tabular text-4xl font-semibold tracking-tight" data-testid="current-average">
            {formatGrade(summary.currentAverage ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Puntos asegurados de 100</p>
          <p className="tabular text-2xl font-semibold tracking-tight">{formatGrade(summary.earnedPoints ?? 0)}</p>
        </div>
      </div>
      <Progress value={summary.gradedWeight} aria-label={`${formatGrade(summary.gradedWeight)} % de la nota evaluado`} />
      <p className="text-xs text-muted-foreground">
        Evaluado el {formatGrade(summary.gradedWeight, 2)} % de la nota; queda el {formatGrade(remaining, 2)} %.
        {summary.plannedWeight < 100
          ? ` Solo has definido el ${formatGrade(summary.plannedWeight, 2)} % del plan de evaluación.`
          : ""}
      </p>
    </div>
  );
}
