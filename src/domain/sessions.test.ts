import { describe, expect, it } from "vitest";

import { zonedInputToUtc } from "@/domain/datetime";
import type { EventOccurrence } from "@/domain/events";
import {
  describeRatio,
  estimateAccuracy,
  focusSecondsAt,
  formatClock,
  formatFocus,
  plannedStudyMinutes,
  remainingSeconds,
  summarizeFocus,
  type StudySession,
} from "@/domain/sessions";
import type { Task } from "@/domain/types";

const SD = "America/Santo_Domingo";
const at = (date: string, time: string) => zonedInputToUtc(date, time, SD).toISOString();
const ms = (iso: string) => Date.parse(iso);

function session(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: "s",
    taskId: null,
    subjectId: null,
    status: "active",
    plannedMinutes: 25,
    startedAt: at("2026-10-22", "10:00"),
    endedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
    focusSeconds: null,
    notes: null,
    ...overrides,
  };
}

describe("tiempo de enfoque", () => {
  it("descuenta las pausas acumuladas y la que está en curso", () => {
    const now = ms(at("2026-10-22", "10:30"));
    expect(focusSecondsAt(session(), now)).toBe(30 * 60);
    expect(focusSecondsAt(session({ pausedSeconds: 300 }), now)).toBe(25 * 60);
    expect(focusSecondsAt(session({ pausedSeconds: 300, pausedAt: at("2026-10-22", "10:20") }), now)).toBe(15 * 60);
  });

  it("usa lo registrado en sesiones terminadas", () => {
    expect(focusSecondsAt(session({ status: "completed", focusSeconds: 1234 }), Date.now())).toBe(1234);
  });

  it("calcula lo que falta y el tiempo extra", () => {
    const s = session();
    expect(remainingSeconds(s, ms(at("2026-10-22", "10:20")))).toBe(5 * 60);
    expect(remainingSeconds(s, ms(at("2026-10-22", "10:27")))).toBe(-2 * 60);
    expect(remainingSeconds(session({ plannedMinutes: null }), Date.now())).toBeNull();
  });

  it("formatea relojes y duraciones", () => {
    expect(formatClock(25 * 60)).toBe("25:00");
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(3909)).toBe("1:05:09");
    expect(formatClock(-90)).toBe("01:30");
    expect(formatFocus(30)).toBe("menos de 1 min");
    expect(formatFocus(47 * 60 + 59)).toBe("47 min");
    expect(formatFocus(125 * 60)).toBe("2 h 5 min");
  });
});

describe("summarizeFocus", () => {
  it("suma hoy y la semana por día local, e ignora lo no completado", () => {
    const now = new Date(at("2026-10-22", "18:00"));
    const summary = summarizeFocus(
      [
        session({ status: "completed", focusSeconds: 1500, subjectId: "calc", startedAt: at("2026-10-22", "09:00") }),
        // 22:30 del miércoles en Santo Domingo, ya jueves en UTC: cuenta para el miércoles.
        session({ status: "completed", focusSeconds: 600, subjectId: "prog", startedAt: at("2026-10-21", "22:30") }),
        session({ status: "completed", focusSeconds: 900, subjectId: "calc", startedAt: at("2026-10-18", "10:00") }),
        session({ status: "active" }),
        session({ status: "cancelled", focusSeconds: null }),
      ],
      now,
      SD,
      1,
    );
    expect(summary.todaySeconds).toBe(1500);
    expect(summary.weekSeconds).toBe(2100);
    expect(summary.bySubject).toEqual([
      { subjectId: "calc", seconds: 1500 },
      { subjectId: "prog", seconds: 600 },
    ]);
  });
});

describe("plannedStudyMinutes", () => {
  it("cuenta solo bloques de estudio con hora", () => {
    const base: EventOccurrence = {
      key: "k",
      eventId: "e",
      title: "Bloque",
      kind: "study_block",
      subjectId: null,
      location: null,
      startsAt: at("2026-10-22", "15:00"),
      endsAt: at("2026-10-22", "16:30"),
      allDay: false,
      recurring: false,
    };
    expect(plannedStudyMinutes([base, { ...base, kind: "class" }, { ...base, allDay: true }])).toBe(90);
  });
});

describe("estimateAccuracy", () => {
  const task = (id: string, estimate: number | null, status: Task["status"] = "completed"): Task => ({
    id,
    subjectId: null,
    title: id,
    description: null,
    kind: "assignment",
    status,
    priority: "medium",
    dueAt: null,
    estimatedMinutes: estimate,
    difficulty: null,
    completedAt: status === "completed" ? "2026-10-20T12:00:00Z" : null,
  });

  it("no afirma tendencias con pocos datos", () => {
    const result = estimateAccuracy([task("a", 60), task("b", 30)], new Map([["a", 3600], ["b", 3600]]));
    expect(result.entries).toHaveLength(2);
    expect(result.medianRatio).toBeNull();
  });

  it("usa la mediana y omite tareas sin estimación, sin tiempo o sin terminar", () => {
    const tasks = [task("a", 60), task("b", 60), task("c", 60), task("d", null), task("e", 60, "pending"), task("f", 60)];
    const focus = new Map([
      ["a", 60 * 60],
      ["b", 90 * 60],
      ["c", 600 * 60],
      ["d", 60 * 60],
      ["e", 60 * 60],
    ]);
    const result = estimateAccuracy(tasks, focus);
    expect(result.entries.map((e) => e.task.id).sort()).toEqual(["a", "b", "c"]);
    expect(result.medianRatio).toBe(1.5);
  });

  it("describe la proporción en español", () => {
    expect(describeRatio(1.05)).toBe("más o menos lo que estimas");
    // es-DO usa punto decimal.
    expect(describeRatio(1.5)).toBe("1.5 veces lo que estimas");
    expect(describeRatio(0.7)).toBe("el 70 % de lo que estimas");
  });
});
