import { SectionHeading } from "@/components/page-header";
import { SubjectSwatch } from "@/components/subjects/subject-swatch";
import { formatMinutes } from "@/domain/datetime";
import { FACTOR_LABELS, WEIGHTS, type FactorKey, type Recommendation } from "@/planner";

const number = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Orden completo con el cálculo de cada puntuación a la vista. */
export function RankingList({
  ranking,
  subjects,
}: {
  ranking: Recommendation[];
  subjects: Map<string, { name: string; color: string }>;
}) {
  return (
    <section aria-labelledby="ranking-heading">
      <SectionHeading id="ranking-heading" title="Orden recomendado" meta={<span className="tabular">{ranking.length}</span>} />
      {ranking.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay tareas pendientes.</p>
      ) : (
        <ol className="divide-y divide-rule" data-testid="ranking">
          {ranking.map((recommendation, index) => {
            const subject = recommendation.task.subjectId ? subjects.get(recommendation.task.subjectId) : undefined;
            return (
              <li key={recommendation.task.id} className="py-3" data-testid="ranking-item" data-task-title={recommendation.task.title}>
                <div className="flex items-start gap-3">
                  <span className="tabular w-6 shrink-0 pt-0.5 text-sm font-semibold text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{recommendation.task.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      {subject ? (
                        <span className="inline-flex items-center gap-1.5">
                          <SubjectSwatch color={subject.color} />
                          {subject.name}
                        </span>
                      ) : null}
                      <span>
                        {recommendation.remainingMinutes !== null
                          ? `Faltan unas ${formatMinutes(recommendation.remainingMinutes)}`
                          : "Esfuerzo sin estimar"}
                      </span>
                      {recommendation.atRisk ? <span className="font-medium text-destructive">En riesgo</span> : null}
                    </p>
                    {recommendation.reasons.length > 0 ? (
                      <p className="mt-1 text-sm text-muted-foreground">{recommendation.reasons.join(". ")}.</p>
                    ) : null}
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Puntuación <span className="tabular font-medium text-foreground">{number.format(recommendation.score)}</span>
                      </summary>
                      <table className="mt-2 w-full max-w-sm text-left">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th scope="col" className="py-1 font-normal">Factor</th>
                            <th scope="col" className="py-1 text-right font-normal">Valor</th>
                            <th scope="col" className="py-1 text-right font-normal">Peso</th>
                            <th scope="col" className="py-1 text-right font-normal">Aporta</th>
                          </tr>
                        </thead>
                        <tbody className="tabular">
                          {(Object.keys(WEIGHTS) as FactorKey[]).map((key) => (
                            <tr key={key}>
                              <th scope="row" className="py-0.5 font-normal">{FACTOR_LABELS[key]}</th>
                              <td className="py-0.5 text-right">{number.format(recommendation.factors[key].value)}</td>
                              <td className="py-0.5 text-right">{Math.round(WEIGHTS[key] * 100)} %</td>
                              <td className="py-0.5 text-right">{number.format(recommendation.factors[key].contribution)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
