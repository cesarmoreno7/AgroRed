import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-MT — Tablas Maestras (territorio)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
  });

  // TC-MT-001
  test("TC-MT-001 | página /maestras/departamentos carga con tabla", async ({ page }) => {
    await page.goto("/maestras/departamentos");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("table").first()).toBeVisible();
  });

  // TC-MT-002
  test("TC-MT-002 | API: GET /api/v1/departamentos retorna 200", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/departamentos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // location-service anida los resultados paginados en data.data (a diferencia de
    // offer-service/institution-service, que devuelven data como arreglo plano).
    const items = Array.isArray(body.data) ? body.data : body.data?.data ?? [];
    expect(Array.isArray(items)).toBe(true);
  });

  // TC-MT-003
  test("TC-MT-003 | API: GET /api/v1/municipios retorna 200", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/municipios`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  // TC-MT-004
  test("TC-MT-004 | API: GET /api/v1/corregimientos retorna 200", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/corregimientos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  // TC-MT-005
  test("TC-MT-005 | API: GET /api/v1/veredas retorna 200", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/veredas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  // TC-MT-006
  test("TC-MT-006 | POST /api/v1/departamentos sin campos requeridos retorna 400", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/departamentos`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  // TC-MT-007
  test("TC-MT-007 | API: GET /api/v1/departamentos/:id con id inexistente retorna 404", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/departamentos/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });

  // TC-MT-008
  test("TC-MT-008 | sin token → 401 en /api/v1/departamentos", async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/departamentos`);
    expect(res.status()).toBe(401);
  });
});
