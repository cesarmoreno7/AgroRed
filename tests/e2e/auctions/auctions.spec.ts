import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-AUCTION — Subastas", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
  });

  // TC-AUCTION-001
  test("TC-AUCTION-001 | página /auctions carga sin errores", async ({ page }) => {
    await page.goto("/auctions");
    await page.waitForLoadState("networkidle");
    const bodyText = await page.textContent("body");
    expect(bodyText).not.toMatch(/Cannot GET|Error 500|404 Not Found/);
    // Page must have some visible element (header, card, or empty message)
    const visible = await page.locator("body > *").first().isVisible();
    expect(visible).toBe(true);
  });

  // TC-AUCTION-002
  test("TC-AUCTION-002 | API: GET /api/v1/auctions retorna 200", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/auctions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // TC-AUCTION-003
  test("TC-AUCTION-003 | API: POST /api/v1/auctions/publish crea subasta con datos válidos", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));

    const producersRes = await request.get(`${API_URL}/api/v1/producers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const producersBody = await producersRes.json();
    const producerList = Array.isArray(producersBody.data)
      ? producersBody.data
      : producersBody.data?.data ?? [];

    if (producerList.length === 0) {
      test.skip(true, "No hay productores en BD para crear subasta");
      return;
    }

    const producer = producerList[0];

    const res = await request.post(`${API_URL}/api/v1/auctions/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        productName: "Papa criolla E2E Test",
        category: "tuberculo",
        unit: "kg",
        quantityKg: 200,
        harvestDate: new Date(Date.now() - 86400000).toISOString(),
        auctionType: "ascending",
        basePrice: 1200,
        reservePrice: 900,
        durationMinutes: 120,
        latitude: 4.649,
        longitude: -74.2471,
        municipalityName: producer.municipalityName ?? "Bogotá",
      },
    });
    expect([200, 201]).toContain(res.status());
  });

  // TC-AUCTION-004
  test("TC-AUCTION-004 | POST /api/v1/auctions/publish sin producerId retorna 400", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/auctions/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: "00000000-0000-0000-0000-000000000001",
        basePrice: 1000,
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  // TC-AUCTION-005
  test("TC-AUCTION-005 | producer puede ver subastas", async ({ page, request }) => {
    await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/auctions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  // TC-AUCTION-006
  test("TC-AUCTION-006 | GET /api/v1/auctions/:id con id inexistente retorna 404", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/auctions/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([404, 400]).toContain(res.status());
  });
});
