import { expect, test, type Page } from "@playwright/test";

import { hasTestUser, signIn } from "./support/auth";

/**
 * Fase 6: temporizador desde una tarea (pausa que sobrevive a recargar,
 * terminar completando la tarea), registro manual y descarte.
 */

test.skip(!hasTestUser, "Faltan E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD en .env.test.local");

const TZ = "America/Santo_Domingo";

/** Fecha y hora locales de hace `minutesAgo` minutos en la zona de las pruebas. */
function localInput(minutesAgo: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(Date.now() - minutesAgo * 60_000));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

async function deleteSessionRows(page: Page, text: string) {
  await page.goto("/study");
  const rows = page.getByTestId("session-row").filter({ hasText: text });
  // La lista llega por streaming: contar en seguida podía dar 0 y no borrar nada.
  await rows
    .first()
    .waitFor({ state: "visible", timeout: 5_000 })
    .catch(() => undefined);
  for (let remaining = await rows.count(); remaining > 0; remaining -= 1) {
    await rows.first().getByRole("button", { name: "Eliminar sesión" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar sesión" }).click();
    // Espera a que la lista se actualice antes de seguir con la siguiente fila.
    await expect(rows).toHaveCount(remaining - 1);
  }
}

test("sesión desde una tarea: pausar, recargar, terminar y completar", async ({ page }) => {
  const title = `E2E Estudio ${Date.now()}`;
  await signIn(page, "/tasks");

  // Tarea con estimación
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Qué hay que hacer").fill(title);
  await dialog.getByLabel("Estimación (min)").fill("60");
  await dialog.getByRole("button", { name: "Crear tarea" }).click();
  await expect(dialog).toBeHidden();
  const item = page.getByTestId("task-item").filter({ hasText: title });
  await expect(item).toContainText("1 h estimados");

  // Estudiar ahora desde el menú de la tarea
  await item.getByRole("button", { name: `Acciones para ${title}` }).click();
  await page.getByRole("menuitem", { name: "Estudiar ahora (25 min)" }).click();
  const bar = page.getByRole("region", { name: "Sesión de estudio en curso" });
  await expect(bar).toContainText(title);
  await expect(bar).toContainText("Quedan");

  // La pausa la guarda la base: sobrevive a recargar
  await bar.getByRole("button", { name: "Pausar" }).click();
  await expect(bar).toContainText("En pausa");
  await page.reload();
  await expect(page.getByRole("region", { name: "Sesión de estudio en curso" })).toContainText("En pausa");
  await page.getByRole("region", { name: "Sesión de estudio en curso" }).getByRole("button", { name: "Reanudar" }).click();
  await expect(page.getByRole("region", { name: "Sesión de estudio en curso" })).toContainText("Quedan");

  // En /study se ve el temporizador grande y no la barra
  await page.goto("/study");
  await expect(page.getByRole("region", { name: "Sesión de estudio en curso" })).toHaveCount(0);
  await expect(page.getByTestId("session-clock")).toBeVisible();

  // Terminar y completar la tarea
  await page.getByRole("button", { name: "Terminar" }).click();
  const finish = page.getByRole("dialog");
  await expect(finish).toContainText(title);
  await finish.getByLabel("Marcar la tarea como completada").click();
  await finish.getByRole("button", { name: "Guardar sesión" }).click();
  await expect(page.getByText(/Registraste .* de estudio y completaste la tarea/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Empezar", exact: true })).toBeVisible();
  await expect(page.getByTestId("session-row").filter({ hasText: title })).toHaveCount(1);

  // La tarea muestra tiempo real frente a estimado
  await page.goto("/tasks?view=completed");
  const done = page.getByTestId("task-item").filter({ hasText: title });
  await expect(done).toContainText(/de 1 h/);

  // Limpieza
  await deleteSessionRows(page, title);
  await page.goto("/tasks?view=completed");
  await done.getByRole("button", { name: `Acciones para ${title}` }).click();
  await page.getByRole("menuitem", { name: "Eliminar" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar tarea" }).click();
  await expect(done).toHaveCount(0);
});

test("registro manual y descarte de una sesión", async ({ page }) => {
  const note = `E2E manual ${Date.now()}`;
  await signIn(page, "/study");
  const weekBefore = await page.getByTestId("focus-week").textContent();

  try {
    // Registrar 45 minutos que terminaron hace una hora
    const start = localInput(105);
    await page.getByRole("button", { name: "Registrar tiempo" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Día").fill(start.date);
    await dialog.getByLabel("Empezaste").fill(start.time);
    await dialog.getByLabel("Minutos de enfoque").fill("45");
    await dialog.getByLabel("Notas (opcional)").fill(note);
    await dialog.getByRole("button", { name: "Registrar tiempo" }).click();
    await expect(dialog).toBeHidden();
    const row = page.getByTestId("session-row").filter({ hasText: note });
    await expect(row).toContainText("45 min");
    await expect(page.getByTestId("focus-week")).not.toHaveText(weekBefore ?? "");

    // No se puede registrar tiempo en el futuro
    const future = localInput(-120);
    await page.getByRole("button", { name: "Registrar tiempo" }).click();
    await dialog.getByLabel("Día").fill(future.date);
    await dialog.getByLabel("Empezaste").fill(future.time);
    await dialog.getByLabel("Minutos de enfoque").fill("30");
    await dialog.getByRole("button", { name: "Registrar tiempo" }).click();
    await expect(dialog.getByRole("alert")).toContainText("futuro");
    await dialog.getByRole("button", { name: "Cancelar" }).click();

    // Empezar sin límite y descartar: no se registra nada
    await page.getByLabel("Qué vas a estudiar").click();
    await page.getByRole("option", { name: "Sin tarea ni materia" }).click();
    await page.getByRole("radio", { name: "Sin límite" }).click();
    await page.getByRole("button", { name: "Empezar", exact: true }).click();
    await expect(page.getByTestId("session-clock")).toBeVisible();
    await expect(page.getByText("Estudiando", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Descartar sesión" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Descartar sesión" }).click();
    await expect(page.getByRole("button", { name: "Empezar", exact: true })).toBeVisible();
    // El descarte no deja fila. Se ignoran los registros manuales de otras corridas.
    await expect(
      page.getByTestId("session-row").filter({ hasText: "Estudio libre" }).filter({ hasNotText: "E2E manual" }),
    ).toHaveCount(0);
  } finally {
    await deleteSessionRows(page, note);
  }
});
