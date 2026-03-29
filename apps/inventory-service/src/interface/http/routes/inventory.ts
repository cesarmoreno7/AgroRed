import { Router } from "express";
import { z } from "zod";
import { RegisterInventoryItem } from "../../../application/use-cases/RegisterInventoryItem.js";
import { ImportNearExpiryItems } from "../../../application/use-cases/ImportNearExpiryItems.js";
import type { InventoryItem } from "../../../domain/entities/InventoryItem.js";
import type { InventoryItemRepository } from "../../../domain/ports/InventoryItemRepository.js";
import { INVENTORY_SOURCE_TYPES } from "../../../domain/value-objects/InventorySourceType.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

const registerInventoryItemSchema = z.object({
  tenantId: z.string().min(1),
  producerId: z.string().uuid(),
  offerId: z.string().uuid().optional().nullable(),
  rescueId: z.string().uuid().optional().nullable(),
  sourceType: z.enum(INVENTORY_SOURCE_TYPES),
  storageLocationName: z.string().min(3),
  productName: z.string().min(2),
  category: z.string().min(2),
  unit: z.string().min(1),
  quantityOnHand: z.coerce.number().positive(),
  quantityReserved: z.coerce.number().nonnegative().optional(),
  municipalityName: z.string().min(3),
  notes: z.string().max(500).optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable()
});

function toInventoryResponse(item: InventoryItem) {
  return {
    id: item.id,
    tenantId: item.tenantId,
    producerId: item.producerId,
    offerId: item.offerId,
    rescueId: item.rescueId,
    sourceType: item.sourceType,
    storageLocationName: item.storageLocationName,
    productName: item.productName,
    category: item.category,
    unit: item.unit,
    quantityOnHand: item.quantityOnHand,
    quantityReserved: item.quantityReserved,
    municipalityName: item.municipalityName,
    notes: item.notes,
    expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null,
    status: item.status,
    latitude: item.latitude,
    longitude: item.longitude,
    createdAt: item.createdAt.toISOString()
  };
}

export function createInventoryRouter(repository: InventoryItemRepository): Router {
  const router = Router();
  const registerInventoryItem = new RegisterInventoryItem(repository);

  router.post("/api/v1/inventory/register", asyncHandler(async (req, res) => {
    const parsed = registerInventoryItemSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, "INVALID_INVENTORY_PAYLOAD", "Payload invalido para registro de inventario.");
    }

    try {
      const item = await registerInventoryItem.execute(parsed.data);
      return sendSuccess(res, toInventoryResponse(item), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }

      if (error instanceof Error && error.message === "PRODUCER_NOT_FOUND_FOR_TENANT") {
        return sendError(res, 404, "PRODUCER_NOT_FOUND_FOR_TENANT", "El productor no existe para el municipio indicado.");
      }

      if (error instanceof Error && error.message === "OFFER_NOT_FOUND_FOR_PRODUCER") {
        return sendError(res, 404, "OFFER_NOT_FOUND_FOR_PRODUCER", "La oferta asociada no existe para el productor y municipio indicados.");
      }

      if (error instanceof Error && error.message === "RESCUE_NOT_FOUND_FOR_SOURCE") {
        return sendError(res, 404, "RESCUE_NOT_FOUND_FOR_SOURCE", "El rescate asociado no existe para el productor y municipio indicados.");
      }

      if (error instanceof Error && error.message === "INVALID_INVENTORY_SOURCE_LINK") {
        return sendError(res, 400, "INVALID_INVENTORY_SOURCE_LINK", "El tipo de origen exige una referencia valida a oferta o rescate.");
      }

      if (error instanceof Error && error.message === "INVALID_INVENTORY_QUANTITY_BALANCE") {
        return sendError(res, 400, "INVALID_INVENTORY_QUANTITY_BALANCE", "La reserva no puede ser negativa ni superar el stock disponible.");
      }

      return sendError(res, 500, "INVENTORY_REGISTRATION_FAILED", "No fue posible registrar el inventario operativo.");
    }
  }));

  router.get("/api/v1/inventory", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const result = await repository.list({ page, limit }, tenantId ?? null);
    return sendPaginatedSuccess(res, result.data.map(toInventoryResponse), { total: result.total, page: result.page, limit: result.limit });
  }));

  router.get("/api/v1/inventory/:id", asyncHandler(async (req, res) => {
    const item = await repository.findById(String(req.params.id));

    if (!item) {
      return sendError(res, 404, "INVENTORY_ITEM_NOT_FOUND", "Registro de inventario no encontrado.");
    }

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && item.tenantId !== tenantId) {
      return sendError(res, 404, "INVENTORY_ITEM_NOT_FOUND", "Registro de inventario no encontrado.");
    }

    return sendSuccess(res, toInventoryResponse(item));
  }));

  /* ---------------------------------------------------------------- */
  /*  CSV bulk import — alimentos próximos a vencer                    */
  /* ---------------------------------------------------------------- */

  const csvImportSchema = z.object({
    tenantId: z.string().min(1),
    producerId: z.string().uuid(),
    municipalityName: z.string().min(3),
    csvText: z.string().min(10, "El CSV debe contener al menos encabezados y una fila de datos.")
  });

  router.post("/api/v1/inventory/import/csv", asyncHandler(async (req, res) => {
    const parsed = csvImportSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_CSV_PAYLOAD", "Payload inválido para importación CSV.");
    }

    const importUseCase = new ImportNearExpiryItems(repository);
    try {
      const result = await importUseCase.execute(
        parsed.data.csvText,
        parsed.data.tenantId,
        parsed.data.producerId,
        parsed.data.municipalityName
      );
      const status = result.errorCount > 0 && result.successCount === 0 ? 422 : 200;
      return sendSuccess(res, {
        importId: result.importId,
        totalRows: result.totalRows,
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errors,
        items: result.items.map(toInventoryResponse)
      }, status);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "CSV_IMPORT_FAILED", "No fue posible procesar la importación CSV.");
    }
  }));

  /* ---------------------------------------------------------------- */
  /*  Consulta: alimentos próximos a vencer                            */
  /* ---------------------------------------------------------------- */

  router.get("/api/v1/inventory/near-expiry/:tenantId", asyncHandler(async (req, res) => {
    const tenantId = String(req.params.tenantId);
    const daysAhead = Math.min(365, Math.max(1, parseInt(String(req.query.days ?? "7"), 10) || 7));
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));

    try {
      const result = await repository.listNearExpiry(tenantId, daysAhead, { page, limit });
      return sendPaginatedSuccess(res, result.data.map(toInventoryResponse), {
        total: result.total,
        page: result.page,
        limit: result.limit
      });
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "NEAR_EXPIRY_QUERY_FAILED", "No fue posible consultar alimentos próximos a vencer.");
    }
  }));

  return router;
}