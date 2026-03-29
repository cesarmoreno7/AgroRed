import { Router } from "express";
import { z } from "zod";
import { RegisterProducer } from "../../../application/use-cases/RegisterProducer.js";
import { ImportProducers } from "../../../application/use-cases/ImportProducers.js";
import type { Producer } from "../../../domain/entities/Producer.js";
import type { ProducerRepository } from "../../../domain/ports/ProducerRepository.js";
import {
  PRODUCER_TYPES,
  PRODUCER_ZONES
} from "../../../domain/value-objects/ProducerType.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

const registerProducerSchema = z.object({
  tenantId: z.string().min(1),
  userId: z.string().uuid().optional().nullable(),
  producerType: z.enum(PRODUCER_TYPES),
  organizationName: z.string().min(3),
  contactName: z.string().min(3),
  contactPhone: z.string().min(7),
  municipalityName: z.string().min(3),
  zoneType: z.enum(PRODUCER_ZONES),
  productCategories: z.array(z.string().min(2)).min(1),
  latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
  longitude: z.coerce.number().min(-180).max(180).optional().nullable()
});

function toProducerResponse(producer: Producer) {
  return {
    id: producer.id,
    tenantId: producer.tenantId,
    userId: producer.userId,
    producerType: producer.producerType,
    organizationName: producer.organizationName,
    contactName: producer.contactName,
    contactPhone: producer.contactPhone,
    municipalityName: producer.municipalityName,
    zoneType: producer.zoneType,
    productCategories: producer.productCategories,
    status: producer.status,
    latitude: producer.latitude,
    longitude: producer.longitude,
    createdAt: producer.createdAt.toISOString()
  };
}

export function createProducersRouter(repository: ProducerRepository): Router {
  const router = Router();
  const registerProducer = new RegisterProducer(repository);

  router.post("/api/v1/producers/register", asyncHandler(async (req, res) => {
    const parsed = registerProducerSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(
        res,
        400,
        "INVALID_PRODUCER_PAYLOAD",
        "Payload invalido para registro de productor."
      );
    }

    try {
      const producer = await registerProducer.execute(parsed.data);
      return sendSuccess(res, toProducerResponse(producer), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "PRODUCER_ALREADY_EXISTS") {
        return sendError(
          res,
          409,
          "PRODUCER_ALREADY_EXISTS",
          "La organizacion productora ya existe para este municipio."
        );
      }

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

      return sendError(
        res,
        500,
        "PRODUCER_REGISTRATION_FAILED",
        "No fue posible registrar el productor."
      );
    }
  }));

  router.get("/api/v1/producers", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    const result = await repository.list({ page, limit }, tenantId ?? null);
    return sendPaginatedSuccess(res, result.data.map(toProducerResponse), { total: result.total, page: result.page, limit: result.limit });
  }));

  router.get("/api/v1/producers/:id", asyncHandler(async (req, res) => {
    const producer = await repository.findById(String(req.params.id));

    if (!producer) {
      return sendError(res, 404, "PRODUCER_NOT_FOUND", "Productor no encontrado.");
    }

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && producer.tenantId !== tenantId) {
      return sendError(res, 404, "PRODUCER_NOT_FOUND", "Productor no encontrado.");
    }

    return sendSuccess(res, toProducerResponse(producer));
  }));

  /* ---------------------------------------------------------------- */
  /*  CSV bulk import — productores del campo                          */
  /* ---------------------------------------------------------------- */

  const csvImportSchema = z.object({
    tenantId: z.string().min(1),
    municipalityName: z.string().min(3),
    csvText: z.string().min(10, "El CSV debe contener al menos encabezados y una fila de datos.")
  });

  router.post("/api/v1/producers/import/csv", asyncHandler(async (req, res) => {
    const parsed = csvImportSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_CSV_PAYLOAD", "Payload inválido para importación CSV de productores.");
    }

    const importUseCase = new ImportProducers(repository);
    try {
      const result = await importUseCase.execute(
        parsed.data.csvText,
        parsed.data.tenantId,
        parsed.data.municipalityName
      );
      const status = result.errorCount > 0 && result.successCount === 0 ? 422 : 200;
      return sendSuccess(res, {
        importId: result.importId,
        totalRows: result.totalRows,
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errors,
        producers: result.producers.map(toProducerResponse)
      }, status);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "CSV_IMPORT_FAILED", "No fue posible procesar la importación CSV de productores.");
    }
  }));

  return router;
}
