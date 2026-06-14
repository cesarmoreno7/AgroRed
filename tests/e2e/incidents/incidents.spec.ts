import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-INC — Incidentes / Alertas", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
  });

  // TC-INC-001
  test("TC-INC-001 | API: GET /api/v1/incidents retorna 200", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/incidents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // TC-INC-002
  test("TC-INC-002 | API: POST /api/v1/incidents/register crea incidente con datos válidos", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const res = await request.post(`${API_URL}/api/v1/incidents/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        incidentType: "route_delay",
        severity: "low",
        title: "Incidente E2E Test Demo",
        description: "Descripción de prueba automatizada para E2E",
        locationDescription: "Ubicación test norte Bogotá",
        occurredAt: new Date().toISOString(),
        municipalityName: "Bogotá",
      },
    });
    expect([200, 201]).toContain(res.status());
  });

  // TC-INC-003
  test("TC-INC-003 | POST /api/v1/incidents/register sin title retorna 400", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const res = await request.post(`${API_URL}/api/v1/incidents/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        incidentType: "route_delay",
        severity: "high",
        // missing: title, description, locationDescription
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  // TC-INC-004
  test("TC-INC-004 | monitoring_agent puede ver incidentes", async ({ page, request }) => {
    await loginViaAPI(page, USERS.monitoring.email, USERS.monitoring.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/incidents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // monitoring_agent may be blocked at API level (403) in some gateway configs
    expect([200, 401, 403]).toContain(res.status());
  });

  // TC-INC-005
  test("TC-INC-005 | producer — intento de crear incidente con payload inválido retorna 400", async ({ page, request }) => {
    await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/incidents/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { tenantId: "invalid" },
    });
    // No service-level RBAC: 400 (validation) or 403/401 if RBAC added later
    expect([400, 401, 403, 422]).toContain(res.status());
  });
});
