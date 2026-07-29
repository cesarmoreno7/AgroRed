import type { NextFunction, Request, Response } from "express";
import { rbacMiddleware } from "./rbac.js";

type MockedResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
};

function createReq(path: string, method = "POST", role?: string): Request {
  return {
    path,
    method,
    headers: role ? { "x-user-role": role } : {}
  } as unknown as Request;
}

function createRes(): MockedResponse {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json } as unknown as MockedResponse;
}

describe("rbacMiddleware dynamic route matching", () => {
  it("allows community_kitchen to bid on auctions with id path", () => {
    const req = createReq("/api/v1/auctions/abc123/bid", "POST", "community_kitchen");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("denies producer for admin-only close auction endpoint", () => {
    const req = createReq("/api/v1/auctions/abc123/close", "POST", "producer");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "FORBIDDEN" })
      })
    );
  });

  it("still allows producer on generic create auction endpoint", () => {
    const req = createReq("/api/v1/auctions", "POST", "producer");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows logistics_operator to create logistics orders", () => {
    const req = createReq("/api/v1/logistics", "POST", "logistics_operator");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("denies producer to create logistics orders", () => {
    const req = createReq("/api/v1/logistics", "POST", "producer");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows territorial_analyst to register incidents", () => {
    const req = createReq("/api/v1/incidents", "POST", "territorial_analyst");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("denies community_kitchen to register incidents", () => {
    const req = createReq("/api/v1/incidents", "POST", "community_kitchen");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows producer to report incidents (Bug #8)", () => {
    const req = createReq("/api/v1/incidents", "POST", "producer");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows supermarket to read auctions (Bug #7)", () => {
    const req = createReq("/api/v1/auctions", "GET", "supermarket");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows supermarket to bid on auctions (Bug #7)", () => {
    const req = createReq("/api/v1/auctions/abc123/bid", "POST", "supermarket");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows supermarket to accept a dutch-auction price (Bug #7)", () => {
    const req = createReq("/api/v1/auctions/abc123/accept-dutch", "POST", "supermarket");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("grants SUPERADMIN cross-tenant read access on every module (Bug #9)", () => {
    const readRoutes: Array<[string, string]> = [
      ["/api/v1/producers", "GET"],
      ["/api/v1/users", "GET"],
      ["/api/v1/inventory", "GET"],
      ["/api/v1/rescues", "GET"],
      ["/api/v1/institutions", "GET"],
      ["/api/v1/offers", "GET"],
      ["/api/v1/demands", "GET"],
      ["/api/v1/logistics", "GET"],
      ["/api/v1/incidents", "GET"],
      ["/api/v1/audit", "GET"]
    ];

    for (const [path, method] of readRoutes) {
      const req = createReq(path, method, "SUPERADMIN");
      const res = createRes();
      const next: NextFunction = jest.fn();

      rbacMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    }
  });

  it("keeps SUPERADMIN out of write operations — monitoring only, not operating tenants", () => {
    const req = createReq("/api/v1/logistics", "POST", "SUPERADMIN");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("skips RBAC when role header is missing", () => {
    const req = createReq("/api/v1/incidents", "POST");
    const res = createRes();
    const next: NextFunction = jest.fn();

    rbacMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
