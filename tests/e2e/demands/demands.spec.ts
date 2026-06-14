import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-DEMAND — Gestión de Demandas", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
  });

  // TC-DEMAND-001
  test("TC-DEMAND-001 | página /demands carga con contenido", async ({ page }) => {
    await page.goto("/demands");
    await page.waitForLoadState("networkidle");
    const hasContent = await page.locator("table, [style*='grid'], [class*='card'], h2, h3").first().isVisible();
    const hasEmpty = await page.locator("text=/No hay|sin demand|empty/i").isVisible();
    const hasError = await page.locator("text=/Error 500|Not Found/").isVisible();
    expect(hasError).toBe(false);
    expect(hasContent || hasEmpty).toBeTruthy();
  });

  // TC-DEMAND-002
  test("TC-DEMAND-002 | API: GET /api/v1/demands retorna 200", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/demands`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // TC-DEMAND-003
  test("TC-DEMAND-003 | API: POST /api/v1/demands/register crea demanda con datos válidos", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    // tenantId from token payload
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const res = await request.post(`${API_URL}/api/v1/demands/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        demandChannel: "community_kitchen",
        organizationName: "Comedor E2E Test",
        productName: "Arroz",
        category: "cereal",
        unit: "kg",
        quantityRequired: 100,
        neededBy: new Date(Date.now() + 7 * 86400000).toISOString(),
        beneficiaryCount: 50,
        municipalityName: "Bogotá",
      },
    });
    expect([200, 201]).toContain(res.status());
  });

  // TC-DEMAND-004
  test("TC-DEMAND-004 | logistics_operator intenta crear demanda con payload inválido", async ({ page, request }) => {
    await loginViaAPI(page, USERS.logistics.email, USERS.logistics.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/demands/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { tenantId: "invalid" },
    });
    // No service-level RBAC: 400 (validation) or 403/401 if RBAC added later
    expect([400, 401, 403, 422]).toContain(res.status());
  });

  // TC-DEMAND-005
  test("TC-DEMAND-005 | community_kitchen puede crear demanda", async ({ page, request }) => {
    await loginViaAPI(page, USERS.kitchen.email, USERS.kitchen.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const res = await request.post(`${API_URL}/api/v1/demands/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        demandChannel: "community_kitchen",
        organizationName: "Cocina Comunitaria E2E",
        productName: "Frijol",
        category: "leguminosa",
        unit: "kg",
        quantityRequired: 50,
        neededBy: new Date(Date.now() + 7 * 86400000).toISOString(),
        beneficiaryCount: 30,
        municipalityName: "Bogotá",
      },
    });
    expect([200, 201]).toContain(res.status());
  });
});
