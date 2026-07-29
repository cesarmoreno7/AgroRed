import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { API_URL } from "../fixtures/users";
import { RIONEGRO_USERS } from "../fixtures/users.rionegro";

// QA Pilot — Rionegro (Oriente Antioqueño) — rol Productor
// Datos base sembrados por scripts/seed_rionegro_pilot.ts (prefijo TEST_QA_RIONEGRO).

async function findProducerByOrgSubstring(page: any, request: any, token: string, needle: string) {
  const res = await request.get(`${API_URL}/api/v1/producers?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  const list = Array.isArray(body.data) ? body.data : body.data?.data ?? [];
  return list.find((p: any) => (p.organizationName ?? "").includes(needle));
}

test.describe("TC-RIONEGRO-PROD — Productor (Rionegro)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, RIONEGRO_USERS.producer.email, RIONEGRO_USERS.producer.password);
  });

  test("RIO-PROD-001 | login exitoso y token trae tenant Rionegro", async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    expect(token).toBeTruthy();
    const payload = JSON.parse(atob(token!.split(".")[1]));
    expect(payload.role).toBe("producer");
  });

  test("RIO-PROD-002 | publicar oferta con geolocalización y campos obligatorios", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const producer = await findProducerByOrgSubstring(page, request, token!, "Corpoángeles");
    expect(producer, "Debe existir el productor ancla Corpoángeles sembrado en Rionegro").toBeTruthy();

    const res = await request.post(`${API_URL}/api/v1/offers/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        title: "TEST_QA_RIONEGRO Aguacate Hass E2E",
        productName: "Aguacate Hass",
        category: "fruta",
        unit: "kg",
        quantityAvailable: 180,
        priceAmount: 3200,
        currency: "COP",
        availableFrom: new Date().toISOString(),
        availableUntil: new Date(Date.now() + 10 * 86400000).toISOString(),
        municipalityName: producer.municipalityName ?? "Municipio de Rionegro",
        latitude: 6.1550,
        longitude: -75.3738,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.status).toBe("published");
  });

  test("RIO-PROD-003 | oferta sin producerId retorna 400 (validación)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/offers/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { productName: "Oferta inválida sin productor" },
    });
    expect([400, 422]).toContain(res.status());
  });

  test("RIO-PROD-004 | edita su propia oferta (PATCH)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const producer = await findProducerByOrgSubstring(page, request, token!, "Corpoángeles");

    const createRes = await request.post(`${API_URL}/api/v1/offers/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        title: "TEST_QA_RIONEGRO Oferta editable E2E",
        productName: "Mora",
        category: "fruta",
        unit: "kg",
        quantityAvailable: 100,
        priceAmount: 2500,
        currency: "COP",
        availableFrom: new Date().toISOString(),
        municipalityName: producer.municipalityName,
      },
    });
    const created = await createRes.json();

    const patchRes = await request.patch(`${API_URL}/api/v1/offers/${created.data.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { priceAmount: 2700, quantityAvailable: 90 },
    });
    expect(patchRes.status()).toBe(200);
    const patched = await patchRes.json();
    expect(Number(patched.data.priceAmount)).toBe(2700);
  });

  test("RIO-PROD-005 | [seguridad] otro productor del mismo municipio NO puede editar esta oferta (Bug #6 corregido)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const producer = await findProducerByOrgSubstring(page, request, token!, "Corpoángeles");

    const createRes = await request.post(`${API_URL}/api/v1/offers/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        title: "TEST_QA_RIONEGRO Oferta propiedad E2E",
        productName: "Queso campesino",
        category: "lacteo",
        unit: "kg",
        quantityAvailable: 40,
        priceAmount: 9000,
        currency: "COP",
        availableFrom: new Date().toISOString(),
        municipalityName: producer.municipalityName,
      },
    });
    const created = await createRes.json();

    await loginViaAPI(page, RIONEGRO_USERS.producer2.email, RIONEGRO_USERS.producer2.password);
    const token2 = await page.evaluate(() => localStorage.getItem("agrored_token"));

    const patchRes = await request.patch(`${API_URL}/api/v1/offers/${created.data.id}`, {
      headers: { Authorization: `Bearer ${token2}` },
      data: { priceAmount: 1 },
    });

    // Bug #6 corregido: PATCH /api/v1/offers/:id ahora resuelve el productor autenticado
    // (via producerRepository.findByUserId) y compara contra el dueño real de la oferta.
    expect(patchRes.status()).toBe(403);
    const patchBody = await patchRes.json();
    expect(patchBody.error.code).toBe("FORBIDDEN");
  });

  test("RIO-PROD-006 | [seguridad] productor de otro tenant NO puede editar oferta de Rionegro (cross-tenant)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const producer = await findProducerByOrgSubstring(page, request, token!, "Corpoángeles");

    const createRes = await request.post(`${API_URL}/api/v1/offers/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        title: "TEST_QA_RIONEGRO Oferta cross-tenant E2E",
        productName: "Papa criolla",
        category: "tuberculo",
        unit: "kg",
        quantityAvailable: 60,
        priceAmount: 2000,
        currency: "COP",
        availableFrom: new Date().toISOString(),
        municipalityName: producer.municipalityName,
      },
    });
    const created = await createRes.json();

    // BOGOTA tenant producer (existing fixture from tests/e2e/fixtures/users.ts)
    const { USERS } = await import("../fixtures/users");
    await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
    const foreignToken = await page.evaluate(() => localStorage.getItem("agrored_token"));

    const patchRes = await request.patch(`${API_URL}/api/v1/offers/${created.data.id}`, {
      headers: { Authorization: `Bearer ${foreignToken}` },
      data: { priceAmount: 1 },
    });
    expect(patchRes.status()).toBe(404); // tenant isolation -> not found, not leaked
  });

  test("RIO-PROD-007 | reportar incidencia — rol producer autorizado (Bug #8 corregido)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const res = await request.post(`${API_URL}/api/v1/incidents/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        incidentType: "access_blockage",
        severity: "medium",
        title: "TEST_QA_RIONEGRO Reporte de productor",
        description: "Reporte de incidencia por un usuario con rol producer.",
        locationDescription: "Vereda El Tablazo, Rionegro",
        occurredAt: new Date().toISOString(),
        municipalityName: "Municipio de Rionegro",
      },
    });
    // Bug #8 corregido: rbac.ts ahora incluye 'producer' en los roles permitidos para
    // POST /api/v1/incidents (además de admin_municipal, logistics_operator, territorial_analyst).
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.reportedBy ?? null).not.toBeUndefined();
  });

  test("RIO-PROD-009 | reporta desperdicio alimentario con oferta activa -> rescate automático (Bug #12 corregido)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const producer = await findProducerByOrgSubstring(page, request, token!, "Corpoángeles");

    // Asegura que el productor tiene una oferta activa (publicada) para que el rescate
    // automático tenga datos reales de producto/cantidad que enlazar.
    await request.post(`${API_URL}/api/v1/offers/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        title: "TEST_QA_RIONEGRO Excedente para rescate automático E2E",
        productName: "Tomate chonto",
        category: "hortaliza",
        unit: "kg",
        quantityAvailable: 150,
        priceAmount: 1800,
        currency: "COP",
        availableFrom: new Date().toISOString(),
        municipalityName: producer.municipalityName,
      },
    });

    const res = await request.post(`${API_URL}/api/v1/incidents/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        incidentType: "desperdicio_alimentario",
        severity: "high",
        title: "TEST_QA_RIONEGRO Excedente en riesgo de pérdida",
        description: "Producto perecedero sin comprador, riesgo de pérdida en 24h.",
        locationDescription: "Vereda El Tablazo, Rionegro",
        occurredAt: new Date().toISOString(),
        municipalityName: "Municipio de Rionegro",
        affectedPopulation: 30,
        // reportedBy no se envía a propósito: el gateway ahora lo completa con el
        // x-user-id del token (Bug #12), así activateRescueFromIncident puede resolver
        // al productor autenticado sin que el cliente tenga que pasarlo explícitamente.
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();

    // El reportante autenticado (x-user-id del productor) debe resolverse a su registro de
    // productor y activar un rescate real (rescueChannel food_bank) contra su oferta activa.
    expect(body.data.autoRescueActivation?.triggered).toBe(true);
    expect(body.data.autoRescueActivation?.rescueId).toBeTruthy();
  });

  test("RIO-PROD-008 | publica subasta ascendente (vendedor)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const producer = await findProducerByOrgSubstring(page, request, token!, "Corpoángeles");

    const res = await request.post(`${API_URL}/api/v1/auctions/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        productName: "TEST_QA_RIONEGRO Fresa excedente",
        category: "fruta",
        unit: "kg",
        quantityKg: 220,
        harvestDate: new Date(Date.now() - 86400000).toISOString(),
        auctionType: "ascending",
        basePrice: 1500,
        reservePrice: 1100,
        durationMinutes: 120,
        latitude: 6.1550,
        longitude: -75.3738,
        municipalityName: producer.municipalityName,
      },
    });
    expect(res.status()).toBe(201);
  });
});
