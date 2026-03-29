import { Router } from "express";
import { z } from "zod";
import { RegisterRescue } from "../../../application/use-cases/RegisterRescue.js";
import type { Rescue } from "../../../domain/entities/Rescue.js";
import type { RescueRepository } from "../../../domain/ports/RescueRepository.js";
import { RESCUE_CHANNELS } from "../../../domain/value-objects/RescueChannel.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

const registerRescueSchema = z.object({
  tenantId: z.string().min(1),
  producerId: z.string().uuid(),
  offerId: z.string().uuid().optional().nullable(),
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

export function createRescuesRouter(repository: RescueRepository): Router {
  const router = Router();
  const registerRescue = new RegisterRescue(repository);

  router.post("/api/v1/rescues/register", asyncHandler(async (req, res) => {
    const parsed = registerRescueSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_RESCUE_PAYLOAD", "Payload invalido para registro de rescate.");
    }

    const rescue = await registerRescue.execute(parsed.data);
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

  return router;
}