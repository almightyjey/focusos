import type { GradeItem } from "@/domain/types";

// Reglas de cálculo
//  * Una evaluación está "calificada" cuando tiene nota obtenida.
//  * Para entrar en el promedio ponderado necesita además nota máxima y
//    ponderación. Si una evaluación calificada no las tiene, no se calcula
//    ningún promedio: se informa qué falta.
//  * La nota actual es el promedio sobre lo ya evaluado (0–100). Los puntos
//    acumulados son lo que ya está asegurado de la nota final (0–100).

export type MissingData = { item: GradeItem; missing: ("maxScore" | "weight")[] };

export type GradeSummary = {
  status: "no_items" | "no_grades" | "incomplete_data" | "weights_over_100" | "ok";
  itemCount: number;
  gradedCount: number;
  /** Suma de ponderaciones conocidas de todas las evaluaciones. */
  plannedWeight: number;
  /** Suma de ponderaciones de lo ya calificado (con datos completos). */
  gradedWeight: number;
  /** Puntos de la nota final ya obtenidos (0–100), si se puede calcular. */
  earnedPoints: number | null;
  /** Promedio ponderado sobre lo evaluado (0–100), si se puede calcular. */
  currentAverage: number | null;
  /** Evaluaciones calificadas a las que les falta nota máxima o ponderación. */
  missing: MissingData[];
};

/** Porcentaje de una evaluación (score / max), si se conocen ambos. */
export function itemPercent(item: Pick<GradeItem, "score" | "maxScore">): number | null {
  if (item.score === null || item.maxScore === null || item.maxScore <= 0) return null;
  return (item.score / item.maxScore) * 100;
}

const round = (value: number, decimals = 2) => Math.round(value * 10 ** decimals) / 10 ** decimals;

export function summarizeGrades(items: GradeItem[]): GradeSummary {
  const graded = items.filter((item) => item.score !== null);
  const plannedWeight = round(items.reduce((sum, item) => sum + (item.weight ?? 0), 0));
  const missing: MissingData[] = graded
    .map((item) => ({
      item,
      missing: [
        ...(item.maxScore === null ? (["maxScore"] as const) : []),
        ...(item.weight === null ? (["weight"] as const) : []),
      ],
    }))
    .filter((entry) => entry.missing.length > 0);

  const base = {
    itemCount: items.length,
    gradedCount: graded.length,
    plannedWeight,
    missing,
  };

  if (items.length === 0) {
    return { ...base, status: "no_items", gradedWeight: 0, earnedPoints: null, currentAverage: null };
  }
  if (plannedWeight > 100) {
    return { ...base, status: "weights_over_100", gradedWeight: 0, earnedPoints: null, currentAverage: null };
  }
  if (graded.length === 0) {
    return { ...base, status: "no_grades", gradedWeight: 0, earnedPoints: null, currentAverage: null };
  }
  if (missing.length > 0) {
    return { ...base, status: "incomplete_data", gradedWeight: 0, earnedPoints: null, currentAverage: null };
  }

  const gradedWeight = round(graded.reduce((sum, item) => sum + (item.weight ?? 0), 0));
  const earnedPoints = graded.reduce((sum, item) => sum + ((itemPercent(item) ?? 0) / 100) * (item.weight ?? 0), 0);
  return {
    ...base,
    status: "ok",
    gradedWeight,
    earnedPoints: round(earnedPoints, 4),
    currentAverage: gradedWeight > 0 ? round((earnedPoints / gradedWeight) * 100, 4) : null,
  };
}

export type NeededResult =
  | { kind: "unavailable"; reason: "no_data" | "nothing_left" }
  | { kind: "secured" }
  | { kind: "unreachable"; needed: number }
  | { kind: "needed"; needed: number; remainingWeight: number };

/**
 * Promedio necesario en lo que queda por evaluar (100 % menos lo calificado)
 * para llegar a `target` en la nota final. Solo con un resumen válido.
 */
export function neededAverage(summary: GradeSummary, target: number): NeededResult {
  if (summary.status !== "ok" || summary.earnedPoints === null) return { kind: "unavailable", reason: "no_data" };
  const remainingWeight = round(100 - summary.gradedWeight);
  if (summary.earnedPoints >= target) return { kind: "secured" };
  if (remainingWeight <= 0) return { kind: "unavailable", reason: "nothing_left" };
  const needed = ((target - summary.earnedPoints) / remainingWeight) * 100;
  if (needed > 100) return { kind: "unreachable", needed: round(needed, 4) };
  return { kind: "needed", needed: round(needed, 4), remainingWeight };
}

/** 86.875 → "86.9" (es-DO usa punto decimal). */
export function formatGrade(value: number, decimals = 1): string {
  return new Intl.NumberFormat("es-DO", { maximumFractionDigits: decimals, minimumFractionDigits: 0 }).format(value);
}

/** Parte numérica de un campo de nota: acepta "8,5" y "8.5". */
export function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

/** Una línea que resume el estado sin inventar un promedio que no se puede calcular. */
export function gradeStatusText(summary: GradeSummary): string {
  switch (summary.status) {
    case "no_items":
      return "Sin evaluaciones registradas";
    case "no_grades":
      return summary.plannedWeight > 0
        ? `Sin notas aún, ${formatGrade(summary.plannedWeight, 2)} % del plan definido`
        : "Sin notas aún";
    case "weights_over_100":
      return `Las ponderaciones suman ${formatGrade(summary.plannedWeight, 2)} %`;
    case "incomplete_data":
      return `Faltan datos en ${summary.missing.length} evaluación${summary.missing.length === 1 ? "" : "es"}`;
    case "ok":
      return `Evaluado el ${formatGrade(summary.gradedWeight, 2)} % de la nota`;
  }
}
