import { describe, expect, it } from "vitest";

import { zonedInputToUtc } from "@/domain/datetime";
import type { EventOccurrence } from "@/domain/events";
import type { PriorityLevel, Task } from "@/domain/types";
import { buildPlan } from "@/planner";
import { freeMinutesBetween, freeSlots } from "@/planner/availability";
import { BREAK_MINUTES, planDay } from "@/planner/plan";
import { MAX_CHUNK_MINUTES, proximityUrgency, rankTasks, remainingMinutes } from "@/planner/scoring";

const SD = "America/Santo_Domingo";
const at = (date: string, time: string) => zonedInputToUtc(date, time, SD).toISOString();
// Jueves 22 de octubre de 2026, 09:00 en Santo Domingo.
const NOW = new Date(at("2026-10-22", "09:00"));
const WINDOW = { start: 8 * 60, end: 22 * 60 };

function occurrence(overrides: Partial<EventOccurrence>): EventOccurrence {
  return {
    key: "k",
    eventId: "e",
    title: "Evento",
    kind: "class",
    subjectId: null,
    location: null,
    startsAt: at("2026-10-22", "10:00"),
    endsAt: at("2026-10-22", "11:30"),
    allDay: false,
    recurring: false,
    ...overrides,
  };
}

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    subjectId: null,
    title: id,
    description: null,
    kind: "assignment",
    status: "pending",
    priority: "medium",
    dueAt: null,
    estimatedMinutes: null,
    difficulty: null,
    completedAt: null,
    focusSeconds: 0,
    ...overrides,
  };
}

const EVENTS = [
  occurrence({ key: "clase" }),
  occurrence({ key: "bloque", kind: "study_block", startsAt: at("2026-10-22", "15:00"), endsAt: at("2026-10-22", "16:00") }),
  occurrence({ key: "examen", kind: "exam", allDay: true, startsAt: at("2026-10-22", "00:00"), endsAt: at("2026-10-23", "00:00") }),
  occurrence({ key: "tarde", startsAt: at("2026-10-22", "20:00"), endsAt: at("2026-10-22", "21:50") }),
];

const slotsFor = (days = 14) =>
  freeSlots({ startKey: "2026-10-22", days, timeZone: SD, window: WINDOW, occurrences: EVENTS, now: NOW });

describe("tiempo libre", () => {
  it("resta clases y lo ya pasado, pero no los bloques de estudio ni los eventos de todo el día", () => {
    const today = slotsFor(1);
    expect(today.map((s) => [s.start, s.end, s.minutes])).toEqual([
      [at("2026-10-22", "09:00"), at("2026-10-22", "10:00"), 60],
      [at("2026-10-22", "11:30"), at("2026-10-22", "20:00"), 510],
      // 21:50 a 22:00 son 10 min: no se ofrece.
    ]);
  });

  it("usa el horario completo en los días siguientes y admite terminar a medianoche", () => {
    expect(slotsFor(2).filter((s) => s.dayKey === "2026-10-23").map((s) => s.minutes)).toEqual([840]);
    const lateWindow = freeSlots({
      startKey: "2026-10-23",
      days: 1,
      timeZone: SD,
      window: { start: 20 * 60, end: 1440 },
      occurrences: [],
      now: NOW,
    });
    expect(lateWindow[0]).toMatchObject({ start: at("2026-10-23", "20:00"), end: at("2026-10-24", "00:00"), minutes: 240 });
  });

  it("no ofrece nada si el horario de hoy ya terminó", () => {
    const night = new Date(at("2026-10-22", "22:30"));
    expect(freeSlots({ startKey: "2026-10-22", days: 1, timeZone: SD, window: WINDOW, occurrences: [], now: night })).toEqual([]);
  });

  it("suma los minutos libres hasta un instante", () => {
    expect(freeMinutesBetween(slotsFor(), NOW.getTime(), Date.parse(at("2026-10-22", "12:00")))).toBe(90);
  });
});

describe("factores", () => {
  it("la urgencia crece al acercarse la entrega", () => {
    expect(proximityUrgency(null, NOW)).toBe(0.1);
    expect(proximityUrgency(at("2026-10-21", "23:59"), NOW)).toBe(1);
    expect(proximityUrgency(new Date(NOW.getTime() + 2 * 86_400_000).toISOString(), NOW)).toBe(0.5);
  });

  it("el esfuerzo pendiente descuenta lo ya estudiado", () => {
    expect(remainingMinutes(task("a", { estimatedMinutes: 90, focusSeconds: 3600 }))).toBe(30);
    expect(remainingMinutes(task("b", { estimatedMinutes: 60, focusSeconds: 7200 }))).toBeNull();
    expect(remainingMinutes(task("c"))).toBeNull();
  });
});

