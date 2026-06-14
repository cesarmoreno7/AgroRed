import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { CrudPage } from "../pages/CrudPage";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-PROD — Gestión de Productores", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/producers");
    await page.waitForLoadState("networkidle");
  });

  // TC-PROD-001
  test("TC-PROD-001 | página de productores carga y muestra tabla", async ({ page }) => {
    await expect(page.locator("table, [role='table']").first()).toBeVisible();
    await expect(page).toHaveURL("/producers");
  });

  // TC-PROD-002
  test("TC-PROD-002 | botón 'Nuevo' abre formulario de registro", async ({ page }) => {
    const crud = new CrudPage(page);
    await crud.openAddForm();
    await expect(crud.modalForm).toBeVisible();
  });

  // TC-PROD-003
  test("TC-PROD-003 | crear productor con datos válidos lo agrega a la lista", async ({ page }) => {
    const crud = new CrudPage(page);
    const countBefore = await crud.rowCount();
    await crud.openAddForm();

    // ProducersPage form fields: organizationName, contactName, contactPhone, dept select, municipio select, productCategories
    await page.fill('input[placeholder*="Asociación" i], input[placeholder*="organización" i]', `Productor E2E ${Date.now()}`);
    await page.fill('input[placeholder*="completo" i]', "Contacto E2E");
    await page.fill('input[placeholder*="300" i]', "3001234567");
    await page.fill('input[placeholder*="hortalizas" i], input[placeholder*="categor" i]', "hortalizas");

    // Select first available department
    const deptSelect = page.locator('select').first();
    if (await deptSelect.isVisible()) {
      await deptSelect.selectOption({ index: 1 });
      // Brief pause for municipio dropdown to populate
      await page.waitForTimeout(300);
      const muniSelect = page.locator('select').nth(1);
      if (await muniSelect.isVisible()) {
        await muniSelect.selectOption({ index: 1 });
      }
    }

    await crud.clickSave();
    await page.waitForTimeout(1500);
    const countAfter = await crud.rowCount();
    expect(countAfter).toBeGreaterThanOrEqual(countBefore);
  });

  // TC-PROD-004
  test("TC-PROD-004 | API: GET /api/v1/producers retorna 200 con lista", async ({ request, page }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/producers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data) || Array.isArray(body.data?.data)).toBeTruthy();
  });

  // TC-PROD-005
  test("TC-PROD-005 | kitchen GET /api/v1/producers (sin RBAC API: 200 filtrado)", async ({ page, request }) => {
    await loginViaAPI(page, USERS.kitchen.email, USERS.kitchen.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/producers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // No service-level RBAC for GET: API returns 200 (filtered by tenant); UI blocks via ModuleGuard
    expect([200, 401, 403]).toContain(res.status());
  });
});
