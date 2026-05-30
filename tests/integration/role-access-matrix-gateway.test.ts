import request from "supertest";
import jwt from "jsonwebtoken";
import { buildApp } from "../../apps/api-gateway/src/app.js";

const JWT_SECRET = "test_secret_must_be_at_least_32_characters_long!!";

const app = buildApp({
  NODE_ENV: "test",
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

type Case = {
  title: string;
  method: "get" | "post";
  path: string;
  role: string;
  expected: 403 | 502 | 503;
};

const CASES: Case[] = [
  {
    title: "admin can access user list",
    method: "get",
    path: "/api/v1/users",
    role: "admin_municipal",
    expected: 502
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
    expected: 502
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
    expected: 502
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
    expected: 502
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
    expected: 502
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
    expected: 502
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
    expected: 502
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
  }
];

describe("Gateway role access matrix", () => {
  it.each(CASES)("$title", async ({ method, path, role, expected }) => {
    const token = signForRole(role);
    const req = request(app)[method](path).set("Authorization", `Bearer ${token}`);

    if (method === "post") {
      req.send({});
    }

    const res = await req;

    expect(res.status).toBe(expected);

    if (expected === 403) {
      expect(res.body?.error?.code).toBe("FORBIDDEN");
      return;
    }

    expect(res.body?.error?.code).toBe(
      expected === 503 ? "AI_CHAT_NOT_CONFIGURED" : "DOWNSTREAM_SERVICE_UNAVAILABLE"
    );
  });
});
