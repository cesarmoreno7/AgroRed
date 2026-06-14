import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { LoginPage } from "../pages/LoginPage";
import { USERS } from "../fixtures/users";

test.describe("TC-AUTH — Autenticación", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  // TC-AUTH-001
  test("TC-AUTH-001 | login exitoso con admin_municipal redirige al dashboard", async ({ page }) => {
    await loginPage.login(USERS.admin.email, USERS.admin.password);
    await loginPage.expectRedirectToDashboard();
    // Dashboard is mounted at "/" — toHaveURL matches against full URL string
    expect(page.url()).not.toContain("/login");
  });

  // TC-AUTH-002
  test("TC-AUTH-002 | login con contraseña incorrecta muestra error", async () => {
    await loginPage.login(USERS.admin.email, "WrongPass999!");
    await loginPage.expectError();
    await expect(loginPage.page).toHaveURL("/login");
  });

  // TC-AUTH-003
  test("TC-AUTH-003 | login con email inexistente muestra error", async () => {
    await loginPage.login("noexiste@agrored.co", "AnyPass123!");
    await loginPage.expectError();
  });

  // TC-AUTH-004
  test("TC-AUTH-004 | campos vacíos no disparan llamada a la API", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/")) requests.push(req.url());
    });
    await loginPage.submitBtn.click();
    // HTML5 validation should prevent submission
    await expect(page).toHaveURL("/login");
    expect(requests.filter((u) => u.includes("/login"))).toHaveLength(0);
  });

  // TC-AUTH-005
  test("TC-AUTH-005 | usuario ya autenticado es redirigido de /login al dashboard", async ({ page }) => {
    // Login via API (cached, no rate limit hit) and inject token
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
    // Now navigate to /login — GuestRoute should redirect back to /
    await page.goto("/login");
    await page.waitForFunction(
      () => !window.location.pathname.startsWith("/login"),
      { timeout: 8_000 }
    );
    expect(page.url()).not.toContain("/login");
  });

  // TC-AUTH-006
  test("TC-AUTH-006 | enlace 'Olvidé mi contraseña' navega a /forgot-password", async ({ page }) => {
    await loginPage.forgotLink.click();
    await expect(page).toHaveURL("/forgot-password");
  });

  // TC-AUTH-007
  test("TC-AUTH-007 | usuario no autenticado que accede a / es redirigido a /login", async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto("/");
    await expect(page).toHaveURL("/login");
  });

  // TC-AUTH-008
  test("TC-AUTH-008 | login exitoso con producer redirige al dashboard", async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(USERS.producer.email, USERS.producer.password);
    await loginPage.expectRedirectToDashboard();
    expect(page.url()).not.toContain("/login");
  });
});
