import type { Pool } from "pg";

export interface DeliveryFilters {
  productorId?: string;
  institucionId?: string;
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  limit?: number;
}

export interface DeliveryDetailInput {
  productoId: string;
  cantidadEntregada: number;
  unidadMedida: string;
  precioUnitario?: number | null;
  lote?: string | null;
  fechaVencimiento?: string | null;
  observacion?: string | null;
}

export interface DeliveryInput {
  productorId: string;
  institucionId: string;
  fechaEntrega: string;
  horaEntrega?: string | null;
  lugarEntrega?: string | null;
  recibirPor?: string | null;
  documentoSoporte?: string | null;
  observaciones?: string | null;
  estado?: string;
  creadoPor?: string | null;
  detalle: DeliveryDetailInput[];
}

export interface DeliveryRow {
  id: string;
  numero_entrega: string;
  productor_id: string;
  institucion_id: string;
  fecha_entrega: string;
  hora_entrega: string | null;
  lugar_entrega: string | null;
  recibido_por: string | null;
  documento_soporte: string | null;
  observaciones: string | null;
  estado: string;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
  productor_nombre?: string;
  institucion_nombre?: string;
  total_items?: number;
  valor_total?: number;
}

export interface DetailRow {
  id: string;
  entrega_id: string;
  producto_id: string;
  cantidad_entregada: string;
  unidad_medida: string;
  precio_unitario: string | null;
  lote: string | null;
  fecha_vencimiento: string | null;
  observacion: string | null;
  producto_nombre?: string;
}

export class PostgresDeliveryRepository {
  constructor(private readonly pool: Pool) {}

