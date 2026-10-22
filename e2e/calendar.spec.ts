import { expect, test } from "@playwright/test";

import { hasTestUser, signIn } from "./support/auth";

/**
 * Fase 5: crear una clase semanal, verla en el dashboard, en la semana actual,
 * la siguiente y el mes; editarla y borrarla con confirmación.
 */

test.skip(!hasTestUser, "Faltan E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD en .env.test.local");

const TZ = "America/Santo_Domingo";

function weekdayLabel(date: Date) {
  const label = new Intl.DateTimeFormat("es-DO", { weekday: "long", timeZone: TZ }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

test("clase semanal en el calendario", async ({ page }) => {
  const stamp = Date.now();
  const title = `E2E Clase ${stamp}`;
  const renamed = `${title} editada`;
  const tomorrow = weekdayLabel(new Date(Date.now() + 24 * 60 * 60 * 1000));

  await signIn(page, "/calendar");

  // Crear: hoy y mañana, cada semana, de 10:00 a 11:30
  await page.getByRole("button", { name: "Nuevo evento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill(title);
  await dialog.getByLabel("Empieza").fill("10:00");
  await dialog.getByLabel("Termina").fill("11:30");
  await dialog.getByRole("combobox", { name: "Repetición" }).click();
  await page.getByRole("option", { name: "Cada semana" }).click();
  await dialog.getByRole("button", { name: tomorrow, exact: true }).click();
  await expect(dialog.getByRole("button", { name: tomorrow, exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByLabel("Lugar (opcional)").fill("AJ-301");
  await dialog.getByRole("button", { name: "Crear evento" }).click();
  await expect(dialog).toBeHidden();

  const grid = page.getByTestId("week-grid");
  const inGrid = (name: string) => grid.getByTestId("calendar-event").filter({ hasText: name });
  await expect(inGrid(title).first()).toBeVisible();
  await expect(inGrid(title).first()).toHaveAccessibleName(new RegExp(`Clase: ${title}, 10:00 a 11:30, AJ-301`));

  // La semana siguiente tiene exactamente las dos repeticiones
  await page.getByRole("link", { name: "Semana siguiente" }).click();
  await expect(page).toHaveURL(/view=week&date=/);
  await expect(inGrid(title)).toHaveCount(2);

  // También aparece en la vista mensual
  await page.getByRole("link", { name: "Mes", exact: true }).click();
  await expect(page).toHaveURL(/view=month/);
  await expect(
    page.getByTestId("month-grid").getByTestId("calendar-event").filter({ hasText: title }).first(),
  ).toBeVisible();

  // Y en el horario de hoy del dashboard
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Horario de hoy" })).toContainText(title);

  // Editar la serie desde una de sus repeticiones
  await page.goto("/calendar?view=week");
  await inGrid(title).first().click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog).toContainText("Los cambios se aplican a todas las repeticiones");
  await editDialog.getByLabel("Título").fill(renamed);
  await editDialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(editDialog).toBeHidden();
  await expect(inGrid(renamed).first()).toBeVisible();

  // Borrar con confirmación
  await inGrid(renamed).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Eliminar" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Se eliminarán todas las repeticiones");
  await confirm.getByRole("button", { name: "Eliminar evento" }).click();
  await expect(inGrid(renamed)).toHaveCount(0);

  await page.getByRole("link", { name: "Semana siguiente" }).click();
  await expect(inGrid(renamed)).toHaveCount(0);
});

test("la hora de fin debe ser posterior al inicio", async ({ page }) => {
  await signIn(page, "/calendar");
  await page.getByRole("button", { name: "Nuevo evento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill("Evento inválido");
  await dialog.getByLabel("Empieza").fill("12:00");
  await dialog.getByLabel("Termina").fill("11:00");
  await dialog.getByRole("button", { name: "Crear evento" }).click();
  await expect(dialog.getByText("Debe terminar después de empezar")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
});
