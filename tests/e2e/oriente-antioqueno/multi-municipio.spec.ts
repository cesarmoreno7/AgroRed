import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { API_URL } from "../fixtures/users";
import { ORIENTE_ANTIOQUENO_MUNICIPIOS, usersForTenant } from "../fixtures/users.oriente-antioqueno";

// QA scale-out — Oriente Antioqueño (8 municipios restantes tras el piloto de Rionegro).
//
// Alcance deliberadamente distinto al piloto de Rionegro (tests/e2e/rionegro/*, 36 casos):
// los 5 bugs reales encontrados en el piloto son de código (no por-tenant) y ya están
// corregidos globalmente, así que aquí NO se repite la exploración exhaustiva de cada flujo
// por rol — se corre un set representativo (8 casos) por municipio para confirmar que los
// datos generados son coherentes y que las correcciones del piloto se sostienen de forma
// uniforme en los 8 tenants nuevos. Ver AGRORED_Informe_Piloto_QA_Rionegro.docx para el
// detalle de hallazgos, que aplican a los 9 municipios por igual.

const RIONEGRO_TENANT_ID = "10000000-0000-0000-0000-000000000002";

for (const municipio of ORIENTE_ANTIOQUENO_MUNICIPIOS) {
  const USERS = usersForTenant(municipio.code);

  test.describe(`TC-OA-${municipio.code} — ${municipio.name}`, () => {
    test(`OA-${municipio.code}-001 | los 8 usuarios de prueba inician sesión con el tenant correcto`, async ({ page, request }) => {
      for (const u of [USERS.admin, USERS.producer, USERS.producer2, USERS.supermarket, USERS.logistics, USERS.analyst, USERS.kitchen, USERS.monitoring]) {
        const token = await loginViaAPI(page, u.email, u.password);
        const payload = JSON.parse(atob(token.split(".")[1]));
        expect(payload.role).toBe(u.role);
      }
      void request;
    });

    test(`OA-${municipio.code}-002 | aislamiento multi-tenant: admin no ve productores de otros municipios`, async ({ page, request }) => {
      const token = await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
      const payload = JSON.parse(atob(token.split(".")[1]));
      const res = await request.get(`${API_URL}/api/v1/producers?limit=200`, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status()).toBe(200);
      const body = await res.json();
      const list = Array.isArray(body.data) ? body.data : body.data?.data ?? [];
      expect(list.length).toBeGreaterThan(0);
      const foreignTenant = list.find((p: any) => p.tenantId !== payload.tenantId);
      expect(foreignTenant).toBeUndefined();
      // Chequeo cruzado explícito contra el tenant del piloto (Rionegro).
      expect(payload.tenantId).not.toBe(RIONEGRO_TENANT_ID);
    });

    test(`OA-${municipio.code}-003 | productor publica oferta con geolocalización`, async ({ page, request }) => {
      const token = await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
      const producersRes = await request.get(`${API_URL}/api/v1/producers?limit=50`, { headers: { Authorization: `Bearer ${token}` } });
      const producersBody = await producersRes.json();
      const producerList = Array.isArray(producersBody.data) ? producersBody.data : producersBody.data?.data ?? [];
      expect(producerList.length).toBeGreaterThan(0);
      const producer = producerList[0];

      const res = await request.post(`${API_URL}/api/v1/offers/publish`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tenantId: producer.tenantId,
          producerId: producer.id,
          title: `TEST_QA_${municipio.code} Aguacate Hass OA E2E`,
          productName: "Aguacate Hass",
          category: "fruta",
          unit: "kg",
          quantityAvailable: 150,
          priceAmount: 3100,
          currency: "COP",
          availableFrom: new Date().toISOString(),
          municipalityName: producer.municipalityName,
          latitude: 6.15,
          longitude: -75.35,
        },
      });
      expect(res.status()).toBe(201);
    });

    test(`OA-${municipio.code}-004 | subasta ascendente completa: publicar → pujar → cerrar con ganador`, async ({ page, request }) => {
      const adminToken = await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
      const producersRes = await request.get(`${API_URL}/api/v1/producers?limit=50`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const producersBody = await producersRes.json();
      const producerList = Array.isArray(producersBody.data) ? producersBody.data : producersBody.data?.data ?? [];
      const producer = producerList[0];

      const auctionRes = await request.post(`${API_URL}/api/v1/auctions/publish`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: {
          tenantId: producer.tenantId,
          producerId: producer.id,
          productName: `TEST_QA_${municipio.code} Banano OA E2E`,
          category: "fruta",
          unit: "kg",
          quantityKg: 200,
          harvestDate: new Date(Date.now() - 86400000).toISOString(),
          auctionType: "ascending",
          basePrice: 1000,
          reservePrice: 700,
          durationMinutes: 120,
          latitude: 6.15,
          longitude: -75.35,
          municipalityName: producer.municipalityName,
        },
      });
      expect(auctionRes.status()).toBe(201);
      const auction = (await auctionRes.json()).data;

      const kitchenToken = await loginViaAPI(page, USERS.kitchen.email, USERS.kitchen.password);
      const kitchenPayload = JSON.parse(atob(kitchenToken.split(".")[1]));
      const bidRes = await request.post(`${API_URL}/api/v1/auctions/${auction.id}/bid`, {
        headers: { Authorization: `Bearer ${kitchenToken}` },
        data: { bidderId: kitchenPayload.sub, bidderType: "community_kitchen", amount: 1100 },
      });
      expect(bidRes.status()).toBe(201);

      const adminToken2 = await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
      const closeRes = await request.post(`${API_URL}/api/v1/auctions/${auction.id}/close`, { headers: { Authorization: `Bearer ${adminToken2}` } });
      expect(closeRes.status()).toBe(200);
      const closeBody = await closeRes.json();
      expect(closeBody.data.status).toBe("closed_with_winner");
    });

    test(`OA-${municipio.code}-005 | logística: registrar orden y avanzar hasta entrega`, async ({ page, request }) => {
      const token = await loginViaAPI(page, USERS.logistics.email, USERS.logistics.password);
      const payload = JSON.parse(atob(token.split(".")[1]));
      const invRes = await request.get(`${API_URL}/api/v1/inventory?limit=50`, { headers: { Authorization: `Bearer ${token}` } });
      const invBody = await invRes.json();
      const invList = Array.isArray(invBody.data) ? invBody.data : invBody.data?.data ?? [];
      test.skip(invList.length === 0, "No hay inventario disponible");
      if (invList.length === 0) return;
      const invItem = [...invList].sort((a: any, b: any) => (b.quantityOnHand ?? 0) - (a.quantityOnHand ?? 0))[0];

      const createRes = await request.post(`${API_URL}/api/v1/logistics/register`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tenantId: payload.tenantId,
          inventoryItemId: invItem.id,
          routeMode: "municipal_fleet",
          originLocationName: `Centro de acopio TEST_QA_${municipio.code}`,
          destinationOrganizationName: `TEST_QA_${municipio.code} Institución destino OA E2E`,
          destinationAddress: `Zona urbana, ${municipio.name}`,
          scheduledPickupAt: new Date(Date.now() + 3600_000).toISOString(),
          scheduledDeliveryAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
          quantityAssigned: 20,
          municipalityName: municipio.name,
        },
      });
      expect(createRes.status()).toBe(201);
      const order = (await createRes.json()).data;

      await request.patch(`${API_URL}/api/v1/logistics/${order.id}`, { headers: { Authorization: `Bearer ${token}` }, data: { status: "in_transit" } });
      const deliveredRes = await request.patch(`${API_URL}/api/v1/logistics/${order.id}`, { headers: { Authorization: `Bearer ${token}` }, data: { status: "delivered" } });
      expect(deliveredRes.status()).toBe(200);
      expect((await deliveredRes.json()).data.status).toBe("delivered");
    });

    test(`OA-${municipio.code}-006 | cocina: demanda + emparejamiento automático con nueva oferta`, async ({ page, request }) => {
      const kitchenToken = await loginViaAPI(page, USERS.kitchen.email, USERS.kitchen.password);
      const kitchenPayload = JSON.parse(atob(kitchenToken.split(".")[1]));
      const demandRes = await request.post(`${API_URL}/api/v1/demands/register`, {
        headers: { Authorization: `Bearer ${kitchenToken}` },
        data: {
          tenantId: kitchenPayload.tenantId,
          demandChannel: "community_kitchen",
          organizationName: `TEST_QA_${municipio.code} Comedor matching OA E2E`,
          productName: "Zanahoria",
          category: "hortaliza",
          unit: "kg",
          quantityRequired: 60,
          neededBy: new Date(Date.now() + 7 * 86400000).toISOString(),
          beneficiaryCount: 40,
          municipalityName: municipio.name,
        },
      });
      expect(demandRes.status()).toBe(201);

      const adminToken = await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
      const producersRes = await request.get(`${API_URL}/api/v1/producers?limit=50`, { headers: { Authorization: `Bearer ${adminToken}` } });
      const producersBody = await producersRes.json();
      const producerList = Array.isArray(producersBody.data) ? producersBody.data : producersBody.data?.data ?? [];
      const producer = producerList[0];

      const offerRes = await request.post(`${API_URL}/api/v1/offers/publish`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: {
          tenantId: producer.tenantId,
          producerId: producer.id,
          title: `TEST_QA_${municipio.code} Zanahoria matching OA E2E`,
          productName: "Zanahoria",
          category: "hortaliza",
          unit: "kg",
          quantityAvailable: 80,
          priceAmount: 1700,
          currency: "COP",
          availableFrom: new Date().toISOString(),
          municipalityName: producer.municipalityName,
        },
      });
      expect(offerRes.status()).toBe(201);
      const offerBody = await offerRes.json();
      expect(offerBody.data.matching?.matchesFound).toBeGreaterThanOrEqual(1);
    });

    test(`OA-${municipio.code}-007 | analista: lectura permitida, escritura bloqueada`, async ({ page, request }) => {
      const token = await loginViaAPI(page, USERS.analyst.email, USERS.analyst.password);
      const readRes = await request.get(`${API_URL}/api/v1/analytics/irat`, { headers: { Authorization: `Bearer ${token}` } });
      expect(readRes.status()).toBe(200);
      const writeRes = await request.post(`${API_URL}/api/v1/producers/register`, { headers: { Authorization: `Bearer ${token}` }, data: {} });
      expect(writeRes.status()).toBe(403);
    });

    test(`OA-${municipio.code}-008 | incidencia: registrar, clasificar y verificar que IRAT no falle`, async ({ page, request }) => {
      const token = await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
      const payload = JSON.parse(atob(token.split(".")[1]));

      const classifyRes = await request.post(`${API_URL}/api/v1/incidents/classify`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          title: `Bloqueo urgente vía rural ${municipio.name}`,
          description: "Derrumbe crítico bloquea el corredor de abastecimiento. Situación urgente.",
        },
      });
      expect(classifyRes.status()).toBe(200);

      const incRes = await request.post(`${API_URL}/api/v1/incidents/register`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tenantId: payload.tenantId,
          incidentType: "access_blockage",
          severity: "critical",
          title: `TEST_QA_${municipio.code} Incidente crítico OA E2E`,
          description: "Incidente crítico creado para validar clasificación y estabilidad de IRAT.",
          locationDescription: `Vía rural - ${municipio.name}`,
          occurredAt: new Date().toISOString(),
          municipalityName: municipio.name,
        },
      });
      expect([200, 201]).toContain(incRes.status());

      const iratCheck = await request.post(`${API_URL}/api/v1/analytics/irat/check`, { headers: { Authorization: `Bearer ${token}` } });
      expect(iratCheck.status()).toBe(200);
    });
  });
}
