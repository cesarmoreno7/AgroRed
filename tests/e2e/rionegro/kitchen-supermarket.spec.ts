import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { API_URL } from "../fixtures/users";
import { RIONEGRO_USERS } from "../fixtures/users.rionegro";

// QA Pilot — Rionegro — roles Cocina Comunitaria / Supermercado (Demanda)

test.describe("TC-RIONEGRO-KITCHEN — Cocina Comunitaria (Rionegro)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, RIONEGRO_USERS.kitchen.email, RIONEGRO_USERS.kitchen.password);
  });

  test("RIO-KIT-001 | publica una necesidad/demanda institucional", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const res = await request.post(`${API_URL}/api/v1/demands/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        demandChannel: "community_kitchen",
        organizationName: "TEST_QA_RIONEGRO Comedor Comunitario La Convención",
        productName: "Papa criolla",
        category: "tuberculo",
        unit: "kg",
        quantityRequired: 150,
        neededBy: new Date(Date.now() + 7 * 86400000).toISOString(),
        beneficiaryCount: 220,
        municipalityName: "Municipio de Rionegro",
      },
    });
    expect(res.status()).toBe(201);
  });

  test("RIO-KIT-002 | emparejamiento automático: nueva oferta compatible notifica la demanda existente", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));

    // 1) crear demanda de un producto específico
    const demandRes = await request.post(`${API_URL}/api/v1/demands/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        demandChannel: "community_kitchen",
        organizationName: "TEST_QA_RIONEGRO Comedor matching E2E",
        productName: "Zanahoria",
        category: "hortaliza",
        unit: "kg",
        quantityRequired: 80,
        neededBy: new Date(Date.now() + 7 * 86400000).toISOString(),
        beneficiaryCount: 60,
        municipalityName: "Municipio de Rionegro",
      },
    });
    expect(demandRes.status()).toBe(201);

    // 2) publicar (como admin, con permisos) una oferta del mismo producto/categoría/municipio
    await loginViaAPI(page, RIONEGRO_USERS.admin.email, RIONEGRO_USERS.admin.password);
    const adminToken = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const producersRes = await request.get(`${API_URL}/api/v1/producers?limit=50`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const producersBody = await producersRes.json();
    const producerList = Array.isArray(producersBody.data) ? producersBody.data : producersBody.data?.data ?? [];
    const producer = producerList[0];

    const offerRes = await request.post(`${API_URL}/api/v1/offers/publish`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        title: "TEST_QA_RIONEGRO Zanahoria para matching E2E",
        productName: "Zanahoria",
        category: "hortaliza",
        unit: "kg",
        quantityAvailable: 100,
        priceAmount: 1800,
        currency: "COP",
        availableFrom: new Date().toISOString(),
        municipalityName: producer.municipalityName,
      },
    });
    expect(offerRes.status()).toBe(201);
    const offerBody = await offerRes.json();
    // El matching corre de forma síncrona dentro del propio POST /offers/publish
    // (apps/offer-service/.../PublishOffer + MatchOfferToDemands, ver offers.ts:106).
    expect(offerBody.data.matching).toBeTruthy();
    expect(offerBody.data.matching.matchesFound).toBeGreaterThanOrEqual(1);
  });

  test("RIO-KIT-003 | puja/acepta precio en subasta holandesa (rescate de excedentes)", async ({ page, request }) => {
    // community_kitchen no tiene permiso para GET /api/v1/producers (ver rbac.ts), así que
    // usamos admin_municipal tanto para consultar el productor como para publicar la subasta.
    await loginViaAPI(page, RIONEGRO_USERS.admin.email, RIONEGRO_USERS.admin.password);
    const adminToken = await page.evaluate(() => localStorage.getItem("agrored_token"));

    const producersRes = await request.get(`${API_URL}/api/v1/producers?limit=50`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const producersBody = await producersRes.json();
    const producerList = Array.isArray(producersBody.data) ? producersBody.data : producersBody.data?.data ?? [];
    const producer = producerList[0];
    expect(producer, "Debe existir al menos un productor sembrado en Rionegro").toBeTruthy();

    const auctionRes = await request.post(`${API_URL}/api/v1/auctions/publish`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        productName: "TEST_QA_RIONEGRO Lechuga holandesa E2E",
        category: "hortaliza",
        unit: "kg",
        quantityKg: 90,
        harvestDate: new Date(Date.now() - 43200000).toISOString(),
        auctionType: "dutch",
        basePrice: 2000,
        reservePrice: 1000,
        durationMinutes: 120,
        dutchStepPercent: 10,
        dutchStepMinutes: 15,
        latitude: 6.1550,
        longitude: -75.3738,
        municipalityName: producer.municipalityName,
      },
    });
    expect(auctionRes.status()).toBe(201);
    const auction = (await auctionRes.json()).data;

    await loginViaAPI(page, RIONEGRO_USERS.kitchen.email, RIONEGRO_USERS.kitchen.password);
    const kitchenToken = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const kitchenPayload = JSON.parse(atob(kitchenToken!.split(".")[1]));

    const acceptRes = await request.post(`${API_URL}/api/v1/auctions/${auction.id}/accept-dutch`, {
      headers: { Authorization: `Bearer ${kitchenToken}` },
      data: {
        bidderId: kitchenPayload.sub ?? kitchenPayload.userId ?? kitchenPayload.id,
        bidderType: "community_kitchen",
        acceptedPrice: 2000,
      },
    });
    expect(acceptRes.status()).toBe(200);
  });

  test("RIO-KIT-004 | NO tiene acceso a inteligencia (analytics/irat) ni operación territorial completa", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const iratRes = await request.get(`${API_URL}/api/v1/analytics/irat`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(iratRes.status()).toBe(403);

    const producersRes = await request.get(`${API_URL}/api/v1/producers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(producersRes.status()).toBe(403);
  });
});

test.describe("TC-RIONEGRO-SUPER — Supermercado (Rionegro)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, RIONEGRO_USERS.supermarket.email, RIONEGRO_USERS.supermarket.password);
  });

  test("RIO-SUPER-001 | puede ver ofertas del municipio", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/offers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  test("RIO-SUPER-002 | supermarket ahora puede leer y pujar en subastas (Bug #7 corregido)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const auctionsRes = await request.get(`${API_URL}/api/v1/auctions?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // rbac.ts ahora incluye 'supermarket' en GET /api/v1/auctions (Bug #7): el enunciado de
    // negocio agrupa "Cocina Comunitaria/Supermercado" como compradores de la holandesa.
    expect(auctionsRes.status()).toBe(200);

    const bidRes = await request.post(`${API_URL}/api/v1/auctions/00000000-0000-0000-0000-000000000000/bid`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { bidderId: "00000000-0000-0000-0000-000000000000", bidderType: "supermarket", amount: 1 },
    });
    // Ya no lo bloquea RBAC (403): pasa la autorización y llega a la lógica de negocio, que
    // responde 404 porque la subasta de prueba no existe — la ausencia de un 403 es lo que
    // prueba que Bug #7 quedó corregido.
    expect(bidRes.status()).toBe(404);
    const bidBody = await bidRes.json();
    expect(bidBody.error.code).toBe("AUCTION_NOT_FOUND");
  });
});
