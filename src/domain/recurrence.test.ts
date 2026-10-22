import { describe, expect, it } from "vitest";

import {
  buildWeeklyRule,
  describeWeeklyRule,
  firstWeekdayOnOrAfter,
  parseWeeklyRule,
  weeklyOccurrenceDays,
} from "@/domain/recurrence";

describe("reglas semanales", () => {
  it("construye y lee la misma regla", () => {
    const rule = buildWeeklyRule([3, 1, 1], "2026-12-15");
    expect(rule).toBe("FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261215");
    expect(parseWeeklyRule(rule)).toEqual({ byDay: [1, 3], until: "2026-12-15" });
    expect(parseWeeklyRule("FREQ=WEEKLY;BYDAY=FR")).toEqual({ byDay: [5], until: null });
  });

  it("rechaza lo que aún no se soporta en lugar de interpretarlo mal", () => {
    expect(parseWeeklyRule("FREQ=DAILY")).toBeNull();
    expect(parseWeeklyRule("FREQ=WEEKLY;BYDAY=MO;INTERVAL=2")).toBeNull();
    expect(parseWeeklyRule("FREQ=WEEKLY;BYDAY=XX")).toBeNull();
    expect(parseWeeklyRule("FREQ=WEEKLY;BYDAY=MO;UNTIL=20260231")).toBeNull();
    expect(() => buildWeeklyRule([], null)).toThrow(RangeError);
  });

  it("encuentra el primer día válido de la serie", () => {
    // 2026-10-22 es jueves.
    expect(firstWeekdayOnOrAfter("2026-10-22", [4])).toBe("2026-10-22");
    expect(firstWeekdayOnOrAfter("2026-10-22", [1, 3])).toBe("2026-10-26");
  });

  it("genera los días dentro del rango, desde el inicio y hasta el fin", () => {
    const rule = { byDay: [1, 3], until: "2026-11-02" };
    expect(weeklyOccurrenceDays("2026-10-21", rule, "2026-10-01", "2026-11-30")).toEqual([
      "2026-10-21",
      "2026-10-26",
      "2026-10-28",
      "2026-11-02",
    ]);
  });

  it("describe la regla en español", () => {
    expect(describeWeeklyRule({ byDay: [1, 3, 5], until: null })).toBe("Cada semana: lun, mié y vie");
    expect(describeWeeklyRule({ byDay: [2], until: "2026-12-15" })).toMatch(/^Cada semana: mar, hasta el 15 dic/);
  });
});
