import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-LOG — Logística", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
  });

  // TC-LOG-001
  test("TC-LOG-001 | página /logistics carga con tabla", async ({ page }) => {
    await page.goto("/logistics");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("table").first()).toBeVisible();
  });

  // TC-LOG-002
  test("TC-LOG-002 | API: GET /api/v1/logistics retorna 200 (admin)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/logistics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // TC-LOG-003
  test("TC-LOG-003 | logistics_operator puede GET /api/v1/logistics", async ({ page, request }) => {
    await loginViaAPI(page, USERS.logistics.email, USERS.logistics.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/logistics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  // TC-LOG-004
  test("TC-LOG-004 | producer NO puede GET /api/v1/logistics (403)", async ({ page, request }) => {
    await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/logistics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
  });

  // TC-LOG-005
  test("TC-LOG-005 | POST /api/v1/logistics/register sin campos requeridos retorna 400", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/logistics/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { tenantId: "t-e2e" },
    });
    expect(res.status()).toBe(400);
  });

  // TC-LOG-006
  test("TC-LOG-006 | sin token → 401 en /api/v1/logistics", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/logistics`);
    expect(res.status()).toBe(401);
  });
});
