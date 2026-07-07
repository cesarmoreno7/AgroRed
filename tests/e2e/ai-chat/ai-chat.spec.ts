import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../utils/auth";
import { USERS, API_URL } from "../fixtures/users";

test.describe("TC-AI — Copiloto IA", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, USERS.admin.email, USERS.admin.password);
  });

  // TC-AI-001
  test("TC-AI-001 | página /ai-copilot carga sin errores críticos", async ({ page }) => {
    await page.goto("/ai-copilot");
    await page.waitForLoadState("networkidle");
    const bodyText = await page.textContent("body");
    expect(bodyText).not.toMatch(/Cannot GET|Error 500|404 Not Found/);
    const visible = await page.locator("body > *").first().isVisible();
    expect(visible).toBe(true);
  });

  // TC-AI-002
  test("TC-AI-002 | API: POST /api/v1/ai-chat sin 'message' retorna 400", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/ai-chat`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  // TC-AI-003
  test("TC-AI-003 | producer NO puede usar /api/v1/ai-chat (403)", async ({ page, request }) => {
    await loginViaAPI(page, USERS.producer.email, USERS.producer.password);
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/ai-chat`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { message: "hola" },
    });
    expect(res.status()).toBe(403);
  });

  // TC-AI-004
  test("TC-AI-004 | sin token → 401 en /api/v1/ai-chat", async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/ai-chat`, {
      data: { message: "hola" },
    });
    expect(res.status()).toBe(401);
  });

  // TC-AI-005
  test("TC-AI-005 | admin con mensaje válido no retorna error de validación ni de RBAC", async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem("agrored_token"));
    const res = await request.post(`${API_URL}/api/v1/ai-chat`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { message: "¿Cuántos productores hay registrados?" },
      timeout: 30_000,
    });
    // No afirmamos 200 estricto: depende de un proveedor LLM externo (Gemini) configurado
    // vía AI_API_KEY. Lo que sí debe cumplirse siempre es que pasó validación (400) y RBAC (403).
    expect([200, 502, 503]).toContain(res.status());
  });
});
