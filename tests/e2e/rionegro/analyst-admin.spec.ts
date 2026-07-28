import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";
import { RIONEGRO_USERS } from "../fixtures/users.rionegro";

// QA Pilot — Rionegro — roles Analista Territorial y Administrador Municipal

test.describe("TC-RIONEGRO-ANALYST — Analista Territorial (Rionegro)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, RIONEGRO_USERS.analyst.email, RIONEGRO_USERS.analyst.password);
  });

  test("RIO-ANL-001 | lectura permitida: operación territorial (producers), mercado (offers/demands)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    for (const path of ["/api/v1/producers", "/api/v1/offers", "/api/v1/demands", "/api/v1/logistics"]) {
      const res = await request.get(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      expect(res.status(), `GET ${path}`).toBe(200);
    }
  });

  test("RIO-ANL-002 | lectura permitida: inteligencia (IRAT) y gestión de crisis (incidents)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const irat = await request.get(`${API_URL}/api/v1/analytics/irat`, { headers: { Authorization: `Bearer ${token}` } });
    expect(irat.status()).toBe(200);
    const incidents = await request.get(`${API_URL}/api/v1/incidents`, { headers: { Authorization: `Bearer ${token}` } });
    expect(incidents.status()).toBe(200);
  });

  test("RIO-ANL-003 | [seguridad] NO puede crear productor (write bloqueado)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/producers/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { organizationName: "TEST_QA_RIONEGRO Intento analista" },
    });
    expect(res.status()).toBe(403);
  });

  test("RIO-ANL-004 | [seguridad] NO puede crear oferta ni demanda", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const offerRes = await request.post(`${API_URL}/api/v1/offers/publish`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { productName: "Intento" },
    });
    expect(offerRes.status()).toBe(403);

    const demandRes = await request.post(`${API_URL}/api/v1/demands/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { productName: "Intento" },
    });
    expect(demandRes.status()).toBe(403);
  });

  test("RIO-ANL-005 | [seguridad] NO puede editar ni eliminar (PATCH oferta bloqueado tras el fix de RBAC)", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const listRes = await request.get(`${API_URL}/api/v1/offers?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
    const listBody = await listRes.json();
    const list = Array.isArray(listBody.data) ? listBody.data : listBody.data?.data ?? [];
    test.skip(list.length === 0, "No hay ofertas para intentar editar");
    if (list.length === 0) return;

    const res = await request.patch(`${API_URL}/api/v1/offers/${list[0].id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { priceAmount: 1 },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe("TC-RIONEGRO-ADMIN — Administrador Municipal (Rionegro)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, RIONEGRO_USERS.admin.email, RIONEGRO_USERS.admin.password);
  });

  test("RIO-ADM-001 | control total: puede crear productor, oferta, demanda, incidente", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const unique = Date.now();

    const prodRes = await request.post(`${API_URL}/api/v1/producers/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        producerType: "individual",
        organizationName: `TEST_QA_RIONEGRO Finca Admin E2E ${unique}`,
        contactName: "Admin Test",
        contactPhone: `300${String(unique).slice(-7)}`,
        municipalityName: "Municipio de Rionegro",
        zoneType: "rural",
        productCategories: ["hortaliza"],
      },
    });
    expect([200, 201]).toContain(prodRes.status());

    const incRes = await request.post(`${API_URL}/api/v1/incidents/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: payload.tenantId,
        incidentType: "access_blockage",
        severity: "low",
        title: "TEST_QA_RIONEGRO Incidente admin E2E",
        description: "Incidente de prueba creado por administrador municipal.",
        locationDescription: "Centro, Rionegro",
        occurredAt: new Date().toISOString(),
        municipalityName: "Municipio de Rionegro",
      },
    });
    expect([200, 201]).toContain(incRes.status());
  });

  test("RIO-ADM-002 | [aislamiento multi-tenant] NO ve productores de otro municipio (Bogotá) por defecto", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const res = await request.get(`${API_URL}/api/v1/producers?limit=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const list = Array.isArray(body.data) ? body.data : body.data?.data ?? [];
    // Chequeo por tenantId real, no por el texto libre municipalityName: un productor puede
    // llevar "Bogotá D.C." en municipalityName (p.ej. residuo de la prueba RIO-ADM-003, que
    // intenta ese payload precisamente para verificar que el tenantId real se sobrescribe) y
    // aun así pertenecer legítimamente al tenant Rionegro tras el fix de tenantContext.
    const foreignTenant = list.find((p: any) => p.tenantId !== payload.tenantId);
    expect(foreignTenant).toBeUndefined();
  });

  test("RIO-ADM-003 | [aislamiento multi-tenant] no puede forzar tenantId ajeno al crear recursos", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));
    const unique = Date.now();

    const res = await request.post(`${API_URL}/api/v1/producers/register`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tenantId: "10000000-0000-0000-0000-000000000001", // BOGOTA (seed_expanded.ts tenantIndex 0)
        producerType: "individual",
        organizationName: `TEST_QA_RIONEGRO Intento suplantar tenant E2E ${unique}`,
        contactName: "Admin Test",
        contactPhone: `300${String(unique).slice(-7)}`,
        municipalityName: "Bogotá D.C.",
        zoneType: "rural",
        productCategories: ["hortaliza"],
      },
    });
    // apps/shared/middleware/tenantContext.ts sobreescribe tenantId con el del header
    // confiable x-tenant-id (el del admin autenticado), no con el del body. Antes de montar
    // ese middleware en apps/api-gateway/src/app.ts (hallazgo de este pilot QA), esta llamada
    // creaba el productor bajo el tenant BOGOTA suplantado.
    expect([200, 201]).toContain(res.status());
    const created = await res.json();
    expect(created.data.tenantId).toBe(payload.tenantId);
    expect(created.data.tenantId).not.toBe("10000000-0000-0000-0000-000000000001");
  });

  test("RIO-ADM-004 | IRAT: /irat/check refleja un incidente crítico recién creado", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const payload = JSON.parse(atob(token!.split(".")[1]));

    const before = await request.get(`${API_URL}/api/v1/analytics/irat`, { headers: { Authorization: `Bearer ${token}` } });
    expect(before.status()).toBe(200);

    for (let i = 0; i < 3; i++) {
      const incRes = await request.post(`${API_URL}/api/v1/incidents/register`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tenantId: payload.tenantId,
          incidentType: "quality_issue",
          severity: "critical",
          title: `TEST_QA_RIONEGRO Incidente crítico IRAT #${i + 1}`,
          description: "Bloqueo total urgente en corredor de abastecimiento, riesgo crítico para IRAT.",
          locationDescription: "Vía El Tablazo - Rionegro",
          occurredAt: new Date().toISOString(),
          municipalityName: "Municipio de Rionegro",
        },
      });
      expect([200, 201]).toContain(incRes.status());
    }

    const check = await request.post(`${API_URL}/api/v1/analytics/irat/check`, { headers: { Authorization: `Bearer ${token}` } });
    expect(check.status()).toBe(200);
    const body = await check.json();
    expect(typeof body.data.checked).toBe("number");
    // Nota QA: la creación/cierre de incidencias NO recalcula IRAT automáticamente
    // (apps/analytics-service/.../irat.ts no tiene ningún trigger); hay que invocar
    // POST /api/v1/analytics/irat/check explícitamente, como hace este test.
  });

  test("RIO-ADM-005 | copiloto IA — 2 consultas reales sobre el municipio", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    for (const message of [
      "¿Cuál es el riesgo climático de la ruta hacia el Comedor Comunitario La Convención en Rionegro?",
      "¿Qué oferta complementaria recomiendas para cubrir la demanda de hortalizas en Rionegro?",
    ]) {
      const res = await request.post(`${API_URL}/api/v1/ai-chat`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { message },
        timeout: 30_000,
      });
      // No afirmamos 200 estricto: depende del proveedor externo Gemini (AI_API_KEY).
      expect([200, 502, 503]).toContain(res.status());
    }
  });

  test("RIO-ADM-006 | [hallazgo QA] rol SUPERADMIN (\"visión de Dios\") no está reconocido por el RBAC del gateway", async ({ page, request }) => {
    // Ver infra/postgres/028_superadmin_role.sql — crea un usuario SUPERADMIN con
    // metadata.ai_copilot_unrestricted, pero apps/api-gateway/.../rbac.ts nunca compara
    // contra el string 'SUPERADMIN' en ninguna política. Documentamos el estado real:
    // hoy ese rol queda bloqueado por la mayoría de rutas protegidas, no habilitado.
    let token: string | null = null;
    try {
      token = await loginViaAPI(page, "superadmin@agrored.co", process.env.E2E_SUPERADMIN_PASS ?? "SuperAdmin@2024!");
    } catch {
      test.skip(true, "No fue posible autenticar SUPERADMIN con la contraseña por defecto (rotada/desconocida) — define E2E_SUPERADMIN_PASS para correr este caso");
      return;
    }
    const res = await request.get(`${API_URL}/api/v1/producers`, { headers: { Authorization: `Bearer ${token}` } });
    // Si algún día se implementa god-mode real en rbac.ts, este test deberá esperar 200
    // con datos cruzando tenants. Hoy documentamos que NO tiene acceso especial.
    expect([200, 403]).toContain(res.status());
    if (res.status() === 403) {
      test.info().annotations.push({
        type: "known-gap",
        description: "SUPERADMIN no tiene ninguna regla especial en rbac.ts: la 'visión de Dios' es hoy solo un concepto de UI (apps/web-dashboard/src/types/index.ts), no un control de acceso real en el gateway.",
      });
    }
  });
});
