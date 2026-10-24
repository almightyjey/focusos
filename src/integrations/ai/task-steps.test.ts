import { describe, expect, it } from "vitest";

import { createFakeProvider } from "@/integrations/ai/fake";
import {
  buildTaskStepsRequest,
  formatStepsChecklist,
  parseTaskSteps,
  TASK_STEPS_SCHEMA_NAME,
  type TaskStepsInput,
} from "@/integrations/ai/task-steps";

const task: TaskStepsInput = {
  title: "Práctica 3 de Programación",
  description: "Implementar una pila con arreglos.",
  kindLabel: "Asignación",
  subjectName: "Programación",
  dueLabel: "viernes, 30 de octubre, 23:59",
  estimatedMinutes: 90,
  difficulty: 3,
};

describe("petición para dividir en pasos", () => {
  it("incluye solo los datos de la tarea, delimitados", () => {
    const request = buildTaskStepsRequest(task);
    expect(request.jsonSchema?.name).toBe(TASK_STEPS_SCHEMA_NAME);
    expect(request.messages).toHaveLength(1);
    const content = request.messages[0]!.content;
    expect(content).toContain("<tarea>");
    expect(content).toContain("Título: Práctica 3 de Programación");
    expect(content).toContain("Materia: Programación");
    expect(content).toContain("Estimación: 1 h 30 min");
    expect(content).toContain("Dificultad: 3 de 5");
    expect(request.system).toContain("No inventes fechas");
  });

  it("omite los datos que faltan y recorta descripciones largas", () => {
    const request = buildTaskStepsRequest({
      ...task,
      subjectName: null,
      dueLabel: null,
      estimatedMinutes: null,
      difficulty: null,
      description: "x".repeat(5000),
    });
    const content = request.messages[0]!.content;
    expect(content).not.toContain("Materia:");
    expect(content).not.toContain("Fecha límite:");
    expect(content.length).toBeLessThan(2300);
  });

  it("el esquema JSON es compatible con el modo estricto de ambos proveedores", () => {
    const schema = buildTaskStepsRequest(task).jsonSchema!.schema as {
      additionalProperties: boolean;
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required.sort()).toEqual(Object.keys(schema.properties).sort());
  });
});

describe("respuesta del modelo", () => {
  it("acepta una respuesta válida", () => {
    const parsed = parseTaskSteps(
      JSON.stringify({ steps: [{ title: "Leer el enunciado", minutes: 10 }], notes: "Ojo con el caso vacío." }),
    );
    expect(parsed).toEqual({ steps: [{ title: "Leer el enunciado", minutes: 10 }], notes: "Ojo con el caso vacío." });
  });

  it("ajusta lo que es seguro ajustar", () => {
    const steps = Array.from({ length: 12 }, (_, i) => ({ title: `  Paso   ${i + 1} `, minutes: i === 0 ? 2.4 : 999 }));
    const parsed = parseTaskSteps(JSON.stringify({ steps: [...steps, { title: "   ", minutes: 10 }] }));
    expect(parsed.steps).toHaveLength(8);
    expect(parsed.steps[0]).toEqual({ title: "Paso 1", minutes: 5 });
    expect(parsed.steps[1]!.minutes).toBe(240);
    expect(parsed.notes).toBe("");
  });

  it.each([
    ["texto que no es JSON", "no es json"],
    ["sin pasos", JSON.stringify({ steps: [], notes: "" })],
    ["solo pasos vacíos", JSON.stringify({ steps: [{ title: " ", minutes: 10 }], notes: "" })],
    ["tipos incorrectos", JSON.stringify({ steps: [{ title: 3, minutes: "diez" }], notes: "" })],
  ])("rechaza %s", (_, text) => {
    expect(() => parseTaskSteps(text)).toThrow(expect.objectContaining({ code: "bad_response" }));
  });

  it("el proveedor de prueba produce una respuesta válida", async () => {
    const result = await createFakeProvider().generate(buildTaskStepsRequest(task));
    expect(parseTaskSteps(result.text).steps.length).toBeGreaterThan(0);
  });

  it("da formato de lista de verificación", () => {
    expect(
      formatStepsChecklist([
        { title: "Leer", minutes: 10 },
        { title: "Resolver", minutes: 75 },
      ]),
    ).toBe("Pasos sugeridos:\n- [ ] Leer (10 min)\n- [ ] Resolver (1 h 15 min)");
  });
});
