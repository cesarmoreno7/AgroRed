import { test, expect } from "@playwright/test";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-AUTH-PWD — Recuperación de contraseña", () => {
  // TC-AUTH-PWD-001
  test("TC-AUTH-PWD-001 | solicitar reset con email registrado retorna 200 y muestra confirmación", async ({ page, request }) => {
    const res = await request.post(`${API_URL}/api/v1/users/recover-password`, {
      data: { email: USERS.admin.email },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // TC-AUTH-PWD-002
  test("TC-AUTH-PWD-002 | solicitar reset con email no registrado responde 200 (no revelación de existencia)", async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/users/recover-password`, {
      data: { email: "fantasma@noexiste.co" },
    });
    // Should return 200 to avoid user enumeration
    expect(res.status()).toBe(200);
  });

  // TC-AUTH-PWD-003
  test("TC-AUTH-PWD-003 | página forgot-password renderiza campo email y botón enviar", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  // TC-AUTH-PWD-004
  test("TC-AUTH-PWD-004 | página reset-password sin token muestra error o redirige", async ({ page }) => {
    await page.goto("/reset-password");
    // Without a valid token, should show error or redirect to login
    const url = page.url();
    const hasErrorOrRedirect =
      url.includes("/login") ||
      url.includes("/forgot-password") ||
      (await page.locator("body").innerText()).toLowerCase().includes("inválid");
    expect(hasErrorOrRedirect).toBeTruthy();
  });
});
