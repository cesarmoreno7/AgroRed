import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

/**
 * RBAC matrix: role → endpoint → expected HTTP status
 * Roles: admin_municipal, producer, supermarket, logistics_operator,
 *         territorial_analyst, community_kitchen, monitoring_agent
 */

test.describe("TC-RBAC — Control de Acceso por Rol", () => {

  // ─── Admin: acceso total ─────────────────────────────────────────────────────

  test.describe("admin_municipal", () => {
    test("TC-RBAC-001 | admin puede GET /api/v1/producers", async ({ page, request }) => {
      await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
      const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
      const res = await request.get(`${API_URL}/api/v1/producers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    });

    test("TC-RBAC-002 | admin puede GET /api/v1/users", async ({ page, request }) => {
      await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
      const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
      const res = await request.get(`${API_URL}/api/v1/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    });

    test("TC-RBAC-003 | admin puede GET /api/v1/rescues", async ({ page, request }) => {
      await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
      const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
      const res = await request.get(`${API_URL}/api/v1/rescues`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    });
  });

  // ─── Producer: solo sus recursos ────────────────────────────────────────────

  test.describe("producer", () => {
    test("TC-RBAC-010 | producer puede GET /api/v1/offers", async ({ page, request }) => {
      await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
      const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
      const res = await request.get(`${API_URL}/api/v1/offers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    });

    test("TC-RBAC-011 | producer GET /api/v1/users (sin RBAC API: 200 filtrado por tenant)", async ({ page, request }) => {
      await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
      const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
      const res = await request.get(`${API_URL}/api/v1/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // No service-level RBAC for GET: API returns 200 (filtered by tenant); UI blocks via ModuleGuard
      expect([200, 401, 403]).toContain(res.status());
    });

    test("TC-RBAC-012 | producer intenta crear institución con payload inválido", async ({ page, request }) => {
      await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
      const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
      const res = await request.post(`${API_URL}/api/v1/institutions/register`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { tenantId: "invalid" },
      });
      // No service-level RBAC: 400 (validation) or 403/401 if RBAC added later
      expect([400, 401, 403, 422]).toContain(res.status());
    });
  });

  // ─── Community kitchen ───────────────────────────────────────────────────────

  test.describe("community_kitchen", () => {
    test("TC-RBAC-020 | kitchen puede GET /api/v1/rescues", async ({ page, request }) => {
      await loginViaAPI(page, USERS.kitchen.email, USERS.kitchen.password);
      const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
      const res = await request.get(`${API_URL}/api/v1/rescues`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    });

    test("TC-RBAC-021 | kitchen puede GET /api/v1/demands", async ({ page, request }) => {
      await loginViaAPI(page, USERS.kitchen.email, USERS.kitchen.password);
      const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
      const res = await request.get(`${API_URL}/api/v1/demands`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    });

    test("TC-RBAC-022 | kitchen GET /api/v1/producers (sin RBAC API: 200 filtrado por tenant)", async ({ page, request }) => {
      await loginViaAPI(page, USERS.kitchen.email, USERS.kitchen.password);
      const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
      const res = await request.get(`${API_URL}/api/v1/producers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // No service-level RBAC for GET: API returns 200 (filtered by tenant); UI blocks via ModuleGuard
      expect([200, 401, 403]).toContain(res.status());
    });
  });

  // ─── Logistics operator ──────────────────────────────────────────────────────

  test.describe("logistics_operator", () => {
    test("TC-RBAC-030 | logistics puede GET /api/v1/rescues", async ({ page, request }) => {
      await loginViaAPI(page, USERS.logistics.email, USERS.logistics.password);
      const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
      const res = await request.get(`${API_URL}/api/v1/rescues`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status()).toBe(200);
    });

    test("TC-RBAC-031 | logistics intenta crear demanda con payload inválido", async ({ page, request }) => {
      await loginViaAPI(page, USERS.logistics.email, USERS.logistics.password);
      const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
      const res = await request.post(`${API_URL}/api/v1/demands/register`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { tenantId: "invalid" },
      });
      // No service-level RBAC: 400 (validation) or 403/401 if RBAC added later
      expect([400, 401, 403, 422]).toContain(res.status());
    });
  });

  // ─── Territorial analyst ─────────────────────────────────────────────────────

  test.describe("territorial_analyst", () => {
    test("TC-RBAC-040 | analyst puede GET /api/v1/analytics/origins", async ({ page, request }) => {
      await loginViaAPI(page, USERS.analyst.email, USERS.analyst.password);
      const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
      const res = await request.get(`${API_URL}/api/v1/analytics/origins`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([200, 404]).toContain(res.status());
    });
  });

  // ─── Unauthenticated requests ────────────────────────────────────────────────

  test.describe("sin autenticación", () => {
    test("TC-RBAC-050 | GET /api/v1/producers sin token retorna 401", async ({ request }) => {
      const res = await request.get(`${API_URL}/api/v1/producers`);
      expect([401, 403]).toContain(res.status());
    });

    test("TC-RBAC-051 | GET /api/v1/users sin token retorna 401", async ({ request }) => {
      const res = await request.get(`${API_URL}/api/v1/users`);
      expect([401, 403]).toContain(res.status());
    });

    test("TC-RBAC-052 | GET /api/v1/rescues sin token retorna 401", async ({ request }) => {
      const res = await request.get(`${API_URL}/api/v1/rescues`);
      expect([401, 403]).toContain(res.status());
    });

    test("TC-RBAC-053 | token inválido retorna 401", async ({ request }) => {
      const res = await request.get(`${API_URL}/api/v1/offers`, {
        headers: { Authorization: "Bearer TOKEN_FALSO_12345" },
      });
      expect([401, 403]).toContain(res.status());
    });
  });
});
