import { Router } from "express";
import { z } from "zod";
import { RegisterRescue } from "../../../application/use-cases/RegisterRescue.js";
import type { Rescue } from "../../../domain/entities/Rescue.js";
import type { RescueRepository } from "../../../domain/ports/RescueRepository.js";
import type { AuditLogger } from "../../../shared/audit.js";
import { RESCUE_CHANNELS } from "../../../domain/value-objects/RescueChannel.js";
import type { EventBus } from "../../../../../shared/redis/EventBus.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

const registerRescueSchema = z.object({
  tenantId: z.string().min(1),
  producerId: z.string().uuid(),
  offerId: z.string().uuid().optional().nullable(),
  originId: z.string().uuid().optional().nullable(),
  rescueChannel: z.enum(RESCUE_CHANNELS),
  destinationOrganizationName: z.string().min(3),
  productName: z.string().min(2),
  category: z.string().min(2),
  unit: z.string().min(1),
  quantityRescued: z.coerce.number().positive(),
  scheduledAt: z.coerce.date(),
  beneficiaryCount: z.coerce.number().int().positive(),
  municipalityName: z.string().min(3),
  notes: z.string().max(500).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable()
});

function toRescueResponse(rescue: Rescue) {
  return {
    id: rescue.id,
    tenantId: rescue.tenantId,
    producerId: rescue.producerId,
    offerId: rescue.offerId,
    originId: rescue.originId,
    rescueChannel: rescue.rescueChannel,
    destinationOrganizationName: rescue.destinationOrganizationName,
    productName: rescue.productName,
    category: rescue.category,
    unit: rescue.unit,
    quantityRescued: rescue.quantityRescued,
    scheduledAt: rescue.scheduledAt.toISOString(),
    beneficiaryCount: rescue.beneficiaryCount,
    municipalityName: rescue.municipalityName,
    notes: rescue.notes,
    status: rescue.status,
    latitude: rescue.latitude,
    longitude: rescue.longitude,
    createdAt: rescue.createdAt.toISOString()
  };
}

export function createRescuesRouter(
  repository: RescueRepository,
  eventBus: EventBus | null = null,
  auditLogger?: AuditLogger
): Router {
  const router = Router();
  const registerRescue = new RegisterRescue(repository);

  router.post("/api/v1/rescues/register", asyncHandler(async (req, res) => {
    const parsed = registerRescueSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_RESCUE_PAYLOAD", "Payload invalido para registro de rescate.");
    }

    const rescue = await registerRescue.execute(parsed.data);

    if (auditLogger) {
      await auditLogger({
        tenantId: rescue.tenantId,
        serviceName: "rescue-service",
        entityName: "rescues",
        entityId: rescue.id,
        actionName: "rescue.registered",
        actorId: typeof req.headers["x-user-id"] === "string" ? req.headers["x-user-id"] : rescue.producerId,
        correlationId: typeof req.headers["x-correlation-id"] === "string" ? req.headers["x-correlation-id"] : undefined,
        payload: {
          producerId: rescue.producerId,
          offerId: rescue.offerId,
          productName: rescue.productName,
          quantityRescued: rescue.quantityRescued,
          municipalityName: rescue.municipalityName,
          status: rescue.status
        }
      });
    }

    if (eventBus) {
      void eventBus.publish("rescue.created", {
        type: "rescue.created",
        tenantId: rescue.tenantId,
        data: { rescueId: rescue.id, producerId: rescue.producerId, offerId: rescue.offerId ?? undefined, productName: rescue.productName, quantityRescued: rescue.quantityRescued, municipalityName: rescue.municipalityName },
        timestamp: new Date().toISOString(),
        source: "rescue-service"
      }).catch(() => { /* non-blocking */ });
    }

    return sendSuccess(res, toRescueResponse(rescue), 201);
  }));

  router.get("/api/v1/rescues", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const result = await repository.list({ page, limit }, tenantId ?? null);
    return sendPaginatedSuccess(res, result.data.map(toRescueResponse), { total: result.total, page: result.page, limit: result.limit });
  }));

  router.get("/api/v1/rescues/:id", asyncHandler(async (req, res) => {
    const rescue = await repository.findById(String(req.params.id));

    if (!rescue) {
      return sendError(res, 404, "RESCUE_NOT_FOUND", "Rescate no encontrado.");
    }

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && rescue.tenantId !== tenantId) {
      return sendError(res, 404, "RESCUE_NOT_FOUND", "Rescate no encontrado.");
    }

    return sendSuccess(res, toRescueResponse(rescue));
  }));

  router.patch("/api/v1/rescues/:id", asyncHandler(async (req, res) => {
    const existing = await repository.findById(String(req.params.id));
    if (!existing) return sendError(res, 404, "RESCUE_NOT_FOUND", "Rescate no encontrado.");
    const updated = await repository.patch(String(req.params.id), req.body as Record<string, unknown>);
    if (!updated) return sendError(res, 404, "RESCUE_NOT_FOUND", "Rescate no encontrado.");
    return sendSuccess(res, toRescueResponse(updated));
  }));

  // ── Food Origins CRUD ────────────────────────────────────────

  const originSchema = z.object({
    tenantId: z.string().min(1),
    name: z.string().min(2),
    municipalityName: z.string().min(3),
    address: z.string().nullable().optional(),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  });

  const updateOriginSchema = z.object({
    name: z.string().min(2).optional(),
    municipalityName: z.string().min(3).optional(),
    address: z.string().nullable().optional(),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    isActive: z.boolean().optional(),
  }).refine(d => Object.keys(d).length > 0, { message: "Al menos un campo requerido." });

  router.post("/api/v1/rescues/origins", asyncHandler(async (req, res) => {
    const parsed = originSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "INVALID_ORIGIN_PAYLOAD", "Payload inválido para origen de alimentos.");
    try {
      const origin = await repository.saveOrigin(parsed.data);
      return sendSuccess(res, origin, 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Tenant no encontrado.");
      }
      return sendError(res, 500, "ORIGIN_CREATION_FAILED", "No fue posible registrar el origen.");
    }
  }));

  router.get("/api/v1/rescues/origins", asyncHandler(async (req, res) => {
    try {
      const origins = await repository.listOrigins();
      return sendSuccess(res, origins);
    } catch (error) {
      return sendError(res, 500, "ORIGINS_LIST_FAILED", "No fue posible listar orígenes.");
    }
  }));

  router.patch("/api/v1/rescues/origins/:id", asyncHandler(async (req, res) => {
    const parsed = updateOriginSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "INVALID_ORIGIN_PAYLOAD", "Payload inválido.");
    const updated = await repository.updateOrigin(String(req.params.id), parsed.data);
    if (!updated) return sendError(res, 404, "ORIGIN_NOT_FOUND", "Origen no encontrado.");
    return sendSuccess(res, updated);
  }));

  router.delete("/api/v1/rescues/origins/:id", asyncHandler(async (req, res) => {
    const deleted = await repository.deleteOrigin(String(req.params.id));
    if (!deleted) return sendError(res, 404, "ORIGIN_NOT_FOUND", "Origen no encontrado.");
    return res.status(204).send();
  }));

  return router;
}