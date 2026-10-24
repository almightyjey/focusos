import { expect, type Page } from "@playwright/test";

/**
 * Limpieza: borra la tarea si existe. La lista llega por streaming después del
 * evento load, así que primero se espera a que aparezca; contar en seguida
 * daba 0 y la tarea quedaba sin borrar, rompiendo las pruebas siguientes.
 */
export async function deleteTaskIfPresent(page: Page, title: string) {
  await page.goto("/tasks");
  const item = page.getByTestId("task-item").filter({ hasText: title }).filter({ visible: true });
  await item
    .first()
    .waitFor({ state: "visible", timeout: 5_000 })
    .catch(() => undefined);
  if ((await item.count()) === 0) return;
  await item.getByRole("button", { name: `Acciones para ${title}` }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar tarea" }).click();
  await expect(item).toHaveCount(0);
}
