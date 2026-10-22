import { describe, expect, it } from "vitest";

import { finishSessionSchema, manualSessionSchema, startSessionSchema } from "@/schemas/session";

const TASK = "11111111-1111-4111-8111-111111111111";

describe("esquemas de sesiones", () => {
  it("interpreta el objetivo de estudio", () => {
    expect(startSessionSchema.parse({ target: `task:${TASK}`, plannedMinutes: "25" })).toEqual({
      target: { taskId: TASK, subjectId: null },
      plannedMinutes: 25,
    });
    expect(startSessionSchema.parse({ target: "none", plannedMinutes: "" }).plannedMinutes).toBeNull();
    expect(startSessionSchema.safeParse({ target: "task:abc", plannedMinutes: "25" }).success).toBe(false);
    expect(startSessionSchema.safeParse({ target: `event:${TASK}`, plannedMinutes: "25" }).success).toBe(false);
  });

  it("limita la duración objetivo y manual", () => {
    expect(startSessionSchema.safeParse({ target: "none", plannedMinutes: "0" }).success).toBe(false);
    expect(startSessionSchema.safeParse({ target: "none", plannedMinutes: "481" }).success).toBe(false);
    const manual = { target: "none", date: "2026-10-22", startTime: "09:00", minutes: "45", notes: "" };
    expect(manualSessionSchema.parse(manual).minutes).toBe(45);
    expect(manualSessionSchema.safeParse({ ...manual, minutes: "721" }).success).toBe(false);
    expect(manualSessionSchema.safeParse({ ...manual, minutes: "1.5" }).success).toBe(false);
  });

  it("deja vacío el ajuste de minutos para registrar lo medido", () => {
    expect(finishSessionSchema.parse({ focusMinutes: "", notes: "", completeTask: false }).focusMinutes).toBeNull();
    expect(finishSessionSchema.parse({ focusMinutes: "30", notes: "", completeTask: true }).focusMinutes).toBe(30);
  });
});
