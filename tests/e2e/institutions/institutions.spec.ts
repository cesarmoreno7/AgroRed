import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-INST — Instituciones / Organizaciones", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
  });

  // TC-INST-001
  test("TC-INST-001 | página /organizations carga con tabla", async ({ page }) => {
    await page.goto("/organizations");
    await page.waitForLoadState("networkidle");
    // OrganizationsPage renders a <table> with local-state data
    await expect(page.locator("table").first()).toBeVisible();
  });

  // TC-INST-002
  test("TC-INST-002 | API: GET /api/v1/institutions retorna 200", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/institutions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // TC-INST-003
  test("TC-INST-003 | API: POST /api/v1/institutions/register crea institución con datos válidos", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const res = await request.post(`${API_URL}/api/v1/institutions/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        institutionType: "community_canteen",
        name: `Institución E2E ${Date.now()}`,
        contactName: "Contacto Prueba E2E",
        contactPhone: "3001234567",
        municipalityName: "Bogotá",
        beneficiaryCount: 100,
        productCategories: ["tuberculo"],
      },
    });
    expect([200, 201]).toContain(res.status());
  });

  // TC-INST-004
  test("TC-INST-004 | POST /api/v1/institutions/register sin name retorna 400", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const res = await request.post(`${API_URL}/api/v1/institutions/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        institutionType: "community_canteen",
        // missing required: name, contactName, contactPhone, municipalityName, beneficiaryCount, productCategories
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  // TC-INST-005
  test("TC-INST-005 | producer — intento de crear institución con payload inválido retorna 400", async ({ page, request }) => {
    await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/institutions/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { tenantId: "invalid" },
    });
    // No service-level RBAC: 400 (validation) or 403/401 if RBAC added later
    expect([400, 401, 403, 422]).toContain(res.status());
  });

  // TC-INST-006
  test("TC-INST-006 | API: GET /api/v1/institutions/:id con id inexistente retorna 404", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/institutions/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([404, 400]).toContain(res.status());
  });
});
