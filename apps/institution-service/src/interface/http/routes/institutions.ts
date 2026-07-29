import { Router } from "express";
import { z } from "zod";
import { Institution } from "../../../domain/entities/Institution.js";
import type { InstitutionRepository } from "../../../domain/ports/InstitutionRepository.js";
import {
  INSTITUTION_TYPES,
  INSTITUTION_STATUSES
} from "../../../domain/value-objects/InstitutionType.js";
import { RegisterInstitution } from "../../../application/use-cases/RegisterInstitution.js";
import { ImportInstitutions } from "../../../application/use-cases/ImportInstitutions.js";
import type { AuditLogger } from "../../../shared/audit.js";
import { auditGodViewAccess, resolveTenantFilter } from "../../../../../shared/middleware/tenantContext.js";
import {
  asyncHandler,
  sendError,
  sendPaginatedSuccess,
  sendSuccess
} from "../response.js";

const registerSchema = z.object({
  tenantId: z.string().min(1),
  institutionType: z.enum(INSTITUTION_TYPES),
  name: z.string().min(3),
  contactName: z.string().min(3),
  contactPhone: z.string().min(7),
  contactEmail: z.string().email().nullable().optional(),
  municipalityName: z.string().min(3),
  address: z.string().min(5).nullable().optional(),
  beneficiaryCount: z.coerce.number().int().min(1),
  productCategories: z.array(z.string().min(2)).min(1),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  notes: z.string().nullable().optional(),
  createdBy: z.string().uuid().nullable().optional()
});

const updateSchema = z.object({
  institutionType: z.enum(INSTITUTION_TYPES).optional(),
  name: z.string().min(3).optional(),
  contactName: z.string().min(3).optional(),
  contactPhone: z.string().min(7).optional(),
  contactEmail: z.string().email().nullable().optional(),
  address: z.string().min(5).nullable().optional(),
  beneficiaryCount: z.coerce.number().int().min(1).optional(),
  productCategories: z.array(z.string().min(2)).min(1).optional(),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  notes: z.string().nullable().optional()
}).refine((d) => Object.keys(d).length > 0, { message: "Al menos un campo es requerido." });

const statusSchema = z.object({
  status: z.enum(INSTITUTION_STATUSES),
  changedBy: z.string().uuid().nullable().optional(),
  reason: z.string().max(500).nullable().optional()
});

const csvImportSchema = z.object({
  tenantId: z.string().min(1),
  municipalityName: z.string().min(3),
  csvText: z.string().min(10, "El CSV debe contener al menos encabezados y una fila de datos."),
  createdBy: z.string().uuid().nullable().optional()
});

function toResponse(i: Institution) {
  return {
    id: i.id,
    tenantId: i.tenantId,
    institutionType: i.institutionType,
    name: i.name,
    contactName: i.contactName,
    contactPhone: i.contactPhone,
    contactEmail: i.contactEmail,
    municipalityName: i.municipalityName,
    address: i.address,
    beneficiaryCount: i.beneficiaryCount,
    productCategories: i.productCategories,
    latitude: i.latitude,
    longitude: i.longitude,
    status: i.status,
    notes: i.notes,
    createdBy: i.createdBy,
    createdAt: i.createdAt.toISOString()
  };
}

