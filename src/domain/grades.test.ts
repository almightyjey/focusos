import { describe, expect, it } from "vitest";

import { formatGrade, itemPercent, neededAverage, parseDecimal, summarizeGrades } from "@/domain/grades";
import type { GradeItem } from "@/domain/types";

let counter = 0;
function item(overrides: Partial<GradeItem> = {}): GradeItem {
  counter += 1;
  return {
    id: `g${counter}`,
    subjectId: "s",
    title: `Evaluación ${counter}`,
    category: "exam",
    score: null,
    maxScore: null,
    weight: null,
    dueAt: null,
    notes: null,
    ...overrides,
  };
}

describe("summarizeGrades", () => {
  it("calcula el promedio ponderado sobre lo evaluado", () => {
    const summary = summarizeGrades([
      item({ title: "Parcial 1", score: 85, maxScore: 100, weight: 25 }),
      item({ title: "Tareas", category: "assignment", score: 18, maxScore: 20, weight: 15 }),
      item({ title: "Final", weight: 30 }),
    ]);
    expect(summary.status).toBe("ok");
    expect(summary.gradedWeight).toBe(40);
    expect(summary.plannedWeight).toBe(70);
    expect(summary.earnedPoints).toBeCloseTo(34.75, 6);
    expect(summary.currentAverage).toBeCloseTo(86.875, 6);
  });

  it("no calcula promedios si a una evaluación calificada le faltan datos", () => {
    const sinMaxima = item({ title: "Quiz", score: 8, weight: 10 });
    const sinPeso = item({ title: "Lab", score: 9, maxScore: 10 });
    const summary = summarizeGrades([item({ score: 90, maxScore: 100, weight: 20 }), sinMaxima, sinPeso]);
    expect(summary.status).toBe("incomplete_data");
    expect(summary.currentAverage).toBeNull();
    expect(summary.earnedPoints).toBeNull();
    expect(summary.missing.map((m) => [m.item.title, m.missing])).toEqual([
      ["Quiz", ["maxScore"]],
      ["Lab", ["weight"]],
    ]);
  });

  it("distingue sin evaluaciones, sin notas y ponderaciones de más del 100 %", () => {
    expect(summarizeGrades([]).status).toBe("no_items");
    expect(summarizeGrades([item({ weight: 30 })]).status).toBe("no_grades");
    const over = summarizeGrades([
      item({ score: 10, maxScore: 10, weight: 60 }),
      item({ weight: 50 }),
    ]);
    expect(over.status).toBe("weights_over_100");
    expect(over.currentAverage).toBeNull();
  });

  it("calcula el porcentaje de cada evaluación solo con nota y máxima", () => {
    expect(itemPercent({ score: 18, maxScore: 20 })).toBe(90);
    expect(itemPercent({ score: 18, maxScore: null })).toBeNull();
    // Puntos extra: se muestran tal cual, no se recortan.
    expect(itemPercent({ score: 22, maxScore: 20 })).toBeCloseTo(110);
  });
});

describe("neededAverage", () => {
  const summary = summarizeGrades([
    item({ score: 85, maxScore: 100, weight: 25 }),
    item({ score: 18, maxScore: 20, weight: 15 }),
  ]);

  it("calcula el promedio necesario en lo que queda", () => {
    const result = neededAverage(summary, 80);
    expect(result.kind).toBe("needed");
    if (result.kind === "needed") {
      expect(result.remainingWeight).toBe(60);
      expect(result.needed).toBeCloseTo(75.4167, 3);
    }
  });

  it("detecta metas inalcanzables o ya aseguradas", () => {
    expect(neededAverage(summary, 99).kind).toBe("unreachable");
    expect(neededAverage(summary, 30).kind).toBe("secured");
  });

  it("no calcula nada con datos incompletos o sin peso restante", () => {
    expect(neededAverage(summarizeGrades([item({ score: 8, weight: 10 })]), 70)).toEqual({
      kind: "unavailable",
      reason: "no_data",
    });
    const full = summarizeGrades([item({ score: 70, maxScore: 100, weight: 100 })]);
    expect(neededAverage(full, 80)).toEqual({ kind: "unavailable", reason: "nothing_left" });
  });
});

describe("formato y lectura de números", () => {
  it("formatea con punto decimal y lee coma o punto", () => {
    expect(formatGrade(86.875)).toBe("86.9");
    expect(formatGrade(90)).toBe("90");
    expect(parseDecimal("8,5")).toBe(8.5);
    expect(parseDecimal(" 17.25 ")).toBe(17.25);
    expect(parseDecimal("")).toBeNull();
    expect(Number.isNaN(parseDecimal("8.555"))).toBe(true);
    expect(Number.isNaN(parseDecimal("-3"))).toBe(true);
  });
});
