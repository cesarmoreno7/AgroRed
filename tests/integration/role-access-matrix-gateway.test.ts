import request from "supertest";
import jwt from "jsonwebtoken";
import type { Express } from "express";
import { buildApp } from "../../apps/api-gateway/src/app.js";

const JWT_SECRET = "test_secret_must_be_at_least_32_characters_long!!";

const testEnv = {
  NODE_ENV: "test" as const,
  API_GATEWAY_PORT: 0,
  API_GATEWAY_CORS_ORIGIN: "*",
  AI_CHAT_SERVICE_URL: undefined,
  JWT_SECRET,
  USER_SERVICE_URL: "http://127.0.0.1:39001",
  PRODUCER_SERVICE_URL: "http://127.0.0.1:39002",
  OFFER_SERVICE_URL: "http://127.0.0.1:39003",
  RESCUE_SERVICE_URL: "http://127.0.0.1:39004",
  DEMAND_SERVICE_URL: "http://127.0.0.1:39005",
  INVENTORY_SERVICE_URL: "http://127.0.0.1:39006",
  LOGISTICS_SERVICE_URL: "http://127.0.0.1:39007",
  INCIDENT_SERVICE_URL: "http://127.0.0.1:39008",
  ANALYTICS_SERVICE_URL: "http://127.0.0.1:39009",
  NOTIFICATION_SERVICE_URL: "http://127.0.0.1:39010",
  ML_SERVICE_URL: "http://127.0.0.1:39011",
  AUTOMATION_SERVICE_URL: "http://127.0.0.1:39012",
  AUCTION_SERVICE_URL: "http://127.0.0.1:39013",
  REDIS_URL: "redis://127.0.0.1:6379",
  POSTGRES_HOST: "127.0.0.1",
  POSTGRES_PORT: 5432,
  POSTGRES_DB: "agrored",
  POSTGRES_USER: "777",
  POSTGRES_PASSWORD: "777"
};

let app: Express;

beforeAll(async () => {
  app = await buildApp(testEnv);
});

