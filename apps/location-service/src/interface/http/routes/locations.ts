import { Router } from "express";
import { z } from "zod";
import type { DepartamentoRepository, MunicipioRepository, CorregimientoRepository, VeredaRepository } from "../../../domain/ports/LocationRepositories.js";
import { asyncHandler, sendError, sendPaginatedSuccess, sendSuccess } from "../response.js";

export function createLocationsRouter(
  departamentoRepo: DepartamentoRepository,
  municipioRepo: MunicipioRepository,
  corregimientoRepo: CorregimientoRepository,
  veredaRepo: VeredaRepository
): Router {
  const router = Router();

  // ===================== DEPARTAMENTOS =====================
  
  router.get("/api/departamentos", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const search = String(req.query.search ?? "");
    
    const result = await departamentoRepo.list(page, limit, search);
    return sendPaginatedSuccess(res, result.data, { total: result.total, page: result.page, limit: result.limit });
  }));

  router.get("/api/departamentos/:id", asyncHandler(async (req, res) => {
    const dept = await departamentoRepo.findById(String(req.params.id));
    if (!dept) return sendError(res, 404, "DEPARTAMENTO_NOT_FOUND", "Departamento no encontrado.");
    return sendSuccess(res, dept);
  }));

  const createDepartamentoSchema = z.object({
    codigoDane: z.string().min(1).max(10),
    nombre: z.string().min(3).max(100)
  });

  router.post("/api/departamentos", asyncHandler(async (req, res) => {
    const parsed = createDepartamentoSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_PAYLOAD", "Datos inválidos para crear departamento.");
    }
    
    const existing = await departamentoRepo.findByCodigoDane(parsed.data.codigoDane);
    if (existing) {
      return sendError(res, 409, "DEPARTAMENTO_EXISTS", "Ya existe un departamento con este código DANE.");
    }
    
    const dept = await departamentoRepo.create(parsed.data);
    return sendSuccess(res, dept, 201);
  }));

  const updateDepartamentoSchema = z.object({
    codigoDane: z.string().min(1).max(10).optional(),
    nombre: z.string().min(3).max(100).optional()
  }).refine(d => Object.keys(d).length > 0, { message: "Al menos un campo debe ser proporcionado" });

  router.put("/api/departamentos/:id", asyncHandler(async (req, res) => {
    const parsed = updateDepartamentoSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_PAYLOAD", "Datos inválidos para actualizar departamento.");
    }
    
    const existing = await departamentoRepo.findById(String(req.params.id));
    if (!existing) return sendError(res, 404, "DEPARTAMENTO_NOT_FOUND", "Departamento no encontrado.");
    
    const dept = await departamentoRepo.update(String(req.params.id), parsed.data);
    return sendSuccess(res, dept);
  }));

  router.delete("/api/departamentos/:id", asyncHandler(async (req, res) => {
    const existing = await departamentoRepo.findById(String(req.params.id));
    if (!existing) return sendError(res, 404, "DEPARTAMENTO_NOT_FOUND", "Departamento no encontrado.");
    
    await departamentoRepo.delete(String(req.params.id));
    return res.status(204).send();
  }));

  // ===================== MUNICIPIOS =====================

  router.get("/api/municipios", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const search = String(req.query.search ?? "");
    const departmentCode = String(req.query.departmentCode ?? "");

    const result = await municipioRepo.list(page, limit, search, departmentCode);
    return sendPaginatedSuccess(res, result.data, { total: result.total, page: result.page, limit: result.limit });
  }));

  router.get("/api/municipios/:id", asyncHandler(async (req, res) => {
    const muni = await municipioRepo.findById(String(req.params.id));
    if (!muni) return sendError(res, 404, "MUNICIPIO_NOT_FOUND", "Municipio no encontrado.");
    return sendSuccess(res, muni);
  }));

  const createMunicipioSchema = z.object({
    codigoDane: z.string().min(1).max(10),
    nombre: z.string().min(3).max(100),
    departmentCode: z.string().min(1).max(10),
    departmentName: z.string().min(3).max(100),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    population: z.number().int().positive().optional().nullable()
  });

  router.post("/api/municipios", asyncHandler(async (req, res) => {
    const parsed = createMunicipioSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_PAYLOAD", "Datos inválidos para crear municipio.");
    }

    const existing = await municipioRepo.findByCodigoDane(parsed.data.codigoDane);
    if (existing) {
      return sendError(res, 409, "MUNICIPIO_EXISTS", "Ya existe un municipio con este código DANE.");
    }

    const muni = await municipioRepo.create(parsed.data);
    return sendSuccess(res, muni, 201);
  }));

  const updateMunicipioSchema = z.object({
    codigoDane: z.string().min(1).max(10).optional(),
    nombre: z.string().min(3).max(100).optional(),
    departmentCode: z.string().min(1).max(10).optional(),
    departmentName: z.string().min(3).max(100).optional(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    population: z.number().int().positive().optional().nullable()
  }).refine(d => Object.keys(d).length > 0, { message: "Al menos un campo debe ser proporcionado" });

  router.put("/api/municipios/:id", asyncHandler(async (req, res) => {
    const parsed = updateMunicipioSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_PAYLOAD", "Datos inválidos para actualizar municipio.");
    }
    
    const existing = await municipioRepo.findById(String(req.params.id));
    if (!existing) return sendError(res, 404, "MUNICIPIO_NOT_FOUND", "Municipio no encontrado.");
    
    const muni = await municipioRepo.update(String(req.params.id), parsed.data);
    return sendSuccess(res, muni);
  }));

  router.delete("/api/municipios/:id", asyncHandler(async (req, res) => {
    const existing = await municipioRepo.findById(String(req.params.id));
    if (!existing) return sendError(res, 404, "MUNICIPIO_NOT_FOUND", "Municipio no encontrado.");
    
    await municipioRepo.delete(String(req.params.id));
    return res.status(204).send();
  }));

  // ===================== CORREGIMIENTOS =====================

  router.get("/api/corregimientos", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const municipalityCode = String(req.query.municipalityCode ?? "");
    const search = String(req.query.search ?? "");
    
    const result = await corregimientoRepo.list(page, limit, municipalityCode, search);
    return sendPaginatedSuccess(res, result.data, { total: result.total, page: result.page, limit: result.limit });
  }));

  router.get("/api/corregimientos/:id", asyncHandler(async (req, res) => {
    const corr = await corregimientoRepo.findById(String(req.params.id));
    if (!corr) return sendError(res, 404, "CORREGIMIENTO_NOT_FOUND", "Corregimiento no encontrado.");
    return sendSuccess(res, corr);
  }));

  const createCorregimientoSchema = z.object({
    daneCode: z.string().min(1).max(20),
    nombre: z.string().min(3).max(100),
    municipalityCode: z.string().min(1).max(10),
    municipalityName: z.string().min(3).max(100),
    departmentCode: z.string().min(1).max(10),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    population: z.number().int().positive().optional(),
    areaKm2: z.number().positive().optional(),
    isActive: z.boolean().default(true)
  });

  router.post("/api/corregimientos", asyncHandler(async (req, res) => {
    const parsed = createCorregimientoSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_PAYLOAD", "Datos inválidos para crear corregimiento.");
    }
    
    const existing = await corregimientoRepo.findByDaneCode(parsed.data.daneCode);
    if (existing) {
      return sendError(res, 409, "CORREGIMIENTO_EXISTS", "Ya existe un corregimiento con este código DANE.");
    }
    
    const corr = await corregimientoRepo.create(parsed.data);
    return sendSuccess(res, corr, 201);
  }));

  const updateCorregimientoSchema = z.object({
    daneCode: z.string().min(1).max(20).optional(),
    nombre: z.string().min(3).max(100).optional(),
    municipalityCode: z.string().min(1).max(10).optional(),
    municipalityName: z.string().min(3).max(100).optional(),
    departmentCode: z.string().min(1).max(10).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    population: z.number().int().positive().optional(),
    areaKm2: z.number().positive().optional(),
    isActive: z.boolean().optional()
  }).refine(d => Object.keys(d).length > 0, { message: "Al menos un campo debe ser proporcionado" });

  router.put("/api/corregimientos/:id", asyncHandler(async (req, res) => {
    const parsed = updateCorregimientoSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_PAYLOAD", "Datos inválidos para actualizar corregimiento.");
    }
    
    const existing = await corregimientoRepo.findById(String(req.params.id));
    if (!existing) return sendError(res, 404, "CORREGIMIENTO_NOT_FOUND", "Corregimiento no encontrado.");
    
    const corr = await corregimientoRepo.update(String(req.params.id), parsed.data);
    return sendSuccess(res, corr);
  }));

  router.delete("/api/corregimientos/:id", asyncHandler(async (req, res) => {
    const existing = await corregimientoRepo.findById(String(req.params.id));
    if (!existing) return sendError(res, 404, "CORREGIMIENTO_NOT_FOUND", "Corregimiento no encontrado.");
    
    await corregimientoRepo.delete(String(req.params.id));
    return res.status(204).send();
  }));

  // ===================== VEREDAS =====================

  router.get("/api/veredas", asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const corregimientoId = String(req.query.corregimientoId ?? "");
    const municipalityCode = String(req.query.municipalityCode ?? "");
    const search = String(req.query.search ?? "");
    
    const result = await veredaRepo.list(page, limit, corregimientoId, municipalityCode, search);
    return sendPaginatedSuccess(res, result.data, { total: result.total, page: result.page, limit: result.limit });
  }));

  router.get("/api/veredas/:id", asyncHandler(async (req, res) => {
    const vereda = await veredaRepo.findById(String(req.params.id));
    if (!vereda) return sendError(res, 404, "VEREDA_NOT_FOUND", "Vereda no encontrada.");
    return sendSuccess(res, vereda);
  }));

  const createVeredaSchema = z.object({
    nombre: z.string().min(3).max(100),
    corregimientoId: z.string().uuid().optional(),
    municipalityCode: z.string().min(1).max(10),
    municipalityName: z.string().min(3).max(100),
    departmentCode: z.string().min(1).max(10),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    population: z.number().int().positive().optional(),
    areaKm2: z.number().positive().optional(),
    mainProduct: z.string().max(100).optional(),
    isActive: z.boolean().default(true)
  });

  router.post("/api/veredas", asyncHandler(async (req, res) => {
    const parsed = createVeredaSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_PAYLOAD", "Datos inválidos para crear vereda.");
    }
    
    const vereda = await veredaRepo.create(parsed.data);
    return sendSuccess(res, vereda, 201);
  }));

  const updateVeredaSchema = z.object({
    nombre: z.string().min(3).max(100).optional(),
    corregimientoId: z.string().uuid().optional(),
    municipalityCode: z.string().min(1).max(10).optional(),
    municipalityName: z.string().min(3).max(100).optional(),
    departmentCode: z.string().min(1).max(10).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    population: z.number().int().positive().optional(),
    areaKm2: z.number().positive().optional(),
    mainProduct: z.string().max(100).optional(),
    isActive: z.boolean().optional()
  }).refine(d => Object.keys(d).length > 0, { message: "Al menos un campo debe ser proporcionado" });

  router.put("/api/veredas/:id", asyncHandler(async (req, res) => {
    const parsed = updateVeredaSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, "INVALID_PAYLOAD", "Datos inválidos para actualizar vereda.");
    }
    
    const existing = await veredaRepo.findById(String(req.params.id));
    if (!existing) return sendError(res, 404, "VEREDA_NOT_FOUND", "Vereda no encontrada.");
    
    const vereda = await veredaRepo.update(String(req.params.id), parsed.data);
    return sendSuccess(res, vereda);
  }));

  router.delete("/api/veredas/:id", asyncHandler(async (req, res) => {
    const existing = await veredaRepo.findById(String(req.params.id));
    if (!existing) return sendError(res, 404, "VEREDA_NOT_FOUND", "Vereda no encontrada.");
    
    await veredaRepo.delete(String(req.params.id));
    return res.status(204).send();
  }));

  return router;
}
