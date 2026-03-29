import { Router } from "express";
import { z } from "zod";
import { RegisterDemand } from "../../../application/use-cases/RegisterDemand.js";
import type { Demand } from "../../../domain/entities/Demand.js";
import type { DemandRepository } from "../../../domain/ports/DemandRepository.js";
import { DEMAND_CHANNELS } from "../../../domain/value-objects/DemandChannel.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

const registerDemandSchema = z.object({
  tenantId: z.string().min(1),
  responsibleUserId: z.string().uuid().optional().nullable(),
  demandChannel: z.enum(DEMAND_CHANNELS),
  organizationName: z.string().min(3),
  productName: z.string().min(2),
  category: z.string().min(2),
  unit: z.string().min(1),
  quantityRequired: z.coerce.number().positive(),
  neededBy: z.coerce.date(),
  beneficiaryCount: z.coerce.number().int().positive(),
  municipalityName: z.string().min(3),
  notes: z.string().max(500).optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable()
});

function toDemandResponse(demand: Demand) {
  return {
    id: demand.id,
    tenantId: demand.tenantId,
    responsibleUserId: demand.responsibleUserId,
    demandChannel: demand.demandChannel,
    organizationName: demand.organizationName,
    productName: demand.productName,
    category: demand.category,
    unit: demand.unit,
    quantityRequired: demand.quantityRequired,
    neededBy: demand.neededBy.toISOString(),
    beneficiaryCount: demand.beneficiaryCount,
    municipalityName: demand.municipalityName,
    notes: demand.notes,
    status: demand.status,
    latitude: demand.latitude,
    longitude: demand.longitude,
    createdAt: demand.createdAt.toISOString()
  };
}

export function createDemandsRouter(repository: DemandRepository): Router {
  const router = Router();
  const registerDemand = new RegisterDemand(repository);

  router.post("/api/v1/demands/register", asyncHandler(async (req, res) => {
    const parsed = registerDemandSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_DEMAND_PAYLOAD", "Payload invalido para registro de demanda.");
    }

    try {
      const demand = await registerDemand.execute(parsed.data);
      return sendSuccess(res, toDemandResponse(demand), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }

      if (error instanceof Error && error.message === "USER_NOT_FOUND_FOR_TENANT") {
        return sendError(
          res,
          404,
          "USER_NOT_FOUND_FOR_TENANT",
          "El usuario responsable no existe para el municipio indicado."
        );
      }

      if (error instanceof Error && error.message === "INVALID_DEMAND_NEEDED_BY") {
        return sendError(
          res,
          400,
          "INVALID_DEMAND_NEEDED_BY",
          "La fecha requerida de la demanda no es valida."
        );
      }

      return sendError(
        res,
        500,
        "DEMAND_REGISTRATION_FAILED",
        "No fue posible registrar la demanda institucional."
      );
    }
  }));

  router.get("/api/v1/demands", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const result = await repository.list({ page, limit }, tenantId ?? null);
    return sendPaginatedSuccess(res, result.data.map(toDemandResponse), { total: result.total, page: result.page, limit: result.limit });
  }));

  router.get("/api/v1/demands/:id", asyncHandler(async (req, res) => {
    const demand = await repository.findById(String(req.params.id));

    if (!demand) {
      return sendError(res, 404, "DEMAND_NOT_FOUND", "Demanda no encontrada.");
    }

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && demand.tenantId !== tenantId) {
      return sendError(res, 404, "DEMAND_NOT_FOUND", "Demanda no encontrada.");
    }

    return sendSuccess(res, toDemandResponse(demand));
  }));

  return router;
}
