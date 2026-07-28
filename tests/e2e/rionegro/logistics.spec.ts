import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { API_URL } from "../fixtures/users";
import { RIONEGRO_USERS } from "../fixtures/users.rionegro";

// QA Pilot — Rionegro — rol Operador Logístico

test.describe("TC-RIONEGRO-LOG — Operador Logístico (Rionegro)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, RIONEGRO_USERS.logistics.email, RIONEGRO_USERS.logistics.password);
  });

  test("RIO-LOG-001 | ve las órdenes logísticas asignadas del municipio", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/logistics?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const list = Array.isArray(body.data) ? body.data : body.data?.data ?? [];
    expect(list.length).toBeGreaterThan(0); // seed_rionegro_pilot.ts crea 2 órdenes base
  });

  test("RIO-LOG-002 | acepta/inicia ruta (scheduled -> in_transit)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const listRes = await request.get(`${API_URL}/api/v1/logistics?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listBody = await listRes.json();
    const list = Array.isArray(listBody.data) ? listBody.data : listBody.data?.data ?? [];
    const order = list.find((o: any) => o.status === "scheduled");
    test.skip(!order, "No hay ninguna orden en estado 'scheduled' para iniciar ruta");
    if (!order) return;

    const res = await request.patch(`${API_URL}/api/v1/logistics/${order.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: "in_transit" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("in_transit");
  });

  test("RIO-LOG-003 | actualiza estado en tránsito (simulando GPS) y confirma entrega", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));

    // Registrar una orden nueva sobre un inventario/institución real sembrados en Rionegro.
    const invRes = await request.get(`${API_URL}/api/v1/inventory?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const invBody = await invRes.json();
    const invList = Array.isArray(invBody.data) ? invBody.data : invBody.data?.data ?? [];
    const invItem = invList.find((i: any) => i.status === "available" || i.quantityOnHand > 0);
    test.skip(!invItem, "No hay inventario disponible en Rionegro para crear la orden");
    if (!invItem) return;

    const payload = JSON.parse(atob(token!.split(".")[1]));
    const createRes = await request.post(`${API_URL}/api/v1/logistics/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        inventoryItemId: invItem.id,
        routeMode: "municipal_fleet",
        originLocationName: "Centro de acopio TEST_QA_RIONEGRO",
        destinationOrganizationName: "TEST_QA_RIONEGRO ESE Hospital San Juan de Dios de Rionegro",
        destinationAddress: "Cra 50 # 45-10, Rionegro",
        scheduledPickupAt: new Date(Date.now() + 3600_000).toISOString(),
        scheduledDeliveryAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
        quantityAssigned: 20,
        municipalityName: "Municipio de Rionegro",
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    const transitRes = await request.patch(`${API_URL}/api/v1/logistics/${created.data.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: "in_transit" },
    });
    expect(transitRes.status()).toBe(200);

    const deliveredRes = await request.patch(`${API_URL}/api/v1/logistics/${created.data.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: "delivered" },
    });
    expect(deliveredRes.status()).toBe(200);
    const delivered = await deliveredRes.json();
    expect(delivered.data.status).toBe("delivered");
  });

  test("RIO-LOG-004 | reprograma ruta ante incidencia (gestión de crisis)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const listRes = await request.get(`${API_URL}/api/v1/logistics?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listBody = await listRes.json();
    const list = Array.isArray(listBody.data) ? listBody.data : listBody.data?.data ?? [];
    const order = list[0];
    test.skip(!order, "No hay órdenes logísticas para reprogramar");
    if (!order) return;

    const res = await request.patch(`${API_URL}/api/v1/logistics/${order.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        notes: "TEST_QA_RIONEGRO Reprogramada por bloqueo vial vía El Tablazo (incidencia crítica).",
        scheduledDeliveryAt: new Date(Date.now() + 5 * 3600_000).toISOString(),
      },
    });
    expect(res.status()).toBe(200);
  });

  test("RIO-LOG-005 | producer NO puede ver /api/v1/logistics (403)", async ({ page, request }) => {
    await loginViaAPI(page, RIONEGRO_USERS.producer.email, RIONEGRO_USERS.producer.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/logistics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(403);
  });
});
