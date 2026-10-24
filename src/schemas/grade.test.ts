import { describe, expect, it } from "vitest";

import { gradeItemFormSchema, type GradeItemFormInput } from "@/schemas/grade";

const base: GradeItemFormInput = {
  title: "Primer parcial",
  category: "exam",
  score: "",
  maxScore: "",
  weight: "",
  dueDate: "",
  notes: "",
};

describe("gradeItemFormSchema", () => {
  it("deja como desconocido lo que no se escribe", () => {
    expect(gradeItemFormSchema.parse(base)).toMatchObject({ score: null, maxScore: null, weight: null, notes: null });
  });

  it("acepta coma o punto decimal", () => {
    expect(gradeItemFormSchema.parse({ ...base, score: "17,5", maxScore: "20", weight: "12.5" })).toMatchObject({
      score: 17.5,
      maxScore: 20,
      weight: 12.5,
    });
  });

  it("valida rangos", () => {
    const issues = (input: Partial<GradeItemFormInput>) =>
      gradeItemFormSchema.safeParse({ ...base, ...input }).error?.issues.map((i) => i.path.join("."));
    expect(issues({ weight: "120" })).toEqual(["weight"]);
    expect(issues({ weight: "0" })).toEqual(["weight"]);
    expect(issues({ maxScore: "0" })).toEqual(["maxScore"]);
    expect(issues({ score: "abc" })).toEqual(["score"]);
    expect(issues({ title: " " })).toEqual(["title"]);
  });
});
