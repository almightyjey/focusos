import { describe, expect, it } from "vitest";

import { NONE } from "@/schemas/common";
import { eventFormSchema, type EventFormInput } from "@/schemas/event";
import { eventValuesToRow } from "@/server/services/events";

const SD = "America/Santo_Domingo";

const base: EventFormInput = {
  title: "Cálculo Diferencial",
  kind: "class",
  subjectId: NONE,
  date: "2026-10-22",
  allDay: false,
  startTime: "10:00",
  endTime: "11:30",
  location: "",
  notes: "",
  repeat: "none",
  repeatDays: [],
  repeatUntil: "",
};

describe("eventFormSchema", () => {
  it("exige horas coherentes salvo en eventos de todo el día", () => {
    expect(eventFormSchema.safeParse(base).success).toBe(true);
    const backwards = eventFormSchema.safeParse({ ...base, endTime: "09:00" });
    expect(backwards.error?.issues.map((i) => i.path.join("."))).toEqual(["endTime"]);
    expect(eventFormSchema.safeParse({ ...base, allDay: true, startTime: "", endTime: "" }).success).toBe(true);
  });

  it("valida la repetición semanal", () => {
    const noDays = eventFormSchema.safeParse({ ...base, repeat: "weekly" });
    expect(noDays.error?.issues.map((i) => i.path.join("."))).toEqual(["repeatDays"]);
    const before = eventFormSchema.safeParse({ ...base, repeat: "weekly", repeatDays: [1], repeatUntil: "2026-10-01" });
    expect(before.error?.issues.map((i) => i.path.join("."))).toEqual(["repeatUntil"]);
    const tooLong = eventFormSchema.safeParse({ ...base, repeat: "weekly", repeatDays: [1], repeatUntil: "2028-01-01" });
    expect(tooLong.success).toBe(false);
  });
});

describe("eventValuesToRow", () => {
  it("guarda un evento único en UTC con la zona del usuario", () => {
    const row = eventValuesToRow(eventFormSchema.parse(base), SD);
    expect(row).toMatchObject({
      starts_at: "2026-10-22T14:00:00.000Z",
      ends_at: "2026-10-22T15:30:00.000Z",
      recurrence_rule: null,
      timezone: SD,
    });
  });

  it("mueve el inicio de una serie a su primer día real", () => {
    // 2026-10-22 es jueves; la serie es lunes y miércoles.
    const row = eventValuesToRow(
      eventFormSchema.parse({ ...base, repeat: "weekly", repeatDays: [3, 1], repeatUntil: "2026-12-11" }),
      SD,
    );
    expect(row.starts_at).toBe("2026-10-26T14:00:00.000Z");
    expect(row.recurrence_rule).toBe("FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261211");
  });

  it("guarda los eventos de todo el día de medianoche a medianoche local", () => {
    const row = eventValuesToRow(eventFormSchema.parse({ ...base, allDay: true, kind: "exam" }), SD);
    expect(row).toMatchObject({ starts_at: "2026-10-22T04:00:00.000Z", ends_at: "2026-10-23T04:00:00.000Z", all_day: true });
  });

  it("rechaza una serie sin ningún día dentro de su rango", () => {
    // Del jueves 22 al viernes 23 no hay ningún lunes.
    const values = eventFormSchema.parse({ ...base, repeat: "weekly", repeatDays: [1], repeatUntil: "2026-10-23" });
    expect(() => eventValuesToRow(values, SD)).toThrow(/ningún día/);
  });
});
