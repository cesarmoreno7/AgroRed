import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-NOTIF — Notificaciones", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
  });

  // TC-NOTIF-001
  test("TC-NOTIF-001 | página /notifications carga con tabla", async ({ page }) => {
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("table").first()).toBeVisible();
  });

  // TC-NOTIF-002
  test("TC-NOTIF-002 | API: GET /api/v1/notifications retorna 200 (admin)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // TC-NOTIF-003
  test("TC-NOTIF-003 | territorial_analyst puede GET /api/v1/notifications", async ({ page, request }) => {
    await loginViaAPI(page, USERS.analyst.email, USERS.analyst.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  // TC-NOTIF-004
  test("TC-NOTIF-004 | producer NO puede GET /api/v1/notifications (403)", async ({ page, request }) => {
    await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
  });

  // TC-NOTIF-005
  test("TC-NOTIF-005 | POST /api/v1/notifications/register sin campos requeridos retorna 400", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/notifications/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { tenantId: "t-e2e" },
    });
    expect(res.status()).toBe(400);
  });

  // TC-NOTIF-006
  test("TC-NOTIF-006 | API: GET /api/v1/notifications/:id con id inexistente retorna 404", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/notifications/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });

  // TC-NOTIF-007
  test("TC-NOTIF-007 | sin token → 401 en /api/v1/notifications", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/notifications`);
    expect(res.status()).toBe(401);
  });
});
