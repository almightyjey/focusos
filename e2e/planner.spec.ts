import { expect, test, type Page } from "@playwright/test";

import { hasTestUser, signIn } from "./support/auth";

/**
 * Fase 8: el motor ordena por vencimiento y prioridad, explica por qué,
 * planifica el día dentro del horario de estudio y permite empezar desde la
 * recomendación.
 */

test.skip(!hasTestUser, "Faltan E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD en .env.test.local");

async function setStudyWindow(page: Page, start: string, end: string) {
  await page.goto("/settings");
  await page.getByLabel("Empiezo a estudiar").fill(start);
  await page.getByLabel("Termino").fill(end);
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByText("Ajustes guardados")).toBeVisible();
}

async function createTask(
  page: Page,
  values: { title: string; priority: string; estimate: string; tomorrow?: boolean },
) {
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Qué hay que hacer").fill(values.title);
  await dialog.getByRole("combobox", { name: "Prioridad" }).click();
  await page.getByRole("option", { name: values.priority }).click();
  if (values.tomorrow) await dialog.getByRole("button", { name: "Mañana", exact: true }).click();
  await dialog.getByLabel("Estimación (min)").fill(values.estimate);
  await dialog.getByRole("button", { name: "Crear tarea" }).click();
  await expect(dialog).toBeHidden();
}

async function deleteTask(page: Page, title: string) {
  await page.goto("/tasks");
  const item = page.getByTestId("task-item").filter({ hasText: title }).filter({ visible: true });
  if ((await item.count()) === 0) return;
  await item.getByRole("button", { name: `Acciones para ${title}` }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar tarea" }).click();
  await expect(item).toHaveCount(0);
}

test("recomienda, explica y planifica", async ({ page }) => {
  const stamp = Date.now();
  const urgent = `E2E Plan alta ${stamp}`;
  const later = `E2E Plan baja ${stamp}`;

  await signIn(page, "/settings");
  // Todo el día disponible: el plan no depende de la hora a la que corra la prueba.
  await setStudyWindow(page, "00:00", "23:59");

  try {
    await createTask(page, { title: later, priority: "Baja", estimate: "30" });
    await createTask(page, { title: urgent, priority: "Alta", estimate: "60", tomorrow: true });

    await page.goto("/plan");
    const ranking = page.getByTestId("ranking-item").filter({ visible: true });
    await expect(ranking).toHaveCount(2);
    await expect(ranking.nth(0)).toHaveAttribute("data-task-title", urgent);
    await expect(ranking.nth(1)).toHaveAttribute("data-task-title", later);
    await expect(ranking.nth(0)).toContainText("Vence mañana");
    await expect(ranking.nth(0)).toContainText("Prioridad alta");

    // El detalle muestra el cálculo de la puntuación
    await ranking.nth(0).getByText("Puntuación").click();
    await expect(ranking.nth(0).getByRole("rowheader", { name: "Urgencia" })).toBeVisible();

    // El plan de hoy empieza por la tarea recomendada
    const blocks = page.getByTestId("plan-block").filter({ visible: true });
    await expect(blocks.first()).toContainText(urgent);
    await expect(blocks.first()).toContainText("60 min");
    await expect(page.getByText("de 00:00 a 23:59")).toBeVisible();

    // Empezar desde la recomendación lleva al temporizador con la duración propuesta
    const nextStep = page.getByTestId("next-step").filter({ visible: true });
    await expect(nextStep).toContainText(urgent);
    await nextStep.getByRole("button", { name: "Empezar 60 min" }).click();
    await expect(page).toHaveURL(/\/study$/);
    await expect(page.getByText(urgent).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("de 60 min", { exact: false }).filter({ visible: true })).toBeVisible();

    await page.getByRole("button", { name: "Descartar sesión" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Descartar sesión" }).click();
    await expect(page.getByRole("button", { name: "Empezar", exact: true })).toBeVisible();
  } finally {
    await deleteTask(page, urgent);
    await deleteTask(page, later);
    await setStudyWindow(page, "08:00", "22:00");
  }
});

test("el horario de estudio debe terminar después de empezar", async ({ page }) => {
  await signIn(page, "/settings");
  await page.getByLabel("Empiezo a estudiar").fill("22:00");
  await page.getByLabel("Termino").fill("08:00");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByText("Debe ser posterior a la hora de inicio")).toBeVisible();
});
