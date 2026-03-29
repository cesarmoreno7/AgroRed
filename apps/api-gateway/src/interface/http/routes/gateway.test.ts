import request from "supertest";
import jwt from "jsonwebtoken";
import { buildApp } from "../../../app.js";

const JWT_SECRET = "test_secret_must_be_at_least_32_characters_long!!";

const testEnv = {
  NODE_ENV: "test" as const,
  API_GATEWAY_PORT: 0,
  API_GATEWAY_CORS_ORIGIN: "*",
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
      expect(keys).toHaveLength(13);
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
});
