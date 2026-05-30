import express from "express";
import request from "supertest";
import { createAuditTrailMiddleware } from "./auditTrail.js";

describe("createAuditTrailMiddleware", () => {
  it("writes an audit record for successful mutating business routes", async () => {
    const query = jest.fn(async () => ({ rows: [] }));
    const app = express();

    app.use(express.json());
    app.use((req, _res, next) => {
      req.correlationId = "corr-123";
      req.headers["x-user-id"] = "user-1";
      req.headers["x-tenant-id"] = "tenant-1";
      next();
    });
    app.use(createAuditTrailMiddleware({ query } as any));
    app.post("/api/v1/offers", (_req, res) => {
      res.status(201).json({ success: true });
    });

    const res = await request(app)
      .post("/api/v1/offers")
      .send({ password: "secret", title: "Oferta de prueba" });

    expect(res.status).toBe(201);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1][0]).toBe("tenant-1");
    expect(query.mock.calls[0][1][1]).toBe("offer-service");
    expect(query.mock.calls[0][1][4]).toBe("post:root");
    expect(query.mock.calls[0][1][6]).toContain("[redacted]");
  });
});