import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-RESCUE — Rescates de Alimentos", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
  });

  // TC-RESCUE-001
  test("TC-RESCUE-001 | página /rescues carga con tabla", async ({ page }) => {
    await page.goto("/rescues");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("table").first()).toBeVisible();
  });

  // TC-RESCUE-002
  test("TC-RESCUE-002 | API: GET /api/v1/rescues retorna 200", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/rescues`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // TC-RESCUE-003
  test("TC-RESCUE-003 | API: GET /api/v1/analytics/origins retorna 200 o 404", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/analytics/origins`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status());
  });

  // TC-RESCUE-004
  test("TC-RESCUE-004 | community_kitchen puede ver rescates", async ({ page, request }) => {
    await loginViaAPI(page, USERS.kitchen.email, USERS.kitchen.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/rescues`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  // TC-RESCUE-005
  test("TC-RESCUE-005 | API: POST /api/v1/rescues/register sin campos retorna 400", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/rescues/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { tenantId: "invalid" }, // missing required fields
    });
    expect([400, 422]).toContain(res.status());
  });
});