function signForRole(role: string): string {
  return jwt.sign(
    {
      sub: `user-${role}`,
      tenantId: "tenant-test",
      email: `${role}@agrored.co`,
      role
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

// `expected: 404` means "RBAC let the request through to route dispatch" — this
// fixture builds the app without a Pool, so the monolith's business routers never
// mount (see the `if (pool)` guard in app.ts) and a request that clears RBAC lands
// on the catch-all 404 handler instead of a real business response. `403` still
// means RBAC blocked it outright, and `503` is the AI chat bridge's own
// "not configured" response (mounted unconditionally, unaffected by the Pool gap).
type Case = {
  title: string;
  method: "get" | "post" | "patch";
  path: string;
  role: string;
  expected: 403 | 404 | 503;
};

const CASES: Case[] = [
  {
    title: "admin can access user list",
    method: "get",
    path: "/api/v1/users",
    role: "admin_municipal",
    expected: 404
  },
  {
    title: "producer cannot access user list",
    method: "get",
    path: "/api/v1/users",
    role: "producer",
    expected: 403
  },
  {
    title: "producer can publish offers",
    method: "post",
    path: "/api/v1/offers",
    role: "producer",
    expected: 404
  },
  {
    title: "community kitchen cannot publish offers",
    method: "post",
    path: "/api/v1/offers",
    role: "community_kitchen",
    expected: 403
  },
  {
    title: "community kitchen can create demand",
    method: "post",
    path: "/api/v1/demands",
    role: "community_kitchen",
    expected: 404
  },
  {
    title: "producer cannot create demand",
    method: "post",
    path: "/api/v1/demands",
    role: "producer",
    expected: 403
  },
  {
    title: "logistics operator can create logistics order",
    method: "post",
    path: "/api/v1/logistics",
    role: "logistics_operator",
    expected: 404
  },
  {
    title: "producer cannot create logistics order",
    method: "post",
    path: "/api/v1/logistics",
    role: "producer",
    expected: 403
  },
  {
    title: "territorial analyst can read analytics",
    method: "get",
    path: "/api/v1/analytics",
    role: "territorial_analyst",
    expected: 404
  },
  {
    title: "monitoring agent cannot read analytics",
    method: "get",
    path: "/api/v1/analytics",
    role: "monitoring_agent",
    expected: 403
  },
  {
    title: "supermarket cannot read analytics summary",
    method: "get",
    path: "/api/v1/analytics",
    role: "supermarket",
    expected: 403
  },
  {
    title: "community kitchen can bid in auction",
    method: "post",
    path: "/api/v1/auctions/auction-1/bid",
    role: "community_kitchen",
    expected: 404
  },
  {
    title: "producer cannot bid in auction",
    method: "post",
    path: "/api/v1/auctions/auction-1/bid",
    role: "producer",
    expected: 403
  },
  {
    title: "admin can close auction",
    method: "post",
    path: "/api/v1/auctions/auction-1/close",
    role: "admin_municipal",
    expected: 404
  },
  {
    title: "territorial analyst reaches AI chat bridge and gets configuration error instead of RBAC denial",
    method: "post",
    path: "/api/v1/ai-chat",
    role: "territorial_analyst",
    expected: 503
  },
  {
    title: "monitoring agent cannot access AI chat bridge",
    method: "post",
    path: "/api/v1/ai-chat",
    role: "monitoring_agent",
    expected: 403
  },
  {
    title: "logistics operator cannot close auction",
    method: "post",
    path: "/api/v1/auctions/auction-1/close",
    role: "logistics_operator",
    expected: 403
  },

  // ── PAE oversight ──
  { title: "supervisor_departamental can list PAE inspections", method: "get", path: "/api/v1/pae/inspections", role: "supervisor_departamental", expected: 404 },
  { title: "supervisor_departamental can record a random audit", method: "post", path: "/api/v1/pae/audits", role: "supervisor_departamental", expected: 404 },
  { title: "supervisor_departamental cannot apply a sanction", method: "patch", path: "/api/v1/pae/sanctions/x/apply", role: "supervisor_departamental", expected: 403 },
  { title: "admin_municipal can respond a requerimiento", method: "patch", path: "/api/v1/pae/requerimientos/x/respond", role: "admin_municipal", expected: 404 },
  { title: "producer cannot record a PAE inspection", method: "post", path: "/api/v1/pae/inspections", role: "producer", expected: 403 },
  { title: "community_kitchen cannot list requerimientos", method: "get", path: "/api/v1/pae/requerimientos", role: "community_kitchen", expected: 403 },
  { title: "monitoring_agent cannot read the PAE panel", method: "get", path: "/api/v1/pae", role: "monitoring_agent", expected: 403 },
  { title: "supervisor_departamental stays narrow (no offers)", method: "post", path: "/api/v1/offers", role: "supervisor_departamental", expected: 403 }
];

describe("Gateway role access matrix", () => {
  it.each(CASES)("$title", async ({ method, path, role, expected }) => {
    const token = signForRole(role);
    const req = request(app)[method](path).set("Authorization", `Bearer ${token}`);

    if (method === "post" || method === "patch") {
      req.send({});
    }

    const res = await req;

    expect(res.status).toBe(expected);

    if (expected === 403) {
      expect(res.body?.error?.code).toBe("FORBIDDEN");
      return;
    }

    expect(res.body?.error?.code).toBe(
      expected === 503 ? "AI_CHAT_NOT_CONFIGURED" : "RESOURCE_NOT_FOUND"
    );
  });

  it("public CAE form skips auth (404, not 401) — GET", async () => {
    const res = await request(app).get("/api/v1/pae/cae/public/anytoken");
    expect(res.status).toBe(404);
    expect(res.body?.error?.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("public CAE form skips auth (404, not 401) — POST", async () => {
    const res = await request(app).post("/api/v1/pae/cae/public/anytoken").send({});
    expect(res.status).toBe(404);
    expect(res.body?.error?.code).toBe("RESOURCE_NOT_FOUND");
  });
});
