import { expect, test } from "@playwright/test";

import { hasTestUser, signIn } from "./support/auth";

/**
 * Criterio de éxito de la primera entrega:
 * iniciar sesión → crear materia → registrar tarea con fecha límite → verla en
 * el dashboard → completarla → recargar y comprobar que persiste.
 */

test.skip(!hasTestUser, "Faltan E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD en .env.test.local");

test("flujo completo de la primera entrega", async ({ page }) => {
  const stamp = Date.now();
  const subjectName = `E2E Materia ${stamp}`;
  const taskTitle = `E2E Tarea ${stamp}`;

  await signIn(page);
  await expect(page.getByRole("heading", { level: 1, name: "Hoy" })).toBeVisible();

  // 1. Crear materia
  await page.goto("/subjects");
  await page.getByRole("button", { name: "Nueva materia" }).first().click();
  const subjectDialog = page.getByRole("dialog");
  await subjectDialog.getByLabel("Nombre").fill(subjectName);
  await subjectDialog.getByRole("button", { name: "Crear materia" }).click();
  await expect(subjectDialog).toBeHidden();
  await expect(page.getByRole("link", { name: subjectName })).toBeVisible();

  // 2. Registrar tarea con fecha límite hoy a las 23:59
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  const taskDialog = page.getByRole("dialog");
  await taskDialog.getByLabel("Qué hay que hacer").fill(taskTitle);
  await taskDialog.getByRole("combobox", { name: "Materia" }).click();
  await page.getByRole("option", { name: subjectName }).click();
  await taskDialog.getByRole("button", { name: "Hoy", exact: true }).click();
  await taskDialog.getByLabel("Hora").fill("23:59");
  await taskDialog.getByRole("button", { name: "Crear tarea" }).click();
  await expect(taskDialog).toBeHidden();

  // 3. Verla en el dashboard, dentro de "Qué hacer hoy"
  await page.goto("/dashboard");
  const today = page.getByRole("region", { name: "Qué hacer hoy" });
  const item = today.getByTestId("task-item").filter({ hasText: taskTitle });
  await expect(item).toBeVisible();
  await expect(item).toContainText(subjectName);
  await expect(item).toContainText("Hoy, 23:59");

  // 4. Marcarla como completada
  await item.getByRole("checkbox").click();
  await expect(page.getByText("Tarea completada")).toBeVisible();
  await expect(item.getByRole("checkbox")).toBeChecked();

  // 5. Persistencia tras recargar
  await page.reload();
  const persisted = page
    .getByRole("region", { name: "Qué hacer hoy" })
    .getByTestId("task-item")
    .filter({ hasText: taskTitle });
  await expect(persisted).toHaveAttribute("data-done", "true");
  await expect(persisted.getByRole("checkbox")).toBeChecked();

  await page.goto("/tasks?view=completed");
  const completed = page.getByTestId("task-item").filter({ hasText: taskTitle });
  await expect(completed).toBeVisible();

  // Limpieza por la interfaz (también prueba la confirmación de borrado)
  await completed.getByRole("button", { name: `Acciones para ${taskTitle}` }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  const confirmTask = page.getByRole("alertdialog");
  await expect(confirmTask).toContainText("se eliminará definitivamente");
  await confirmTask.getByRole("button", { name: "Eliminar tarea" }).click();
  await expect(page.getByTestId("task-item").filter({ hasText: taskTitle })).toHaveCount(0);

  await page.goto("/subjects");
  await page.getByRole("button", { name: `Acciones para ${subjectName}` }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  const confirmSubject = page.getByRole("alertdialog");
  await confirmSubject.getByRole("button", { name: "Eliminar materia" }).click();
  await expect(page.getByRole("link", { name: subjectName })).toHaveCount(0);
});

test("las páginas privadas exigen sesión", async ({ page }) => {
  for (const path of ["/dashboard", "/tasks", "/calendar", "/subjects", "/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
  }
});
