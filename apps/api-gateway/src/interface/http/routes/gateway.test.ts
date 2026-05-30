import request from "supertest";
import jwt from "jsonwebtoken";
import { buildApp } from "../../../app.js";

const JWT_SECRET = "test_secret_must_be_at_least_32_characters_long!!";

const testEnv = {
  NODE_ENV: "test" as const,
  API_GATEWAY_PORT: 0,
  API_GATEWAY_CORS_ORIGIN: "*",
  AI_CHAT_SERVICE_URL: "http://localhost:39080",
  JWT_SECRET,
  USER_SERVICE_URL: "http://localhost:39001",
  PRODUCER_SERVICE_URL: "http://localhost:39002",
  OFFER_SERVICE_URL: "http://localhost:39003",
  RESCUE_SERVICE_URL: "http://localhost:39004",
  DEMAND_SERVICE_URL: "http://localhost:39005",
  INVENTORY_SERVICE_URL: "http://localhost:39006",
  LOGISTICS_SERVICE_URL: "http://localhost:39007",
  INCIDENT_SERVICE_URL: "http://localhost:39008",
  ANALYTICS_SERVICE_URL: "http://localhost:39009",
  NOTIFICATION_SERVICE_URL: "http://localhost:39010",
  ML_SERVICE_URL: "http://localhost:39011",
  AUTOMATION_SERVICE_URL: "http://localhost:39012",
  AUCTION_SERVICE_URL: "http://localhost:39013",
  INSTITUTION_SERVICE_URL: "http://localhost:39014",
  POSTGRES_HOST: "localhost",
  POSTGRES_PORT: 5432,
  POSTGRES_DB: "agrored",
  POSTGRES_USER: "777",
  POSTGRES_PASSWORD: "777",
  REDIS_URL: "redis://localhost:6379"
};

describe("API Gateway routes", () => {
  const app = buildApp(testEnv);
  const token = jwt.sign(
    { sub: "u-1", tenantId: "t-1", email: "test@agrored.co", role: "admin" },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  describe("GET /api/v1/catalog/services", () => {
    it("lists all registered services including auctions (public, no auth needed)", async () => {
      const res = await request(app).get("/api/v1/catalog/services");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const keys = res.body.data.map((s: { key: string }) => s.key);
      expect(keys).toContain("users");
      expect(keys).toContain("producers");
      expect(keys).toContain("auctions");
      expect(keys).toContain("institutions");
      expect(keys).toHaveLength(14);
    });

    it("includes auction-service with correct path prefix", async () => {
      const res = await request(app).get("/api/v1/catalog/services");
      const auction = res.body.data.find((s: { key: string }) => s.key === "auctions");

      expect(auction).toBeDefined();
      expect(auction.name).toBe("auction-service");
      expect(auction.pathPrefix).toBe("/api/v1/auctions");
    });
  });

  describe("404 handler", () => {
    it("returns 401 for unauthenticated unknown routes", async () => {
      const res = await request(app).get("/api/v1/unknown-endpoint");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("AUTH_TOKEN_MISSING");
    });

    it("returns 404 for authenticated unknown routes", async () => {
      const res = await request(app)
        .get("/api/v1/unknown-endpoint")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("RESOURCE_NOT_FOUND");
    });
  });

  describe("public auth routes", () => {
    it("allows unauthenticated recover-password route to pass auth middleware", async () => {
      const res = await request(app)
        .post("/api/v1/users/recover-password")
        .send({ email: "seed.bogota.1@agrored.co" });

      // The downstream service is not running in this test, so the expected response
      // is gateway proxy failure (502), but it must not be blocked as 401 by auth middleware.
      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("DOWNSTREAM_SERVICE_UNAVAILABLE");
    });

    it("allows unauthenticated reset-password route to pass auth middleware", async () => {
      const res = await request(app)
        .post("/api/v1/users/reset-password")
        .send({ token: "test-token", newPassword: "StrongPass1!" });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("DOWNSTREAM_SERVICE_UNAVAILABLE");
    });
  });

  describe("GET /health", () => {
    it("reports gateway redis degradation explicitly", async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn(async () => ({ ok: true })) as any;

      try {
        const healthApp = buildApp(testEnv, undefined, undefined, { redis: "degraded" });
        const res = await request(healthApp).get("/health");

        expect(res.status).toBe(503);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe("degraded");
        expect(res.body.data.gatewayDependencies.redis).toBe("degraded");
        expect(res.body.data.dependencies["user-service"]).toBe("ok");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("POST /api/v1/ai-chat", () => {
    it("bridges to the legacy PHP backend using a mapped legacy role token", async () => {
      const aiToken = jwt.sign(
        { sub: "u-ai", tenantId: "t-1", email: "ai@agrored.co", role: "admin_municipal" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );
      const originalFetch = global.fetch;
      const fetchMock = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const forwardedToken = String(init?.headers && "Authorization" in init.headers
          ? (init.headers as Record<string, string>).Authorization
          : "").replace("Bearer ", "");
        const forwardedClaims = jwt.verify(forwardedToken, JWT_SECRET) as jwt.JwtPayload;

        expect(forwardedClaims.role).toBe("ADMIN");

        return new Response(
          JSON.stringify({ success: true, data: { response: "ok" } }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }) as typeof global.fetch;

      global.fetch = fetchMock;

      try {
        const res = await request(app)
          .post("/api/v1/ai-chat")
          .set("Authorization", `Bearer ${aiToken}`)
          .send({ message: "hola", history: [] });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.response).toBe("ok");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("returns a clear 503 when AI chat is not configured", async () => {
      const aiToken = jwt.sign(
        { sub: "u-ai", tenantId: "t-1", email: "ai@agrored.co", role: "admin_municipal" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );
      const noAiApp = buildApp({
        ...testEnv,
        AI_CHAT_SERVICE_URL: undefined
      });

      const res = await request(noAiApp)
        .post("/api/v1/ai-chat")
        .set("Authorization", `Bearer ${aiToken}`)
        .send({ message: "hola", history: [] });

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe("AI_CHAT_NOT_CONFIGURED");
    });
  });
});
