import { SectionHeading } from "@/components/page-header";
import { formatMinutes } from "@/domain/datetime";
import { describeRatio, type EstimateAccuracy as Accuracy } from "@/domain/sessions";

export function EstimateAccuracy({ accuracy }: { accuracy: Accuracy }) {
  const { entries, medianRatio, minSamples } = accuracy;

  return (
    <section aria-labelledby="estimate-heading">
      <SectionHeading id="estimate-heading" title="Estimado frente a real" />
      {medianRatio !== null ? (
        <p className="text-sm">
          Tus tareas te toman <span className="font-semibold">{describeRatio(medianRatio)}</span>, según{" "}
          {entries.length} tareas completadas.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Hace falta comparar al menos {minSamples} tareas completadas con estimación y tiempo registrado.
          {entries.length > 0 ? ` Llevas ${entries.length}.` : ""}
        </p>
      )}
      {entries.length > 0 ? (
        <ul className="mt-3 divide-y divide-rule">
          {entries.slice(0, 5).map((entry) => (
            <li key={entry.task.id} className="py-2">
              <p className="truncate text-sm font-medium">{entry.task.title}</p>
              <p className="tabular text-xs text-muted-foreground">
                Estimado {formatMinutes(entry.estimatedMinutes)}, real {formatMinutes(entry.actualMinutes)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
