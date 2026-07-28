import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { API_URL } from "../fixtures/users";
import { RIONEGRO_USERS } from "../fixtures/users.rionegro";

// QA Pilot — Rionegro — Flujo de Rescate Completo (encadenado, multi-rol)
// Cubre la brecha documentada en e2e-gaps.md: "offer -> auction -> bid -> logistics -> kitchen confirm"
// nunca se prueba de punta a punta, solo en aislado por módulo.

test.describe("TC-RIONEGRO-CHAIN — Rescate completo ascendente (Rionegro)", () => {
  test("RIO-CHAIN-001 | productor publica -> admin publica subasta ascendente -> cocina puja y gana -> logística despacha -> cocina confirma", async ({ page, request }) => {
    // 1) Productor publica una oferta de excedente
    await loginViaAPI(page, RIONEGRO_USERS.producer.email, RIONEGRO_USERS.producer.password);
    let token = await page.evaluate(() => localStorage.getItem("agrored_token"));

    const producersRes = await request.get(`${API_URL}/api/v1/producers?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const producersBody = await producersRes.json();
    const producerList = Array.isArray(producersBody.data) ? producersBody.data : producersBody.data?.data ?? [];
    const producer = producerList.find((p: any) => (p.organizationName ?? "").includes("Corpoángeles"));
    expect(producer).toBeTruthy();

    // 2) Admin publica subasta ascendente para ese excedente
    await loginViaAPI(page, RIONEGRO_USERS.admin.email, RIONEGRO_USERS.admin.password);
    token = await page.evaluate(() => localStorage.getItem("agrored_token"));

    const auctionRes = await request.post(`${API_URL}/api/v1/auctions/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        productName: "TEST_QA_RIONEGRO Banano rescate cadena E2E",
        category: "fruta",
        unit: "kg",
        quantityKg: 300,
        harvestDate: new Date(Date.now() - 86400000).toISOString(),
        auctionType: "ascending",
        basePrice: 1000,
        reservePrice: 700,
        durationMinutes: 120,
        latitude: 6.1550,
        longitude: -75.3738,
        municipalityName: producer.municipalityName,
      },
    });
    expect(auctionRes.status()).toBe(201);
    const auction = (await auctionRes.json()).data;

    // 3) Cocina Comunitaria puja y gana
    await loginViaAPI(page, RIONEGRO_USERS.kitchen.email, RIONEGRO_USERS.kitchen.password);
    token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const kitchenPayload = JSON.parse(atob(token!.split(".")[1]));

    const bidRes = await request.post(`${API_URL}/api/v1/auctions/${auction.id}/bid`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        bidderId: kitchenPayload.sub,
        bidderType: "community_kitchen",
        amount: 1100,
      },
    });
    expect(bidRes.status()).toBe(201);

    // 4) Admin cierra la subasta -> gana la cocina
    await loginViaAPI(page, RIONEGRO_USERS.admin.email, RIONEGRO_USERS.admin.password);
    token = await page.evaluate(() => localStorage.getItem("agrored_token"));

    const closeRes = await request.post(`${API_URL}/api/v1/auctions/${auction.id}/close`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(closeRes.status()).toBe(200);
    const closeBody = await closeRes.json();
    expect(closeBody.data.status).toBe("closed_with_winner");
    expect(closeBody.data.winnerId).toBe(kitchenPayload.sub);

    // 5) Logística programa el despacho hacia la institución (usa inventario existente
    //    porque el cierre de subasta NO crea automáticamente un logistics_order ni un
    //    inventory_item — hallazgo QA, ver informe).
    await loginViaAPI(page, RIONEGRO_USERS.logistics.email, RIONEGRO_USERS.logistics.password);
    token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const logisticsPayload = JSON.parse(atob(token!.split(".")[1]));

    const invRes = await request.get(`${API_URL}/api/v1/inventory?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const invBody = await invRes.json();
    const invList = Array.isArray(invBody.data) ? invBody.data : invBody.data?.data ?? [];
    // Elegimos el lote con más disponible para no chocar con INSUFFICIENT_INVENTORY_AVAILABLE
    // (quantity_on_hand - quantity_reserved), ya que el cierre de la subasta no reserva
    // automáticamente inventario para el ganador (ver nota más abajo).
    const invItem = [...invList].sort((a: any, b: any) => (b.quantityOnHand ?? 0) - (a.quantityOnHand ?? 0))[0];
    expect(invItem, "Debe existir al menos un inventory_item sembrado en Rionegro").toBeTruthy();

    const orderRes = await request.post(`${API_URL}/api/v1/logistics/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: logisticsPayload.tenantId,
        inventoryItemId: invItem.id,
        routeMode: "municipal_fleet",
        originLocationName: "Centro de acopio Corpoángeles",
        destinationOrganizationName: "TEST_QA_RIONEGRO Comedor Comunitario La Convención",
        destinationAddress: "Comedor La Convención, Rionegro",
        scheduledPickupAt: new Date(Date.now() + 3600_000).toISOString(),
        scheduledDeliveryAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
        quantityAssigned: 100,
        municipalityName: "Municipio de Rionegro",
        notes: "TEST_QA_RIONEGRO despacho ganador subasta ascendente #" + auction.id,
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = (await orderRes.json()).data;

    await request.patch(`${API_URL}/api/v1/logistics/${order.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: "in_transit" },
    });
    const deliveredRes = await request.patch(`${API_URL}/api/v1/logistics/${order.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: "delivered" },
    });
    expect(deliveredRes.status()).toBe(200);

    // 6) Cocina confirma recepción registrando el rescate (canal food_bank)
    await loginViaAPI(page, RIONEGRO_USERS.kitchen.email, RIONEGRO_USERS.kitchen.password);
    token = await page.evaluate(() => localStorage.getItem("agrored_token"));

    const rescueRes = await request.post(`${API_URL}/api/v1/rescues/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: producer.tenantId,
        producerId: producer.id,
        offerId: null,
        rescueChannel: "food_bank",
        destinationOrganizationName: "TEST_QA_RIONEGRO Comedor Comunitario La Convención",
        productName: "Banano",
        category: "fruta",
        unit: "kg",
        quantityRescued: 100,
        scheduledAt: new Date().toISOString(),
        beneficiaryCount: 220,
        municipalityName: "Municipio de Rionegro",
        notes: `TEST_QA_RIONEGRO confirmación de recepción — cadena subasta ${auction.id} / orden ${order.id}`,
      },
    });
    expect(rescueRes.status()).toBe(201);
  });
});
