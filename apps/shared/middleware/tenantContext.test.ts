import type { Request } from "express";
import { isGodViewRole, resolveTenantFilter, auditGodViewAccess, getTenantId } from "./tenantContext.js";

function createReq(headers: Record<string, string>): Request {
  return { headers, originalUrl: "/api/v1/producers", method: "GET" } as unknown as Request;
}

describe("tenantContext god-view helpers (Bug #9)", () => {
  it("does not treat ordinary roles as god-view", () => {
    expect(isGodViewRole(createReq({ "x-user-role": "admin_municipal" }))).toBe(false);
    expect(isGodViewRole(createReq({}))).toBe(false);
  });

  it("recognizes SUPERADMIN as god-view", () => {
    expect(isGodViewRole(createReq({ "x-user-role": "SUPERADMIN" }))).toBe(true);
  });

  it("resolveTenantFilter scopes ordinary roles to their own tenant", () => {
    const req = createReq({ "x-user-role": "admin_municipal", "x-tenant-id": "t-1" });
    expect(resolveTenantFilter(req)).toBe("t-1");
    expect(getTenantId(req)).toBe("t-1");
  });

  it("resolveTenantFilter returns null (cross-tenant) for SUPERADMIN regardless of its own tenant header", () => {
    const req = createReq({ "x-user-role": "SUPERADMIN", "x-tenant-id": "system-tenant" });
    expect(resolveTenantFilter(req)).toBeNull();
  });

  it("auditGodViewAccess is a no-op for ordinary roles even with a logger present", async () => {
    const auditLogger = jest.fn(async () => undefined);
    const req = createReq({ "x-user-role": "admin_municipal" });

    await auditGodViewAccess(req, auditLogger, { serviceName: "producer-service", entityName: "producers" });

    expect(auditLogger).not.toHaveBeenCalled();
  });

  it("auditGodViewAccess logs a cross_tenant_read event for SUPERADMIN", async () => {
    const auditLogger = jest.fn(async () => undefined);
    const req = createReq({ "x-user-role": "SUPERADMIN", "x-user-id": "superadmin-1" });

    await auditGodViewAccess(req, auditLogger, { serviceName: "producer-service", entityName: "producers" });

    expect(auditLogger).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: null,
      serviceName: "producer-service",
      entityName: "producers",
      actionName: "godview.cross_tenant_read",
      actorId: "superadmin-1"
    }));
  });

  it("auditGodViewAccess silently skips when no logger is wired", async () => {
    const req = createReq({ "x-user-role": "SUPERADMIN" });
    await expect(auditGodViewAccess(req, undefined, { serviceName: "x", entityName: "y" })).resolves.toBeUndefined();
  });
});
