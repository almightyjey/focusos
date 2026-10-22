import { describe, expect, it } from "vitest";

import { todaySchedule, upcomingAgenda } from "@/domain/agenda";
import { zonedInputToUtc } from "@/domain/datetime";
import { expandOccurrences, layoutDay, occurrencesByDay, visibleHours, type EventOccurrence } from "@/domain/events";
import type { ScheduleEvent, Task } from "@/domain/types";

const SD = "America/Santo_Domingo";
const NY = "America/New_York";

function event(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: "e1",
    subjectId: null,
    title: "Cálculo",
    kind: "class",
    startsAt: zonedInputToUtc("2026-10-19", "10:00", SD).toISOString(),
    endsAt: zonedInputToUtc("2026-10-19", "11:30", SD).toISOString(),
    allDay: false,
    location: null,
    notes: null,
    recurrenceRule: null,
    timezone: SD,
    ...overrides,
  };
}

const local = (date: string, time: string, tz = SD) => zonedInputToUtc(date, time, tz).toISOString();

describe("expandOccurrences", () => {
  const week = { start: local("2026-10-19", "00:00"), end: local("2026-10-26", "00:00") };

  it("incluye eventos únicos que se solapan con el rango", () => {
    const inside = event();
    const outside = event({ id: "e2", startsAt: local("2026-10-27", "10:00"), endsAt: local("2026-10-27", "11:00") });
    const result = expandOccurrences([inside, outside], week.start, week.end, SD);
    expect(result.map((o) => o.eventId)).toEqual(["e1"]);
    expect(result[0].recurring).toBe(false);
  });

  it("repite clases semanales solo en los días indicados y desde su inicio", () => {
    const series = event({ recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,WE" });
    const result = expandOccurrences([series], local("2026-10-12", "00:00"), local("2026-11-02", "00:00"), SD);
    expect(result.map((o) => o.key)).toEqual(["e1:2026-10-19", "e1:2026-10-21", "e1:2026-10-26", "e1:2026-10-28"]);
    expect(result[1].startsAt).toBe(local("2026-10-21", "10:00"));
    expect(Date.parse(result[1].endsAt) - Date.parse(result[1].startsAt)).toBe(90 * 60_000);
  });

  it("respeta la fecha de fin de la serie", () => {
    const series = event({ recurrenceRule: "FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261021" });
    const result = expandOccurrences([series], week.start, local("2026-11-30", "00:00"), SD);
    expect(result.map((o) => o.key)).toEqual(["e1:2026-10-19", "e1:2026-10-21"]);
  });

  it("mantiene la hora local al cambiar el horario de verano", () => {
    const series = event({
      timezone: NY,
      startsAt: local("2026-10-26", "10:00", NY),
      endsAt: local("2026-10-26", "11:00", NY),
      recurrenceRule: "FREQ=WEEKLY;BYDAY=MO",
    });
    const result = expandOccurrences([series], local("2026-10-26", "00:00", NY), local("2026-11-10", "00:00", NY), NY);
    // En Nueva York el horario de verano termina el 1 de noviembre de 2026.
    expect(result.map((o) => o.startsAt)).toEqual(["2026-10-26T14:00:00.000Z", "2026-11-02T15:00:00.000Z", "2026-11-09T15:00:00.000Z"]);
  });

  it("trata reglas no soportadas como eventos únicos", () => {
    const odd = event({ recurrenceRule: "FREQ=DAILY;COUNT=5" });
    expect(expandOccurrences([odd], week.start, week.end, SD).map((o) => o.recurring)).toEqual([false]);
  });
});

function occ(overrides: Partial<EventOccurrence>): EventOccurrence {
  return {
    key: "k",
    eventId: "e",
    title: "Evento",
    kind: "class",
    subjectId: null,
    location: null,
    startsAt: local("2026-10-19", "10:00"),
    endsAt: local("2026-10-19", "11:00"),
    allDay: false,
    recurring: false,
    ...overrides,
  };
}

describe("occurrencesByDay", () => {
  it("coloca eventos de todo el día en cada día que cubren", () => {
    const allDay = occ({ key: "a", allDay: true, startsAt: local("2026-10-19", "00:00"), endsAt: local("2026-10-21", "00:00") });
    const byDay = occurrencesByDay([allDay], ["2026-10-19", "2026-10-20", "2026-10-21"], SD);
    expect([...byDay.values()].map((list) => list.length)).toEqual([1, 1, 0]);
  });
});

describe("layoutDay", () => {
  it("pone lado a lado los eventos que se solapan", () => {
    const items = layoutDay(
      [
        occ({ key: "a", startsAt: local("2026-10-19", "10:00"), endsAt: local("2026-10-19", "11:00") }),
        occ({ key: "b", startsAt: local("2026-10-19", "10:30"), endsAt: local("2026-10-19", "12:00") }),
        occ({ key: "c", startsAt: local("2026-10-19", "13:00"), endsAt: local("2026-10-19", "14:00") }),
      ],
      "2026-10-19",
      SD,
    );
    expect(items.map((i) => [i.occurrence.key, i.column, i.columns, i.startMinute, i.endMinute])).toEqual([
      ["a", 0, 2, 600, 660],
      ["b", 1, 2, 630, 720],
      ["c", 0, 1, 780, 840],
    ]);
    expect(visibleHours(items)).toEqual({ start: 7, end: 21 });
  });

  it("amplía las horas visibles y corta lo que pasa de medianoche", () => {
    const items = layoutDay(
      [occ({ startsAt: local("2026-10-19", "06:15"), endsAt: local("2026-10-20", "01:00") })],
      "2026-10-19",
      SD,
    );
    expect(items[0].endMinute).toBe(24 * 60);
    expect(visibleHours(items)).toEqual({ start: 6, end: 24 });
  });
});

describe("agenda del dashboard", () => {
  const now = new Date(local("2026-10-22", "11:00"));
  const task: Task = {
    id: "t1",
    subjectId: null,
    title: "Informe",
    description: null,
    kind: "lab",
    status: "pending",
    priority: "high",
    dueAt: local("2026-10-23", "23:59"),
    estimatedMinutes: null,
    difficulty: null,
    completedAt: null,
  };

  it("mezcla entregas y exámenes, con los exámenes primero en su día", () => {
    const exam = occ({ key: "x", kind: "exam", title: "Parcial", startsAt: local("2026-10-23", "08:00"), endsAt: local("2026-10-23", "10:00") });
    const klass = occ({ key: "c", kind: "class", startsAt: local("2026-10-23", "07:00"), endsAt: local("2026-10-23", "08:00") });
    const days = upcomingAgenda([task], [exam, klass], now, SD);
    expect(days).toHaveLength(1);
    expect(days[0].items.map((i) => `${i.type}:${i.title}`)).toEqual(["exam:Parcial", "task:Informe"]);
  });

  it("devuelve el horario de hoy", () => {
    const today = occ({ key: "hoy", startsAt: local("2026-10-22", "14:00"), endsAt: local("2026-10-22", "15:00") });
    const tomorrow = occ({ key: "mañana", startsAt: local("2026-10-23", "14:00"), endsAt: local("2026-10-23", "15:00") });
    expect(todaySchedule([today, tomorrow], now, SD).map((o) => o.key)).toEqual(["hoy"]);
  });
});
