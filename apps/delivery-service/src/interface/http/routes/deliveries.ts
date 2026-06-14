import { Router } from "express";
import { z } from "zod";
import type { Pool } from "pg";
import { PostgresDeliveryRepository } from "../../../infrastructure/repositories/PostgresDeliveryRepository.js";

// ── Response helpers (inline to avoid cross-service imports) ──
function ok(res: Parameters<Router["get"]>[1] extends (req: any, res: infer R, ...a: any[]) => any ? R : never, data: unknown, status = 200) {
  return (res as any).status(status).json({ ok: true, data });
}
function err(res: Parameters<Router["get"]>[1] extends (req: any, res: infer R, ...a: any[]) => any ? R : never, status: number, code: string, message: string) {
  return (res as any).status(status).json({ ok: false, error: { code, message } });
}

// ── Zod schemas ────────────────────────────────────────────
const ESTADOS = ["pendiente", "recibido", "parcial", "rechazado"] as const;

const detalleSchema = z.object({
  productoId:         z.string().uuid(),
  cantidadEntregada:  z.number().positive(),
  unidadMedida:       z.string().min(1).max(30),
  precioUnitario:     z.number().nonnegative().nullable().optional(),
  lote:               z.string().max(50).nullable().optional(),
  fechaVencimiento:   z.string().nullable().optional(),
  observacion:        z.string().nullable().optional(),
});

const createSchema = z.object({
  productorId:        z.string().uuid(),
  institucionId:      z.string().uuid(),
  fechaEntrega:       z.string().min(8),
  horaEntrega:        z.string().nullable().optional(),
  lugarEntrega:       z.string().max(200).nullable().optional(),
  recibirPor:         z.string().max(150).nullable().optional(),
  documentoSoporte:   z.string().max(200).nullable().optional(),
  observaciones:      z.string().nullable().optional(),
  estado:             z.enum(ESTADOS).optional(),
  creadoPor:          z.string().uuid().nullable().optional(),
  detalle:            z.array(detalleSchema).min(1, "Se requiere al menos un producto en el detalle"),
});

const updateSchema = createSchema.partial().extend({
  detalle: z.array(detalleSchema).min(1).optional(),
});

// ── Router factory ─────────────────────────────────────────
export function createDeliveriesRouter(pool: Pool): Router {
  const router = Router();
  const repo = new PostgresDeliveryRepository(pool);

  /* ── GET /api/v1/entregas ─────────────────────────────── */
  router.get("/api/v1/entregas", async (req, res) => {
    try {
      const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const { data, total } = await repo.list({
        productorId:   req.query.productor_id  ? String(req.query.productor_id)  : undefined,
        institucionId: req.query.institucion_id ? String(req.query.institucion_id) : undefined,
        estado:        req.query.estado         ? String(req.query.estado)         : undefined,
        fechaDesde:    req.query.fecha_desde    ? String(req.query.fecha_desde)    : undefined,
        fechaHasta:    req.query.fecha_hasta    ? String(req.query.fecha_hasta)    : undefined,
        page,
        limit,
      });
      return (res as any).status(200).json({
        ok: true,
        data,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch {
      return err(res as any, 500, "ENTREGAS_LIST_FAILED", "No fue posible obtener las entregas.");
    }
  });

  /* ── GET /api/v1/entregas/:id ─────────────────────────── */
  router.get("/api/v1/entregas/:id", async (req, res) => {
    try {
      const entrega = await repo.findById(String(req.params.id));
      if (!entrega) return err(res as any, 404, "ENTREGA_NOT_FOUND", "Entrega no encontrada.");
      const detalle = await repo.getDetail(entrega.id);
      return ok(res as any, { ...entrega, detalle });
    } catch {
      return err(res as any, 500, "ENTREGA_GET_FAILED", "No fue posible obtener la entrega.");
    }
  });

  /* ── POST /api/v1/entregas ────────────────────────────── */
  router.post("/api/v1/entregas", async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return err(res as any, 400, "INVALID_ENTREGA_PAYLOAD",
        parsed.error.issues.map(i => i.message).join("; "));
    }
    try {
      const entrega = await repo.create(parsed.data);
      const detalle = await repo.getDetail(entrega.id);
      return ok(res as any, { ...entrega, detalle }, 201);
    } catch {
      return err(res as any, 500, "ENTREGA_CREATE_FAILED", "No fue posible registrar la entrega.");
    }
  });

  /* ── PUT /api/v1/entregas/:id ─────────────────────────── */
  router.put("/api/v1/entregas/:id", async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return err(res as any, 400, "INVALID_ENTREGA_PAYLOAD",
        parsed.error.issues.map(i => i.message).join("; "));
    }
    try {
      const updated = await repo.update(String(req.params.id), parsed.data);
      if (!updated) return err(res as any, 404, "ENTREGA_NOT_FOUND", "Entrega no encontrada.");
      const detalle = await repo.getDetail(updated.id);
      return ok(res as any, { ...updated, detalle });
    } catch {
      return err(res as any, 500, "ENTREGA_UPDATE_FAILED", "No fue posible actualizar la entrega.");
    }
  });

  /* ── DELETE /api/v1/entregas/:id ─────────────────────── */
  router.delete("/api/v1/entregas/:id", async (req, res) => {
    try {
      const deleted = await repo.softDelete(String(req.params.id));
      if (!deleted) return err(res as any, 404, "ENTREGA_NOT_FOUND", "Entrega no encontrada.");
      return (res as any).status(204).send();
    } catch {
      return err(res as any, 500, "ENTREGA_DELETE_FAILED", "No fue posible eliminar la entrega.");
    }
  });

  return router;
}
