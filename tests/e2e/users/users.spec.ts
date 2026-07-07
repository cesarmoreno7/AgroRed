import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-USR — Usuarios / Administración", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
  });

  // TC-USR-001
  test("TC-USR-001 | página /users carga con tabla", async ({ page }) => {
    await page.goto("/users");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("table").first()).toBeVisible();
  });

  // TC-USR-002
  test("TC-USR-002 | API: GET /api/v1/users retorna 200", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  // TC-USR-003
  test("TC-USR-003 | producer NO puede GET /api/v1/users (403)", async ({ page, request }) => {
    await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
  });

  // TC-USR-004
  test("TC-USR-004 | sin token → 401 en /api/v1/users", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/users`);
    expect(res.status()).toBe(401);
  });

  // TC-USR-005
  test("TC-USR-005 | API: GET /api/v1/users/:id con id inexistente retorna 404", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/users/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });

  // TC-USR-006
  test("TC-USR-006 | API: PATCH /api/v1/users/:id con id inexistente retorna 404", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.patch(`${API_URL}/api/v1/users/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { fullName: "No existe" },
    });
    expect(res.status()).toBe(404);
  });
});
