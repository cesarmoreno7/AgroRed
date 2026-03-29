import { Router } from "express";
import { z } from "zod";
import { RegisterLogisticsOrder } from "../../../application/use-cases/RegisterLogisticsOrder.js";
import type { LogisticsOrder } from "../../../domain/entities/LogisticsOrder.js";
import type { LogisticsOrderRepository } from "../../../domain/ports/LogisticsOrderRepository.js";
import { ROUTE_MODES } from "../../../domain/value-objects/RouteMode.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

const registerLogisticsOrderSchema = z.object({
  tenantId: z.string().min(1),
  inventoryItemId: z.string().uuid(),
  demandId: z.string().uuid().optional().nullable(),
  routeMode: z.enum(ROUTE_MODES),
  originLocationName: z.string().min(3),
  destinationOrganizationName: z.string().min(3),
  destinationAddress: z.string().min(5),
  scheduledPickupAt: z.coerce.date(),
  scheduledDeliveryAt: z.coerce.date(),
  quantityAssigned: z.coerce.number().positive(),
  municipalityName: z.string().min(3),
  notes: z.string().max(500).optional().nullable(),
  originLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  originLongitude: z.coerce.number().min(-180).max(180).optional().nullable(),
  destinationLatitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  destinationLongitude: z.coerce.number().min(-180).max(180).optional().nullable()
});

function toLogisticsResponse(order: LogisticsOrder) {
  return {
    id: order.id,
    tenantId: order.tenantId,
    inventoryItemId: order.inventoryItemId,
    demandId: order.demandId,
    routeMode: order.routeMode,
    originLocationName: order.originLocationName,
    destinationOrganizationName: order.destinationOrganizationName,
    destinationAddress: order.destinationAddress,
    scheduledPickupAt: order.scheduledPickupAt.toISOString(),
    scheduledDeliveryAt: order.scheduledDeliveryAt.toISOString(),
    quantityAssigned: order.quantityAssigned,
    municipalityName: order.municipalityName,
    notes: order.notes,
    status: order.status,
    originLatitude: order.originLatitude,
    originLongitude: order.originLongitude,
    destinationLatitude: order.destinationLatitude,
    destinationLongitude: order.destinationLongitude,
    createdAt: order.createdAt.toISOString()
  };
}

export function createLogisticsRouter(repository: LogisticsOrderRepository): Router {
  const router = Router();
  const registerLogisticsOrder = new RegisterLogisticsOrder(repository);

  router.post("/api/v1/logistics/register", asyncHandler(async (req, res) => {
    const parsed = registerLogisticsOrderSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_LOGISTICS_PAYLOAD", "Payload invalido para registro logistico.");
    }

    try {
      const order = await registerLogisticsOrder.execute(parsed.data);
      return sendSuccess(res, toLogisticsResponse(order), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }

      if (error instanceof Error && error.message === "INVENTORY_ITEM_NOT_FOUND_FOR_TENANT") {
        return sendError(res, 404, "INVENTORY_ITEM_NOT_FOUND_FOR_TENANT", "El lote de inventario no existe para el municipio indicado.");
      }

      if (error instanceof Error && error.message === "DEMAND_NOT_FOUND_FOR_TENANT") {
        return sendError(res, 404, "DEMAND_NOT_FOUND_FOR_TENANT", "La demanda asociada no existe para el municipio indicado.");
      }

      if (error instanceof Error && error.message === "INSUFFICIENT_INVENTORY_AVAILABLE") {
        return sendError(res, 400, "INSUFFICIENT_INVENTORY_AVAILABLE", "La cantidad asignada supera el inventario disponible para despacho.");
      }

      if (error instanceof Error && error.message === "INVALID_LOGISTICS_SCHEDULE") {
        return sendError(res, 400, "INVALID_LOGISTICS_SCHEDULE", "La ventana de recogida y entrega no es valida.");
      }

      return sendError(res, 500, "LOGISTICS_REGISTRATION_FAILED", "No fue posible registrar la entrega logistica.");
    }
  }));

  router.get("/api/v1/logistics", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const result = await repository.list({ page, limit }, tenantId ?? null);
    return sendPaginatedSuccess(res, result.data.map(toLogisticsOrderResponse), { total: result.total, page: result.page, limit: result.limit });
  }));

  router.get("/api/v1/logistics/:id", asyncHandler(async (req, res) => {
    const order = await repository.findById(String(req.params.id));

    if (!order) {
      return sendError(res, 404, "LOGISTICS_ORDER_NOT_FOUND", "Orden logistica no encontrada.");
    }

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && order.tenantId !== tenantId) {
      return sendError(res, 404, "LOGISTICS_ORDER_NOT_FOUND", "Operacion logistica no encontrada.");
    }

    return sendSuccess(res, toLogisticsResponse(order));
  }));

  return router;
}