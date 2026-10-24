import { TriangleAlertIcon } from "lucide-react";

import { GradeItemActions } from "@/components/grades/grade-item-actions";
import { formatGrade, itemPercent } from "@/domain/grades";
import { GRADE_CATEGORY_LABELS } from "@/domain/labels";
import type { GradeItem } from "@/domain/types";

function formatDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-DO", { timeZone, day: "numeric", month: "short" }).format(new Date(iso));
}

export function GradeItemList({ items, timeZone }: { items: GradeItem[]; timeZone: string }) {
  return (
    <ul className="divide-y divide-rule">
      {items.map((item) => {
        const percent = itemPercent(item);
        const missing = [
          item.score !== null && item.maxScore === null ? "la nota máxima" : null,
          item.score !== null && item.weight === null ? "la ponderación" : null,
        ].filter(Boolean);
        return (
          <li key={item.id} className="flex items-start gap-3 py-3" data-testid="grade-item" data-grade-title={item.title}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{item.title}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>{GRADE_CATEGORY_LABELS[item.category]}</span>
                {item.dueAt ? <time dateTime={item.dueAt}>{formatDate(item.dueAt, timeZone)}</time> : null}
                <span>{item.weight === null ? "Sin ponderación" : `Pondera ${formatGrade(item.weight, 2)} %`}</span>
              </p>
              {missing.length > 0 ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive">
                  <TriangleAlertIcon className="size-3.5" aria-hidden />
                  Falta {missing.join(" y ")}
                </p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              {item.score === null ? (
                <span className="text-sm text-muted-foreground">Sin nota</span>
              ) : (
                <>
                  <p className="tabular text-sm font-semibold">
                    {formatGrade(item.score, 2)}
                    {item.maxScore !== null ? (
                      <span className="font-normal text-muted-foreground"> / {formatGrade(item.maxScore, 2)}</span>
                    ) : null}
                  </p>
                  {percent !== null ? (
                    <p className="tabular text-xs text-muted-foreground">{formatGrade(percent)} %</p>
                  ) : null}
                </>
              )}
            </div>
            <GradeItemActions item={item} timeZone={timeZone} />
          </li>
        );
      })}
    </ul>
  );
}
