"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { formatGrade, neededAverage, parseDecimal, type GradeSummary } from "@/domain/grades";

/**
 * Calcula qué promedio hace falta en lo que queda para llegar a la nota
 * final que el estudiante escriba. No guarda nada ni asume una nota mínima.
 */
export function NeededGrade({ summary }: { summary: GradeSummary }) {
  const [target, setTarget] = useState("");
  if (summary.status !== "ok") return null;

  const parsed = parseDecimal(target);
  const valid = parsed !== null && !Number.isNaN(parsed) && parsed > 0 && parsed <= 100;
  const result = valid ? neededAverage(summary, parsed) : null;

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <label htmlFor="target-grade" className="text-sm font-medium">
        ¿Qué nota final buscas?
      </label>
      <div className="mt-2 flex items-center gap-3">
        <Input
          id="target-grade"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Ej. 90"
          className="w-24"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          aria-describedby="target-result"
        />
        <span className="text-sm text-muted-foreground">de 100</span>
      </div>
      <p id="target-result" className="mt-2 text-sm" aria-live="polite" data-testid="needed-result">
        {target.trim() === "" ? (
          <span className="text-muted-foreground">Escribe una nota para ver cuánto necesitas en lo que queda.</span>
        ) : !valid || result === null ? (
          <span className="text-destructive">Escribe un número entre 1 y 100.</span>
        ) : result.kind === "secured" ? (
          "Con lo que ya tienes, esa nota está asegurada."
        ) : result.kind === "unreachable" ? (
          <>
            No alcanza con lo que queda: necesitarías un promedio de{" "}
            <span className="tabular font-semibold">{formatGrade(result.needed)}</span> sobre 100.
          </>
        ) : result.kind === "needed" ? (
          <>
            Necesitas un promedio de <span className="tabular font-semibold">{formatGrade(result.needed)}</span> en el{" "}
            {formatGrade(result.remainingWeight, 2)} % que queda por evaluar.
          </>
        ) : (
          <span className="text-muted-foreground">Ya no queda nada por evaluar.</span>
        )}
      </p>
    </div>
  );
}