export function createInstitutionsRouter(repository: InstitutionRepository, auditLogger?: AuditLogger): Router {
  const router = Router();
  const registerUseCase = new RegisterInstitution(repository);

  /* ---------------------------------------------------------------- */
  /*  Register                                                         */
  /* ---------------------------------------------------------------- */
  router.post("/api/v1/institutions/register", asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_INSTITUTION_PAYLOAD", "Payload inválido para registro de institución.");
    }

    try {
      const institution = await registerUseCase.execute(parsed.data);
      return sendSuccess(res, toResponse(institution), 201);
    } catch (error) {
      if (error instanceof Error && error.message === "INSTITUTION_ALREADY_EXISTS") {
        return sendError(res, 409, "INSTITUTION_ALREADY_EXISTS", "Ya existe una institución con ese nombre en este municipio.");
      }
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "INSTITUTION_REGISTRATION_FAILED", "No fue posible registrar la institución.");
    }
  }));

  /* ---------------------------------------------------------------- */
  /*  CSV bulk import                                                  */
  /* ---------------------------------------------------------------- */
  router.post("/api/v1/institutions/import/csv", asyncHandler(async (req, res) => {
    const parsed = csvImportSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_CSV_PAYLOAD", "Payload inválido para importación CSV de instituciones.");
    }

    const importUseCase = new ImportInstitutions(repository);
    try {
      const result = await importUseCase.execute(
        parsed.data.csvText,
        parsed.data.tenantId,
        parsed.data.municipalityName,
        parsed.data.createdBy ?? null
      );
      const status = result.errorCount > 0 && result.successCount === 0 ? 422 : 200;
      return sendSuccess(res, {
        importId: result.importId,
        totalRows: result.totalRows,
        successCount: result.successCount,
        errorCount: result.errorCount,
        errors: result.errors,
        institutions: result.institutions.map(toResponse)
      }, status);
    } catch (error) {
      if (error instanceof Error && error.message === "TENANT_NOT_FOUND") {
        return sendError(res, 404, "TENANT_NOT_FOUND", "Municipio o tenant no encontrado.");
      }
      return sendError(res, 500, "CSV_IMPORT_FAILED", "No fue posible procesar la importación CSV de instituciones.");
    }
  }));

  /* ---------------------------------------------------------------- */
  /*  List                                                             */
  /* ---------------------------------------------------------------- */
  router.get("/api/v1/institutions", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    await auditGodViewAccess(req, auditLogger, { serviceName: "institution-service", entityName: "institutions" });
    const result = await repository.list({ page, limit }, resolveTenantFilter(req));
    return sendPaginatedSuccess(res, result.data.map(toResponse), {
      total: result.total,
      page: result.page,
      limit: result.limit
    });
  }));

  /* ---------------------------------------------------------------- */
  /*  Get by ID                                                        */
  /* ---------------------------------------------------------------- */
  router.get("/api/v1/institutions/:id", asyncHandler(async (req, res) => {
    const institution = await repository.findById(String(req.params.id));
    if (!institution) return sendError(res, 404, "INSTITUTION_NOT_FOUND", "Institución no encontrada.");

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && institution.tenantId !== tenantId) {
      return sendError(res, 404, "INSTITUTION_NOT_FOUND", "Institución no encontrada.");
    }

    return sendSuccess(res, toResponse(institution));
  }));

  /* ---------------------------------------------------------------- */
  /*  Update                                                           */
  /* ---------------------------------------------------------------- */
  router.put("/api/v1/institutions/:id", asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_INSTITUTION_PAYLOAD", "Payload inválido para edición de institución.");
    }

    const institution = await repository.findById(String(req.params.id));
    if (!institution) return sendError(res, 404, "INSTITUTION_NOT_FOUND", "Institución no encontrada.");

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && institution.tenantId !== tenantId) {
      return sendError(res, 404, "INSTITUTION_NOT_FOUND", "Institución no encontrada.");
    }

    const data = parsed.data;
    const updated = new Institution({
      id: institution.id,
      tenantId: institution.tenantId,
      municipalityName: institution.municipalityName,
      status: institution.status,
      createdBy: institution.createdBy,
      createdAt: institution.createdAt,
      institutionType: data.institutionType ?? institution.institutionType,
      name: data.name ?? institution.name,
      contactName: data.contactName ?? institution.contactName,
      contactPhone: data.contactPhone ?? institution.contactPhone,
      contactEmail: "contactEmail" in data ? data.contactEmail : institution.contactEmail,
      address: "address" in data ? data.address : institution.address,
      beneficiaryCount: data.beneficiaryCount ?? institution.beneficiaryCount,
      productCategories: data.productCategories ?? institution.productCategories,
      latitude: "latitude" in data ? data.latitude : institution.latitude,
      longitude: "longitude" in data ? data.longitude : institution.longitude,
      notes: "notes" in data ? data.notes : institution.notes
    });

    await repository.update(updated);
    return sendSuccess(res, toResponse(updated));
  }));

  /* ---------------------------------------------------------------- */
  /*  Update status — con auditoría                                    */
  /* ---------------------------------------------------------------- */
  router.patch("/api/v1/institutions/:id/status", asyncHandler(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_STATUS_PAYLOAD", "Estado inválido. Valores: pending_verification, active, inactive.");
    }

    const institution = await repository.findById(String(req.params.id));
    if (!institution) return sendError(res, 404, "INSTITUTION_NOT_FOUND", "Institución no encontrada.");

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && institution.tenantId !== tenantId) {
      return sendError(res, 404, "INSTITUTION_NOT_FOUND", "Institución no encontrada.");
    }

    const oldStatus = institution.status;
    const newStatus = parsed.data.status;

    const updated = new Institution({ ...institution, status: newStatus });
    await repository.update(updated);

    await repository.logStatusChange({
      institutionId: institution.id,
      oldStatus,
      newStatus,
      changedBy: parsed.data.changedBy ?? null,
      reason: parsed.data.reason ?? null
    });

    return sendSuccess(res, toResponse(updated));
  }));

  /* ---------------------------------------------------------------- */
  /*  Soft delete                                                      */
  /* ---------------------------------------------------------------- */
  router.delete("/api/v1/institutions/:id", asyncHandler(async (req, res) => {
    const institution = await repository.findById(String(req.params.id));
    if (!institution) return sendError(res, 404, "INSTITUTION_NOT_FOUND", "Institución no encontrada.");

    const tenantId = req.headers["x-tenant-id"] as string | undefined;
    if (tenantId && institution.tenantId !== tenantId) {
      return sendError(res, 404, "INSTITUTION_NOT_FOUND", "Institución no encontrada.");
    }

    await repository.softDelete(institution.id);
    return res.status(204).send();
  }));

  return router;
}
