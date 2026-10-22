import { describe, expect, it } from "vitest";

import {
  formatMonthTitle,
  formatWeekTitle,
  monthWeeks,
  parseAnchor,
  rangeToUtc,
  shiftAnchor,
  viewRange,
  weekDays,
} from "@/domain/calendar";

describe("rejilla del calendario", () => {
  it("arma la semana según el primer día elegido", () => {
    expect(weekDays("2026-10-22", 1)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
    expect(weekDays("2026-10-22", 0)[0]).toBe("2026-10-18");
  });

  it("cubre el mes con semanas completas", () => {
    const weeks = monthWeeks("2026-10-22", 1);
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toBe("2026-09-28");
    expect(weeks.at(-1)?.at(-1)).toBe("2026-11-01");
    // Febrero de 2027 empieza en lunes y cabe en 4 semanas.
    expect(monthWeeks("2027-02-10", 1)).toHaveLength(4);
    // Agosto de 2026 necesita 6 filas con semana de lunes a domingo.
    expect(monthWeeks("2026-08-15", 1)).toHaveLength(6);
  });

  it("calcula el rango y lo convierte a UTC en la zona del usuario", () => {
    const range = viewRange("week", "2026-10-22", 1);
    expect(range).toEqual({ startKey: "2026-10-19", endKey: "2026-10-25" });
    expect(rangeToUtc(range, "America/Santo_Domingo")).toEqual({
      startIso: "2026-10-19T04:00:00.000Z",
      endIso: "2026-10-26T04:00:00.000Z",
    });
  });

  it("navega por semanas y meses", () => {
    expect(shiftAnchor("week", "2026-10-22", 1)).toBe("2026-10-29");
    expect(shiftAnchor("month", "2026-10-22", -1)).toBe("2026-09-01");
    expect(shiftAnchor("month", "2026-12-31", 1)).toBe("2027-01-01");
  });

  it("ignora fechas inválidas en la URL", () => {
    expect(parseAnchor("2026-02-30", "2026-10-22")).toBe("2026-10-22");
    expect(parseAnchor(["2026-10-01"], "2026-10-22")).toBe("2026-10-22");
    expect(parseAnchor("2026-10-01", "2026-10-22")).toBe("2026-10-01");
  });

  it("titula semanas y meses en español", () => {
    expect(formatMonthTitle("2026-10-22")).toBe("Octubre de 2026");
    expect(formatWeekTitle(weekDays("2026-10-22", 1))).toBe("19 al 25 de octubre de 2026");
    expect(formatWeekTitle(weekDays("2026-10-01", 1))).toBe("28 de septiembre al 4 de octubre de 2026");
    expect(formatWeekTitle(weekDays("2026-12-31", 1))).toBe("28 de diciembre de 2026 al 3 de enero de 2027");
  });
});
