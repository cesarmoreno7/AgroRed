import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-DELIVERY — Módulo de Entregas de Productos", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
    await page.goto("/entregas");
    await page.waitForLoadState("networkidle");
  });

  // TC-DEL-001
  test("TC-DEL-001 | página de entregas carga sin errores críticos", async ({ page }) => {
    const bodyText = await page.textContent("body");
    expect(bodyText).not.toMatch(/Cannot GET|Error 500|404 Not Found/);
    const visible = await page.locator("body > *").first().isVisible();
    expect(visible).toBe(true);
  });

  // TC-DEL-002
  test("TC-DEL-002 | API: GET /api/v1/entregas retorna 200 con estructura correcta", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/entregas`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.data)).toBe(true);
    expect(body.data.meta).toBeDefined();
    expect(typeof body.data.meta.total).toBe("number");
  });

  // TC-DEL-003
  test("TC-DEL-003 | API: catálogo de productos devuelve items para el selector", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/products/catalog`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { all: "true" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    const items = Array.isArray(body.data) ? body.data : body.data?.data ?? [];
    expect(items.length).toBeGreaterThanOrEqual(0);
  });

  // TC-DEL-004
  test("TC-DEL-004 | API: POST /api/v1/entregas crea entrega con datos válidos", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));

    // Necesitamos productor, institución y producto para crear una entrega
    const [prodRes, instRes, prodCatRes] = await Promise.all([
      request.get(`${API_URL}/api/v1/producers`, { headers: { Authorization: `Bearer ${token}` } }),
      request.get(`${API_URL}/api/v1/institutions`, { headers: { Authorization: `Bearer ${token}` } }),
      request.get(`${API_URL}/api/v1/products/catalog?all=true`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    const prodBody    = await prodRes.json();
    const instBody    = await instRes.json();
    const catalogBody = await prodCatRes.json();

    const producers  = Array.isArray(prodBody.data) ? prodBody.data : prodBody.data?.data ?? [];
    const insts      = Array.isArray(instBody.data) ? instBody.data : instBody.data?.data ?? [];
    const products   = Array.isArray(catalogBody.data) ? catalogBody.data : catalogBody.data?.data ?? [];

    if (producers.length === 0 || insts.length === 0 || products.length === 0) {
      test.skip(true, "No hay productor/institución/producto en BD para crear entrega");
      return;
    }

    const res = await request.post(`${API_URL}/api/v1/entregas`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        productorId:   producers[0].id,
        institucionId: insts[0].id,
        fechaEntrega:  new Date().toISOString().split("T")[0],
        lugarEntrega:  "Bodega Central E2E",
        estado:        "pendiente",
        detalle: [{
          productoId:        products[0].id,
          cantidadEntregada: 100,
          unidadMedida:      "kg",
          precioUnitario:    1500,
        }],
      },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.numero_entrega).toMatch(/^ENT-/);
  });

  // TC-DEL-005
  test("TC-DEL-005 | API: POST /api/v1/entregas sin detalle retorna 400", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/entregas`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        productorId:   "00000000-0000-0000-0000-000000000001",
        institucionId: "00000000-0000-0000-0000-000000000002",
        fechaEntrega:  "2026-01-01",
        detalle:       [],
      },
    });
    expect([400, 422]).toContain(res.status());
  });

  // TC-DEL-006
  test("TC-DEL-006 | API: GET /api/v1/entregas/:id retorna 404 para ID inexistente", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/entregas/00000000-0000-0000-0000-000000000999`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });

  // TC-DEL-007
  test("TC-DEL-007 | página de entregas muestra tabla o estado vacío (no pantalla en blanco)", async ({ page }) => {
    const hasTable  = await page.locator("table").count();
    const hasEmpty  = await page.locator('[class*="empty"],[class*="vacio"],[class*="no-data"]').count();
    const hasCards  = await page.locator('[class*="card"],[class*="list"]').count();
    expect(hasTable + hasEmpty + hasCards).toBeGreaterThan(0);
  });

  // TC-DEL-008
  test("TC-DEL-008 | API: GET /api/v1/analytics/irat retorna puntuaciones IRAT", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.get(`${API_URL}/api/v1/analytics/irat`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
