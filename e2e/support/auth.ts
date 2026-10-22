import { expect, type Page } from "@playwright/test";

export const testUser = {
  email: process.env.E2E_USER_A_EMAIL,
  password: process.env.E2E_USER_A_PASSWORD,
};

export const hasTestUser = Boolean(testUser.email && testUser.password);

/** Inicia sesión desde la página de login, como lo haría una persona. */
export async function signIn(page: Page, next = "/dashboard") {
  await page.goto(next);
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("Correo").fill(testUser.email!);
  await page.getByLabel("Contraseña").fill(testUser.password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[?]/g, "\?")}$`));
}
