import { describe, expect, it } from "vitest";

import {
  buildTodayAgenda,
  compareOpenTasks,
  dueBucket,
  groupOpenTasksByDue,
  summarizeSubjects,
  weeklyProgress,
} from "@/domain/tasks";
import { upcomingAgenda } from "@/domain/agenda";
import type { Subject, Task } from "@/domain/types";

const TZ = "America/Santo_Domingo";
// Jueves 22 de octubre de 2026, 11:00 en Santo Domingo.
const NOW = new Date("2026-10-22T15:00:00Z");

let counter = 0;
function task(overrides: Partial<Task> = {}): Task {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    subjectId: null,
    title: `Tarea ${counter}`,
    description: null,
    kind: "assignment",
    status: "pending",
    priority: "medium",
    dueAt: null,
    estimatedMinutes: null,
    difficulty: null,
    completedAt: null,
    ...overrides,
  };
}

function subject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Cálculo Diferencial",
    code: null,
    color: "#2B4ACB",
    priority: "high",
    credits: null,
    instructor: null,
    isArchived: false,
    ...overrides,
  };
}

describe("dueBucket", () => {
  it("clasifica por cercanía en la zona del usuario", () => {
    expect(dueBucket(task({ dueAt: "2026-10-22T14:00:00Z" }), NOW, TZ)).toBe("overdue");
    expect(dueBucket(task({ dueAt: "2026-10-23T03:59:00Z" }), NOW, TZ)).toBe("today"); // 23:59 local
    expect(dueBucket(task({ dueAt: "2026-10-23T14:00:00Z" }), NOW, TZ)).toBe("tomorrow");
    expect(dueBucket(task({ dueAt: "2026-10-29T14:00:00Z" }), NOW, TZ)).toBe("this_week");
    expect(dueBucket(task({ dueAt: "2026-11-15T14:00:00Z" }), NOW, TZ)).toBe("later");
    expect(dueBucket(task(), NOW, TZ)).toBe("no_date");
  });
});

describe("compareOpenTasks", () => {
  it("ordena por fecha, luego prioridad y deja sin fecha al final", () => {
    const a = task({ title: "sin fecha" });
    const b = task({ title: "mañana media", dueAt: "2026-10-23T14:00:00Z" });
    const c = task({ title: "mañana urgente", dueAt: "2026-10-23T14:00:00Z", priority: "urgent" });
    const d = task({ title: "hoy", dueAt: "2026-10-22T20:00:00Z" });
    expect([a, b, c, d].sort(compareOpenTasks).map((t) => t.title)).toEqual([
      "hoy",
      "mañana urgente",
      "mañana media",
      "sin fecha",
    ]);
  });
});

describe("groupOpenTasksByDue", () => {
  it("omite completadas y grupos vacíos", () => {
    const groups = groupOpenTasksByDue(
      [
        task({ dueAt: "2026-10-23T03:59:00Z" }),
        task({ status: "completed", completedAt: "2026-10-22T12:00:00Z", dueAt: "2026-10-23T03:59:00Z" }),
        task(),
      ],
      NOW,
      TZ,
    );
    expect(groups.map((g) => [g.bucket, g.tasks.length])).toEqual([
      ["today", 1],
      ["no_date", 1],
    ]);
  });
});

describe("buildTodayAgenda", () => {
  it("separa vencidas, de hoy y hechas hoy, y no inventa estimaciones", () => {
    const agenda = buildTodayAgenda(
      [
        task({ title: "vencida", dueAt: "2026-10-21T14:00:00Z", estimatedMinutes: 30 }),
        task({ title: "hoy", dueAt: "2026-10-22T22:00:00Z", estimatedMinutes: 90 }),
        task({ title: "hoy sin estimar", dueAt: "2026-10-23T01:00:00Z" }),
        task({ title: "hecha", status: "completed", completedAt: "2026-10-22T13:00:00Z" }),
        task({ title: "hecha ayer", status: "completed", completedAt: "2026-10-21T13:00:00Z" }),
        task({ title: "siguiente", dueAt: "2026-10-25T14:00:00Z" }),
      ],
      NOW,
      TZ,
    );
    expect(agenda.overdue.map((t) => t.title)).toEqual(["vencida"]);
    expect(agenda.today.map((t) => t.title)).toEqual(["hoy", "hoy sin estimar"]);
    expect(agenda.completedToday.map((t) => t.title)).toEqual(["hecha"]);
    expect(agenda.estimatedMinutes).toBe(120);
    expect(agenda.unestimatedCount).toBe(1);
    expect(agenda.nextUp?.title).toBe("siguiente");
  });
});

describe("upcomingAgenda con tareas", () => {
  it("agrupa los próximos 7 días por día local, sin incluir hoy", () => {
    const days = upcomingAgenda(
      [
        task({ dueAt: "2026-10-23T03:59:00Z" }), // hoy 23:59
        task({ dueAt: "2026-10-23T14:00:00Z" }), // mañana
        task({ dueAt: "2026-10-24T02:00:00Z" }), // mañana 22:00 local
        task({ dueAt: "2026-10-29T14:00:00Z" }), // +7
        task({ dueAt: "2026-10-30T14:00:00Z" }), // +8, fuera
        task({ dueAt: "2026-10-24T14:00:00Z", status: "completed", completedAt: "2026-10-22T12:00:00Z" }),
      ],
      [],
      NOW,
      TZ,
    );
    expect(days.map((d) => [d.dayKey, d.items.length])).toEqual([
      ["2026-10-23", 2],
      ["2026-10-29", 1],
    ]);
  });
});

describe("weeklyProgress", () => {
  it("cuenta entregas de la semana (lunes a domingo) y completadas", () => {
    const progress = weeklyProgress(
      [
        task({ dueAt: "2026-10-20T14:00:00Z", status: "completed", completedAt: "2026-10-20T12:00:00Z" }),
        task({ dueAt: "2026-10-24T14:00:00Z" }),
        task({ dueAt: "2026-10-26T14:00:00Z" }), // lunes siguiente
        task({ dueAt: "2026-10-21T14:00:00Z", status: "cancelled" }),
        task({ dueAt: "2026-10-10T14:00:00Z", status: "completed", completedAt: "2026-10-22T12:00:00Z" }),
      ],
      NOW,
      TZ,
      1,
    );
    expect(progress).toEqual({
      weekStartKey: "2026-10-19",
      weekEndKey: "2026-10-25",
      dueThisWeek: 2,
      dueThisWeekCompleted: 1,
      completedThisWeek: 2,
    });
  });
});

describe("summarizeSubjects", () => {
  it("resume pendientes y vencidas por materia y omite archivadas", () => {
    const calc = subject();
    const archived = subject({ id: "22222222-2222-4222-8222-222222222222", name: "Vieja", isArchived: true });
    const summaries = summarizeSubjects(
      [calc, archived],
      [
        task({ subjectId: calc.id, dueAt: "2026-10-21T14:00:00Z" }),
        task({ subjectId: calc.id, dueAt: "2026-10-25T14:00:00Z" }),
        task({ subjectId: calc.id, status: "completed", completedAt: "2026-10-20T12:00:00Z" }),
      ],
      NOW,
    );
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ openCount: 2, overdueCount: 1 });
    expect(summaries[0].nextDue?.dueAt).toBe("2026-10-21T14:00:00Z");
  });
});
