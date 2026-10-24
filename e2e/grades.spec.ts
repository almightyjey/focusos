import { expect, test, type Page } from "@playwright/test";

import { hasTestUser, signIn } from "./support/auth";

/**
 * Fase 7: evaluaciones con nota, máxima y ponderación; promedio solo con datos
 * completos; nota necesaria; resumen en /grades.
 */

test.skip(!hasTestUser, "Faltan E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD en .env.test.local");

async function addEvaluation(
  page: Page,
  values: { title: string; category?: string; score?: string; max?: string; weight?: string },
) {
  await page.getByRole("button", { name: "Nueva evaluación" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Evaluación").fill(values.title);
  if (values.category) {
    await dialog.getByRole("combobox", { name: "Tipo" }).click();
    await page.getByRole("option", { name: values.category }).click();
  }
  await dialog.getByLabel("Nota", { exact: true }).fill(values.score ?? "");
  await dialog.getByLabel("Sobre").fill(values.max ?? "100");
  await dialog.getByLabel("Pondera (%)").fill(values.weight ?? "");
  await dialog.getByRole("button", { name: "Crear evaluación" }).click();
  await expect(dialog).toBeHidden();
}

test("calificaciones de una materia", async ({ page }) => {
  const subjectName = `E2E Notas ${Date.now()}`;
  await signIn(page, "/subjects");

  await page.getByRole("button", { name: "Nueva materia" }).first().click();
  await page.getByRole("dialog").getByLabel("Nombre").fill(subjectName);
  await page.getByRole("dialog").getByRole("button", { name: "Crear materia" }).click();
  await page.getByRole("link", { name: subjectName }).click();
  await expect(page.getByRole("heading", { level: 1, name: subjectName })).toBeVisible();
  // Next conserva la página anterior oculta (Activity): se filtra por lo visible.
  await expect(page.getByText("Sin evaluaciones registradas").filter({ visible: true })).toBeVisible();

  // La validación rechaza ponderaciones fuera de rango
  await page.getByRole("button", { name: "Nueva evaluación" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Evaluación").fill("Inválida");
  await dialog.getByLabel("Pondera (%)").fill("120");
  await dialog.getByRole("button", { name: "Crear evaluación" }).click();
  await expect(dialog).toContainText("La ponderación va de 0 a 100 %");
  await dialog.getByRole("button", { name: "Cancelar" }).click();

  await addEvaluation(page, { title: "Parcial 1", score: "85", weight: "25" });
  await addEvaluation(page, { title: "Tareas", category: "Tarea", score: "18", max: "20", weight: "15" });
  await addEvaluation(page, { title: "Final", weight: "30" });

  // (85 % × 25 + 90 % × 15) / 40 = 86.875
  await expect(page.getByTestId("current-average")).toHaveText("86.9");
  await expect(page.getByTestId("grade-summary")).toContainText("Evaluado el 40 % de la nota; queda el 60 %.");
  await expect(page.getByTestId("grade-summary")).toContainText("Solo has definido el 70 %");

  const target = page.getByLabel("¿Qué nota final buscas?");
  const result = page.getByTestId("needed-result");
  await target.fill("80");
  await expect(result).toContainText("Necesitas un promedio de 75.4 en el 60 % que queda");
  await target.fill("99");
  await expect(result).toContainText("No alcanza");
  await target.fill("30");
  await expect(result).toContainText("asegurada");

  // Una nota sin ponderación impide calcular el promedio
  await addEvaluation(page, { title: "Quiz", category: "Prueba corta", score: "8", max: "10" });
  await expect(page.getByText("No se puede calcular el promedio todavía.")).toBeVisible();
  await expect(page.getByText("Quiz: falta ponderación.")).toBeVisible();
  await expect(page.getByTestId("current-average")).toHaveCount(0);

  await page.goto("/grades");
  const row = page.getByTestId("grades-row").filter({ hasText: subjectName });
  await expect(row).toContainText("Faltan datos en 1 evaluación");
  await expect(row).toContainText("Sin nota");

  // Completar el dato faltante recalcula: (21.25 + 13.5 + 8) / 50 = 85.5
  await row.getByRole("link").click();
  const quiz = page.getByTestId("grade-item").filter({ hasText: "Quiz" });
  await quiz.getByRole("button", { name: "Acciones para Quiz" }).click();
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await page.getByRole("dialog").getByLabel("Pondera (%)").fill("10");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByTestId("current-average")).toHaveText("85.5");

  // Borrar con confirmación
  await quiz.getByRole("button", { name: "Acciones para Quiz" }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar evaluación" }).click();
  await expect(quiz).toHaveCount(0);
  await expect(page.getByTestId("current-average")).toHaveText("86.9");

  // Limpieza: borrar la materia borra sus evaluaciones
  await page.goto("/subjects");
  await page.getByRole("button", { name: `Acciones para ${subjectName}` }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar materia" }).click();
  await expect(page.getByRole("link", { name: subjectName })).toHaveCount(0);
});

test("una materia ajena o inexistente muestra la página de no encontrado", async ({ page }) => {
  await signIn(page, "/grades");
  // Con streaming el estado HTTP ya se envió con el shell; se comprueba el contenido.
  await page.goto("/subjects/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Calificaciones" })).toHaveCount(0);
});
