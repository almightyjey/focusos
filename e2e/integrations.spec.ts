import { expect, test } from "@playwright/test";

import { hasTestUser, signIn } from "./support/auth";
import { deleteTaskIfPresent } from "./support/tasks";

/**
 * Fase 9: Ajustes muestra el estado real de las integraciones y el asistente
 * divide una tarea en pasos. La prueba del asistente usa AI_PROVIDER=fake
 * (playwright.config.ts): sin red, sin claves y sin coste.
 */

test.skip(!hasTestUser, "Faltan E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD en .env.test.local");

test("Ajustes muestra el estado de cada integración sin exponer secretos", async ({ page }) => {
  await signIn(page, "/settings");
  await expect(page.getByRole("heading", { name: "Integraciones" })).toBeVisible();

  const assistant = page.getByTestId("integration-assistant").filter({ visible: true });
  const notion = page.getByTestId("integration-notion").filter({ visible: true });
  await expect(assistant).toBeVisible();
  await expect(notion).toBeVisible();

  // Sin las variables de Notion en el servidor, se dice qué falta (solo nombres).
  if ((await notion.textContent())?.includes("No configurado")) {
    await expect(notion).toContainText("NOTION_CLIENT_ID");
    await expect(notion.getByRole("link", { name: "Conectar con Notion" })).toHaveCount(0);
  }
  // Ningún valor con forma de clave llega al HTML.
  const html = await page.content();
  expect(html).not.toMatch(/sk-ant-|sb_secret_|secret_[A-Za-z0-9]{20,}/);
});

test("el asistente divide una tarea en pasos y solo guarda al confirmar", async ({ page }) => {
  const title = `E2E Pasos ${Date.now()}`;
  await signIn(page, "/settings");
  const assistant = page.getByTestId("integration-assistant").filter({ visible: true });
  await expect(assistant).toBeVisible();
  test.skip(
    !(await assistant.textContent())?.includes("Proveedor de prueba"),
    "El servidor no usa AI_PROVIDER=fake (¿servidor reutilizado?)",
  );

  try {
    await page.goto("/tasks");
    await page.getByRole("button", { name: "Nueva tarea" }).click();
    const form = page.getByRole("dialog");
    await form.getByLabel("Qué hay que hacer").fill(title);
    await form.getByRole("button", { name: "Crear tarea" }).click();
    await expect(form).toBeHidden();

    const item = page.getByTestId("task-item").filter({ hasText: title }).filter({ visible: true });
    await item.getByRole("button", { name: `Acciones para ${title}` }).click();
    await page.getByRole("menuitem", { name: "Dividir en pasos" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Se enviarán el título");
    await expect(dialog).toContainText("Proveedor de prueba (sin IA real)");

    // Cerrar sin generar no cambia nada
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(item).not.toContainText("estimados");

    await item.getByRole("button", { name: `Acciones para ${title}` }).click();
    await page.getByRole("menuitem", { name: "Dividir en pasos" }).click();
    await dialog.getByRole("button", { name: "Generar sugerencia" }).click();

    const suggestion = dialog.getByTestId("task-steps-suggestion");
    await expect(suggestion.getByRole("listitem")).toHaveCount(3);
    await expect(suggestion).toContainText("Releer el enunciado y anotar dudas");
    await expect(suggestion).toContainText("Total: 50 min");
    await expect(dialog.getByLabel("Usar 50 min como estimación de la tarea")).toBeChecked();

    await dialog.getByRole("button", { name: "Añadir a la descripción" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Pasos añadidos a la descripción")).toBeVisible();
    await expect(item).toContainText("50 min estimados");

    // Los pasos quedaron en las notas de la tarea, tras recargar
    await page.reload();
    const reloaded = page.getByTestId("task-item").filter({ hasText: title }).filter({ visible: true });
    await reloaded.getByRole("button", { name: `Acciones para ${title}` }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    await expect(page.getByRole("dialog").getByLabel("Notas (opcional)")).toHaveValue(
      /^Pasos sugeridos:\n- \[ \] Releer el enunciado y anotar dudas \(10 min\)/,
    );
    await page.keyboard.press("Escape");
  } finally {
    await deleteTaskIfPresent(page, title);
  }
});
