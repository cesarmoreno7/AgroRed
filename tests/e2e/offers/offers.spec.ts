import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-OFFER — Gestión de Ofertas", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/offers");
    await page.waitForLoadState("networkidle");
  });

  // TC-OFFER-001
  test("TC-OFFER-001 | página de ofertas carga sin errores críticos", async ({ page }) => {
    const bodyText = await page.textContent("body");
    expect(bodyText).not.toMatch(/Cannot GET|Error 500|404 Not Found/);
    const visible = await page.locator("body > *").first().isVisible();
    expect(visible).toBe(true);
  });

  // TC-OFFER-002
  test("TC-OFFER-002 | API: GET /api/v1/offers retorna 200 con datos", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/offers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // TC-OFFER-003
  test("TC-OFFER-003 | API: POST /api/v1/offers/publish crea oferta con datos válidos", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));

    const producersRes = await request.get(`${API_URL}/api/v1/producers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const producers = await producersRes.json();
    const producerList = Array.isArray(producers.data) ? producers.data : producers.data?.data ?? [];

    if (producerList.length === 0) {
      test.skip(true, "No hay productores en BD para crear oferta");
      return;
    }

    const producer = producerList[0];
    const res = await request.post(`${API_URL}/api/v1/offers/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        title: "Oferta Maíz E2E Test",
        productName: "Maíz E2E Test",
        category: "cereal",
        unit: "kg",
        quantityAvailable: 50,
        priceAmount: 1200,
        currency: "COP",
        availableFrom: new Date().toISOString(),
        municipalityName: producer.municipalityName ?? "Bogotá",
      },
    });
    expect([200, 201]).toContain(res.status());
  });

  // TC-OFFER-004
  test("TC-OFFER-004 | oferta sin producerId retorna 400", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/offers/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { productName: "Oferta inválida" },
    });
    expect([400, 422]).toContain(res.status());
  });

  // TC-OFFER-005
  test("TC-OFFER-005 | producer puede ver ofertas", async ({ page, request }) => {
    await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/offers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });
});
