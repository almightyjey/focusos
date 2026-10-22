import type { PriorityLevel } from "@/domain/types";

/**
 * Materias de demostración (Ingeniería de Software, INTEC). Solo nombre, color y
 * prioridad: códigos, créditos, horarios y evaluaciones se dejan vacíos a
 * propósito para no inventar datos académicos. Edita esta lista libremente.
 */
export type DemoSubject = { name: string; color: string; priority: PriorityLevel };

export const DEMO_SUBJECTS: readonly DemoSubject[] = [
  { name: "Cálculo Diferencial", color: "#2B4ACB", priority: "high" },
  { name: "Introducción a la Programación", color: "#D9480F", priority: "high" },
  { name: "Laboratorio de Introducción a la Programación", color: "#E8780C", priority: "high" },
  { name: "Técnicas Fundamentales de Ingeniería de Software", color: "#1F7A99", priority: "medium" },
  {
    name: "Laboratorio de Técnicas Fundamentales de Ingeniería de Software",
    color: "#3E9BB8",
    priority: "medium",
  },
  { name: "Argumentación Lingüística", color: "#8B4FB3", priority: "medium" },
  {
    name: "Ser Humano y Sociedad: Temas Sociales Contemporáneos",
    color: "#2F8F6B",
    priority: "medium",
  },
  { name: "Electivas de Áreas Académicas IV", color: "#8A7A2E", priority: "medium" },
];
