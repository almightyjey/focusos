import { describe, expect, it } from "vitest";

import { safeRedirectPath, signUpSchema } from "@/schemas/auth";
import { NONE } from "@/schemas/common";
import { profileFormSchema } from "@/schemas/profile";
import { subjectFormSchema } from "@/schemas/subject";
import { taskFormSchema, type TaskFormInput } from "@/schemas/task";
import { taskValuesToRow } from "@/server/services/tasks";

const baseTask: TaskFormInput = {
  title: "  Problemas de límites  ",
  description: "",
  subjectId: NONE,
  kind: "assignment",
  priority: "high",
  dueDate: "2026-10-23",
  dueTime: "",
  estimatedMinutes: "90",
  difficulty: "3",
};

describe("taskFormSchema", () => {
  it("normaliza los valores del formulario", () => {
    const values = taskFormSchema.parse(baseTask);
    expect(values).toMatchObject({
      title: "Problemas de límites",
      description: null,
      subjectId: null,
      estimatedMinutes: 90,
      difficulty: 3,
    });
  });

  it("rechaza título vacío, minutos no enteros y hora sin fecha", () => {
    const result = taskFormSchema.safeParse({
      ...baseTask,
      title: "   ",
      estimatedMinutes: "1.5",
      dueDate: "",
      dueTime: "10:00",
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["title", "estimatedMinutes", "dueDate"]));
  });

  it("rechaza identificadores de materia que no son UUID", () => {
    expect(taskFormSchema.safeParse({ ...baseTask, subjectId: "1; drop table" }).success).toBe(false);
  });
});

describe("taskValuesToRow", () => {
  it("guarda la fecha límite como instante UTC usando la zona del usuario", () => {
    const row = taskValuesToRow(taskFormSchema.parse(baseTask), "America/Santo_Domingo");
    // Sin hora: vence a las 23:59 locales (UTC-4).
    expect(row.due_at).toBe("2026-10-24T03:59:00.000Z");
  });

  it("no inventa fecha cuando no se indica", () => {
    const row = taskValuesToRow(taskFormSchema.parse({ ...baseTask, dueDate: "" }), "America/Santo_Domingo");
    expect(row.due_at).toBeNull();
  });
});

describe("subjectFormSchema", () => {
  it("valida color hexadecimal y prioridad", () => {
    expect(subjectFormSchema.safeParse({ name: "Cálculo", code: "", color: "#2B4ACB", priority: "high" }).success).toBe(true);
    expect(subjectFormSchema.safeParse({ name: "Cálculo", code: "", color: "red", priority: "high" }).success).toBe(false);
    expect(subjectFormSchema.safeParse({ name: "Cálculo", code: "", color: "#2B4ACB", priority: "max" }).success).toBe(false);
  });
});

describe("profileFormSchema", () => {
  const profile = {
    displayName: "",
    timezone: "America/Santo_Domingo",
    weekStartsOn: "1" as const,
    studyStart: "08:00",
    studyEnd: "22:00",
  };

  it("acepta zonas IANA válidas y rechaza inventadas", () => {
    expect(profileFormSchema.parse(profile)).toEqual({
      displayName: null,
      timezone: "America/Santo_Domingo",
      weekStartsOn: 1,
      studyStart: 480,
      studyEnd: 1320,
    });
    expect(profileFormSchema.safeParse({ ...profile, timezone: "Mars/Base" }).success).toBe(false);
  });

  it("exige que el horario de estudio termine después de empezar", () => {
    const result = profileFormSchema.safeParse({ ...profile, studyStart: "22:00", studyEnd: "08:00" });
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual(["studyEnd"]);
    expect(profileFormSchema.parse({ ...profile, studyEnd: "24:00" }).studyEnd).toBe(1440);
  });
});

describe("signUpSchema", () => {
  it("normaliza el correo y descarta zonas horarias no válidas", () => {
    const values = signUpSchema.parse({
      displayName: "",
      email: "  Ana@Example.COM ",
      password: "suficiente",
      timezone: "Nope/Nope",
    });
    expect(values.email).toBe("ana@example.com");
    expect(values.timezone).toBeUndefined();
  });
});

describe("safeRedirectPath", () => {
  it("solo permite rutas internas", () => {
    expect(safeRedirectPath("/tasks?view=completed")).toBe("/tasks?view=completed");
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.example")).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
  });
});
