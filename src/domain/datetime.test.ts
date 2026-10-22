import { describe, expect, it } from "vitest";

import {
  addDaysToKey,
  dayKey,
  daysBetweenKeys,
  formatDueLabel,
  formatMinutes,
  isValidDateInput,
  isValidTimeZone,
  startOfWeekKey,
  utcToZonedInput,
  zonedInputToUtc,
} from "@/domain/datetime";

const SD = "America/Santo_Domingo"; // UTC-4 todo el año
const NY = "America/New_York"; // con horario de verano

describe("zonedInputToUtc", () => {
  it("convierte la hora local de Santo Domingo a UTC", () => {
    expect(zonedInputToUtc("2026-10-22", "23:59", SD).toISOString()).toBe("2026-10-23T03:59:00.000Z");
  });

  it("respeta el horario de verano", () => {
    expect(zonedInputToUtc("2026-07-01", "09:00", NY).toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedInputToUtc("2026-12-01", "09:00", NY).toISOString()).toBe("2026-12-01T14:00:00.000Z");
  });

  it("rechaza fechas y horas imposibles", () => {
    expect(() => zonedInputToUtc("2026-02-30", "10:00", SD)).toThrow(RangeError);
    expect(() => zonedInputToUtc("2026-02-10", "24:00", SD)).toThrow(RangeError);
  });

  it("es reversible con utcToZonedInput", () => {
    const instant = zonedInputToUtc("2026-03-15", "07:30", SD);
    expect(utcToZonedInput(instant, SD)).toEqual({ date: "2026-03-15", time: "07:30" });
  });
});

describe("dayKey", () => {
  it("usa el día local, no el día UTC", () => {
    // 02:00 UTC del 23 son las 22:00 del 22 en Santo Domingo.
    expect(dayKey("2026-10-23T02:00:00Z", SD)).toBe("2026-10-22");
    expect(dayKey("2026-10-23T02:00:00Z", "Europe/Madrid")).toBe("2026-10-23");
  });
});

describe("aritmética de días", () => {
  it("suma días cruzando meses y años", () => {
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("calcula el inicio de semana según la preferencia", () => {
    // 2026-10-22 es jueves.
    expect(startOfWeekKey("2026-10-22", 1)).toBe("2026-10-19");
    expect(startOfWeekKey("2026-10-22", 0)).toBe("2026-10-18");
    expect(startOfWeekKey("2026-10-19", 1)).toBe("2026-10-19");
  });

  it("cuenta días entre fechas", () => {
    expect(daysBetweenKeys("2026-10-22", "2026-10-29")).toBe(7);
    expect(daysBetweenKeys("2026-10-22", "2026-10-21")).toBe(-1);
  });
});

describe("formatDueLabel", () => {
  const now = new Date("2026-10-22T15:00:00Z"); // 11:00 en Santo Domingo

  it("usa Hoy, Mañana y Ayer", () => {
    expect(formatDueLabel("2026-10-23T03:59:00Z", now, SD)).toBe("Hoy, 23:59");
    expect(formatDueLabel("2026-10-23T14:00:00Z", now, SD)).toBe("Mañana, 10:00");
    expect(formatDueLabel("2026-10-21T14:00:00Z", now, SD)).toBe("Ayer, 10:00");
  });

  it("muestra la fecha corta para días más lejanos", () => {
    expect(formatDueLabel("2026-10-30T14:00:00Z", now, SD)).toMatch(/30.*oct.*10:00/);
  });
});

describe("validaciones", () => {
  it("valida zonas IANA", () => {
    expect(isValidTimeZone(SD)).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });

  it("valida fechas de calendario", () => {
    expect(isValidDateInput("2028-02-29")).toBe(true);
    expect(isValidDateInput("2026-02-29")).toBe(false);
    expect(isValidDateInput("22/10/2026")).toBe(false);
  });
});

describe("formatMinutes", () => {
  it("formatea duraciones", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(150)).toBe("2 h 30 min");
  });
});