const SUBJECTS = new Map<string, PriorityLevel>([["calc", "high"]]);
const TASKS = [
  task("manana-alta", { title: "Informe", priority: "high", subjectId: "calc", dueAt: at("2026-10-23", "23:59"), estimatedMinutes: 120 }),
  task("semana-baja", { title: "Lectura", priority: "low", dueAt: at("2026-10-29", "09:00"), estimatedMinutes: 60 }),
  task("vencida", { title: "Guía", dueAt: at("2026-10-21", "23:59") }),
  task("sin-fecha-urgente", { title: "Repaso", priority: "urgent" }),
  task("hecha", { status: "completed", completedAt: at("2026-10-21", "10:00"), dueAt: at("2026-10-22", "10:00") }),
];
const rank = (tasks: Task[]) =>
  rankTasks({ tasks, subjectPriority: SUBJECTS, slots: slotsFor(), horizonEnd: new Date(at("2026-11-05", "00:00")), now: NOW, timeZone: SD });

describe("orden recomendado", () => {
  it("combina vencimiento, prioridad, materia, dificultad y encaje", () => {
    const ranking = rank(TASKS);
    expect(ranking.map((r) => r.task.id)).toEqual(["vencida", "manana-alta", "sin-fecha-urgente", "semana-baja"]);
    expect(ranking[0].score).toBeCloseTo(0.775, 4);
    expect(ranking[1].factors.urgency.value).toBeCloseTo(0.5519, 3);
    expect(ranking[1].factors.fit.value).toBeCloseTo(60 / MAX_CHUNK_MINUTES, 4);
  });

  it("es determinista: el orden de entrada no cambia el resultado", () => {
    const shuffled = [TASKS[3], TASKS[0], TASKS[4], TASKS[2], TASKS[1]];
    expect(rank(shuffled)).toEqual(rank(TASKS));
  });

  it("resuelve empates de puntuación por fecha y luego por id", () => {
    const twins = [task("b", { dueAt: at("2026-10-30", "10:00") }), task("a", { dueAt: at("2026-10-30", "10:00") }), task("c", { dueAt: at("2026-10-28", "10:00") })];
    expect(rank(twins).map((r) => r.task.id)).toEqual(["c", "a", "b"]);
  });

  it("marca en riesgo lo que no cabe en el tiempo libre antes de la entrega", () => {
    const [big] = rank([task("enorme", { dueAt: at("2026-10-23", "10:00"), estimatedMinutes: 1000 })]);
    expect(big.freeMinutesBeforeDue).toBe(60 + 510 + 120);
    expect(big.atRisk).toBe(true);
    expect(big.factors.urgency.value).toBeGreaterThanOrEqual(0.95);
    expect(big.reasons).toContain("Necesita unas 16 h 40 min y antes de la entrega tienes 11 h 30 min libres");
  });

  it("explica en español por qué recomienda cada tarea", () => {
    const ranking = rank(TASKS);
    const byId = new Map(ranking.map((r) => [r.task.id, r.reasons]));
    expect(byId.get("vencida")).toEqual(["Venció ayer, 23:59", "Cabe en tu próximo hueco libre (1 h)", "Sin estimación: se propone un bloque de 30 min"]);
    expect(byId.get("manana-alta")).toEqual(["Vence mañana, 23:59", "Prioridad alta", "Materia prioritaria"]);
  });
});

describe("plan del día", () => {
  it("reparte por orden en bloques de hasta 90 min con descansos", () => {
    const plan = planDay({ ranking: rank(TASKS), slots: slotsFor(), day: "2026-10-22", now: NOW, timeZone: SD });
    expect(plan.blocks.map((b) => [b.taskId, b.start, b.minutes, b.estimated])).toEqual([
      ["vencida", at("2026-10-22", "09:00"), 30, false],
      ["manana-alta", at("2026-10-22", "09:40"), 20, true],
      ["manana-alta", at("2026-10-22", "11:30"), 90, true],
      ["manana-alta", at("2026-10-22", "13:10"), 10, true],
      ["sin-fecha-urgente", at("2026-10-22", "13:30"), 30, false],
      ["semana-baja", at("2026-10-22", "14:10"), 60, true],
    ]);
    expect(plan.plannedMinutes).toBe(240);
    expect(plan.freeMinutes).toBe(570);
    for (let i = 1; i < plan.blocks.length; i += 1) {
      const gap = (Date.parse(plan.blocks[i].start) - Date.parse(plan.blocks[i - 1].end)) / 60_000;
      expect(gap).toBeGreaterThanOrEqual(BREAK_MINUTES);
    }
    expect(plan.blocks.every((b) => b.minutes <= MAX_CHUNK_MINUTES)).toBe(true);
  });

  it("avisa cuando lo que vence hoy no cabe en el tiempo libre de hoy", () => {
    const ranking = rank([task("hoy", { title: "Proyecto", dueAt: at("2026-10-22", "21:00"), estimatedMinutes: 900 })]);
    const plan = planDay({ ranking, slots: slotsFor(), day: "2026-10-22", now: NOW, timeZone: SD });
    expect(plan.warnings).toEqual([{ taskId: "hoy", title: "Proyecto", missingMinutes: 900 - plan.plannedMinutes }]);
  });
});

describe("buildPlan", () => {
  it("da el mismo resultado con las mismas entradas", () => {
    const input = { tasks: TASKS, subjectPriority: SUBJECTS, occurrences: EVENTS, now: NOW, timeZone: SD, studyWindow: WINDOW };
    const first = buildPlan(input);
    expect(buildPlan({ ...input, tasks: [...TASKS].reverse() })).toEqual(first);
    expect(first.today.blocks[0].taskId).toBe("vencida");
  });
});