  async list(filters: DeliveryFilters): Promise<{ data: DeliveryRow[]; total: number }> {
    const page  = Math.max(1, filters.page  ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const offset = (page - 1) * limit;

    const where: string[] = ["e.deleted_at IS NULL"];
    const params: unknown[] = [];
    let i = 1;

    if (filters.productorId)  { where.push(`e.productor_id = $${i++}`);              params.push(filters.productorId); }
    if (filters.institucionId){ where.push(`e.institucion_id = $${i++}`);            params.push(filters.institucionId); }
    if (filters.estado)       { where.push(`e.estado = $${i++}`);                    params.push(filters.estado); }
    if (filters.fechaDesde)   { where.push(`e.fecha_entrega >= $${i++}::date`);      params.push(filters.fechaDesde); }
    if (filters.fechaHasta)   { where.push(`e.fecha_entrega <= $${i++}::date`);      params.push(filters.fechaHasta); }

    const whereClause = where.join(" AND ");

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.entregas_productos e WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const listParams = [...params, limit, offset];
    const result = await this.pool.query<DeliveryRow>(
      `SELECT
         e.id, e.numero_entrega, e.fecha_entrega, e.hora_entrega,
         e.lugar_entrega, e.recibido_por, e.documento_soporte,
         e.observaciones, e.estado, e.creado_por,
         e.created_at, e.updated_at,
         p.organization_name AS productor_nombre,
         inst.name            AS institucion_nombre,
         COUNT(d.id)::int     AS total_items,
         COALESCE(SUM(d.cantidad_entregada * d.precio_unitario), 0) AS valor_total
       FROM public.entregas_productos e
       LEFT JOIN public.producers     p    ON p.id    = e.productor_id
       LEFT JOIN public.institutions  inst ON inst.id = e.institucion_id
       LEFT JOIN public.entregas_detalle d ON d.entrega_id = e.id
       WHERE ${whereClause}
       GROUP BY e.id, p.organization_name, inst.name
       ORDER BY e.fecha_entrega DESC, e.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      listParams
    );

    return { data: result.rows, total };
  }

  async findById(id: string): Promise<DeliveryRow | null> {
    const result = await this.pool.query<DeliveryRow>(
      `SELECT
         e.id, e.numero_entrega, e.productor_id, e.institucion_id,
         e.fecha_entrega, e.hora_entrega, e.lugar_entrega,
         e.recibido_por, e.documento_soporte, e.observaciones,
         e.estado, e.creado_por, e.created_at, e.updated_at,
         p.organization_name AS productor_nombre,
         inst.name           AS institucion_nombre
       FROM public.entregas_productos e
       LEFT JOIN public.producers    p    ON p.id    = e.productor_id
       LEFT JOIN public.institutions inst ON inst.id = e.institucion_id
       WHERE e.id = $1 AND e.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async getDetail(entregaId: string): Promise<DetailRow[]> {
    const result = await this.pool.query<DetailRow>(
      `SELECT
         d.id, d.entrega_id, d.producto_id,
         d.cantidad_entregada, d.unidad_medida,
         d.precio_unitario, d.lote,
         d.fecha_vencimiento, d.observacion,
         pc.name AS producto_nombre
       FROM public.entregas_detalle d
       LEFT JOIN public.product_catalog pc ON pc.id = d.producto_id
       WHERE d.entrega_id = $1
       ORDER BY d.id`,
      [entregaId]
    );
    return result.rows;
  }

  async create(input: DeliveryInput): Promise<DeliveryRow> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const numResult = await client.query<{ next_num: string }>(
        `SELECT COALESCE(MAX(CAST(SPLIT_PART(numero_entrega, '-', 3) AS INTEGER)), 0) + 1 AS next_num
         FROM public.entregas_productos
         WHERE numero_entrega LIKE 'ENT-' || $1 || '-%'`,
        [new Date().getFullYear()]
      );
      const seq = String(numResult.rows[0].next_num).padStart(4, "0");
      const numeroEntrega = `ENT-${new Date().getFullYear()}-${seq}`;

      const insertResult = await client.query<DeliveryRow>(
        `INSERT INTO public.entregas_productos
           (numero_entrega, productor_id, institucion_id, fecha_entrega, hora_entrega,
            lugar_entrega, recibido_por, documento_soporte, observaciones, estado, creado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          numeroEntrega,
          input.productorId,
          input.institucionId,
          input.fechaEntrega,
          input.horaEntrega ?? null,
          input.lugarEntrega ?? null,
          input.recibirPor ?? null,
          input.documentoSoporte ?? null,
          input.observaciones ?? null,
          input.estado ?? "pendiente",
          input.creadoPor ?? null,
        ]
      );
      const entrega = insertResult.rows[0];

      for (const d of input.detalle) {
        await client.query(
          `INSERT INTO public.entregas_detalle
             (entrega_id, producto_id, cantidad_entregada, unidad_medida,
              precio_unitario, lote, fecha_vencimiento, observacion)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            entrega.id,
            d.productoId,
            d.cantidadEntregada,
            d.unidadMedida,
            d.precioUnitario ?? null,
            d.lote ?? null,
            d.fechaVencimiento ?? null,
            d.observacion ?? null,
          ]
        );
      }

      await client.query("COMMIT");
      return entrega;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async update(id: string, input: Partial<Omit<DeliveryInput, "detalle">> & { detalle?: DeliveryDetailInput[] }): Promise<DeliveryRow | null> {
    const current = await this.findById(id);
    if (!current) return null;

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query<DeliveryRow>(
        `UPDATE public.entregas_productos SET
           productor_id      = $2,
           institucion_id    = $3,
           fecha_entrega     = $4,
           hora_entrega      = $5,
           lugar_entrega     = $6,
           recibido_por      = $7,
           documento_soporte = $8,
           observaciones     = $9,
           estado            = $10
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING *`,
        [
          id,
          input.productorId      ?? current.productor_id,
          input.institucionId    ?? current.institucion_id,
          input.fechaEntrega     ?? current.fecha_entrega,
          input.horaEntrega      !== undefined ? input.horaEntrega      : current.hora_entrega,
          input.lugarEntrega     !== undefined ? input.lugarEntrega     : current.lugar_entrega,
          input.recibirPor       !== undefined ? input.recibirPor       : current.recibido_por,
          input.documentoSoporte !== undefined ? input.documentoSoporte : current.documento_soporte,
          input.observaciones    !== undefined ? input.observaciones    : current.observaciones,
          input.estado           ?? current.estado,
        ]
      );

      if (input.detalle) {
        await client.query("DELETE FROM public.entregas_detalle WHERE entrega_id = $1", [id]);
        for (const d of input.detalle) {
          await client.query(
            `INSERT INTO public.entregas_detalle
               (entrega_id, producto_id, cantidad_entregada, unidad_medida,
                precio_unitario, lote, fecha_vencimiento, observacion)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              id,
              d.productoId,
              d.cantidadEntregada,
              d.unidadMedida,
              d.precioUnitario ?? null,
              d.lote ?? null,
              d.fechaVencimiento ?? null,
              d.observacion ?? null,
            ]
          );
        }
      }

      await client.query("COMMIT");
      return result.rows[0] ?? null;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE public.entregas_productos SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
