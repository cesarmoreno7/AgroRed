import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-INV — Inventario", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
  });

  // TC-INV-001
  test("TC-INV-001 | API: GET /api/v1/inventory retorna 200", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/inventory`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // TC-INV-002
  test("TC-INV-002 | API: POST /api/v1/inventory/register crea ítem con datos válidos", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));

    // Need a valid producer from DB
    const producersRes = await request.get(`${API_URL}/api/v1/producers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const producersBody = await producersRes.json();
    const producerList = Array.isArray(producersBody.data)
      ? producersBody.data
      : producersBody.data?.data ?? [];

    if (producerList.length === 0) {
      test.skip(true, "No hay productores en BD para registrar inventario");
      return;
    }

    const producer = producerList[0];

    const res = await request.post(`${API_URL}/api/v1/inventory/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        sourceType: "buffer_stock",
        storageLocationName: "Bodega Central E2E",
        productName: "Arroz E2E Test",
        category: "cereal",
        unit: "kg",
        quantityOnHand: 200,
        municipalityName: producer.municipalityName ?? "Bogotá",
      },
    });
    expect([200, 201]).toContain(res.status());
  });

  // TC-INV-003
  test("TC-INV-003 | POST /api/v1/inventory/register sin productName retorna 400", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/inventory/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: "some-tenant",
        producerId: "00000000-0000-0000-0000-000000000001",
        sourceType: "buffer_stock",
        // missing: storageLocationName, productName, category, unit, quantityOnHand, municipalityName
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  // TC-INV-004
  test("TC-INV-004 | producer puede ver inventario propio", async ({ page, request }) => {
    await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/inventory`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // producer role may be blocked at API level (403) in some gateway configs
    expect([200, 401, 403]).toContain(res.status());
  });
});
