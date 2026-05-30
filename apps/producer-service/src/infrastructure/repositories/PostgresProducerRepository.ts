import type { Pool } from "pg";
import { Producer } from "../../domain/entities/Producer.js";
import type {
  ProducerRepository,
  PaginationParams,
  PaginatedResult,
  ProducerStats
} from "../../domain/ports/ProducerRepository.js";
import type {
  ProducerStatus,
  ProducerType,
  ProducerZone
} from "../../domain/value-objects/ProducerType.js";

interface ProducerRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  producer_type: ProducerType;
  organization_name: string;
  contact_name: string;
  contact_phone: string;
  municipality_name: string;
  zone_type: ProducerZone;
  product_categories: string[];
  status: ProducerStatus;
  latitude: string | null;
  longitude: string | null;
  created_at: Date;
}

export class PostgresProducerRepository implements ProducerRepository {
  constructor(private readonly pool: Pool) {}

  async save(producer: Producer): Promise<void> {
    const tenantId = await this.resolveTenantId(producer.tenantId);
    const userId = producer.userId ? await this.resolveUserId(producer.userId, tenantId) : null;

    await this.pool.query(
      `
        INSERT INTO public.producers (
          id,
          tenant_id,
          user_id,
          producer_type,
          organization_name,
          contact_name,
          contact_phone,
          municipality_name,
          zone_type,
          product_categories,
          status,
          latitude,
          longitude
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `,
      [
        producer.id,
        tenantId,
        userId,
        producer.producerType,
        producer.organizationName,
        producer.contactName,
        producer.contactPhone,
        producer.municipalityName,
        producer.zoneType,
        producer.productCategories,
        producer.status,
        producer.latitude,
        producer.longitude
      ]
    );
  }

  async saveBatch(producers: Producer[]): Promise<void> {
    if (producers.length === 0) return;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const p of producers) {
        await client.query(
          `INSERT INTO public.producers
             (id, tenant_id, user_id, producer_type, organization_name, contact_name,
              contact_phone, municipality_name, zone_type, product_categories,
              status, latitude, longitude)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            p.id, p.tenantId, p.userId, p.producerType, p.organizationName,
            p.contactName, p.contactPhone, p.municipalityName, p.zoneType,
            p.productCategories, p.status, p.latitude, p.longitude
          ]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async update(producer: Producer): Promise<void> {
    await this.pool.query(
      `UPDATE public.producers SET
         producer_type     = $2,
         organization_name = $3,
         contact_name      = $4,
         contact_phone     = $5,
         zone_type         = $6,
         product_categories = $7,
         latitude          = $8,
         longitude         = $9,
         status            = $10
       WHERE id = $1 AND deleted_at IS NULL`,
      [
        producer.id,
        producer.producerType,
        producer.organizationName,
        producer.contactName,
        producer.contactPhone,
        producer.zoneType,
        producer.productCategories,
        producer.latitude,
        producer.longitude,
        producer.status
      ]
    );
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE public.producers SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findById(id: string): Promise<Producer | null> {
    const result = await this.pool.query<ProducerRow>(
      `
        SELECT
          id,
          tenant_id,
          user_id,
          producer_type,
          organization_name,
          contact_name,
          contact_phone,
          municipality_name,
          zone_type,
          product_categories,
          status,
          latitude,
          longitude,
          created_at
        FROM public.producers
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [id]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Producer>> {
    const offset = (params.page - 1) * params.limit;

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM public.producers WHERE deleted_at IS NULL AND ($1::uuid IS NULL OR tenant_id = $1)`,
      [tenantId ?? null]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query<ProducerRow>(
      `
        SELECT id, tenant_id, user_id, producer_type, organization_name, contact_name, contact_phone, municipality_name, zone_type, product_categories, status, latitude, longitude, created_at
        FROM public.producers
        WHERE deleted_at IS NULL
          AND ($1::uuid IS NULL OR tenant_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [tenantId ?? null, params.limit, offset]
    );

    return {
      data: result.rows.map((row: ProducerRow) => this.mapRow(row)),
      total,
      page: params.page,
      limit: params.limit
    };
  }

  async findByOrganizationName(
    tenantIdOrCode: string,
    organizationName: string
  ): Promise<Producer | null> {
    const tenantId = await this.resolveTenantId(tenantIdOrCode);
    const result = await this.pool.query<ProducerRow>(
      `
        SELECT
          id,
          tenant_id,
          user_id,
          producer_type,
          organization_name,
          contact_name,
          contact_phone,
          municipality_name,
          zone_type,
          product_categories,
          status,
          latitude,
          longitude,
          created_at
        FROM public.producers
        WHERE tenant_id = $1
          AND LOWER(organization_name) = LOWER($2)
          AND deleted_at IS NULL
      `,
      [tenantId, organizationName.trim()]
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findStats(producerId: string): Promise<ProducerStats | null> {
    const producer = await this.findById(producerId);
    if (!producer) return null;

    const [offersResult, rescuesResult, histResult] = await Promise.all([
      this.pool.query<{ total: string; active: string }>(
        `SELECT COUNT(*)                                       AS total,
                COUNT(*) FILTER (WHERE status = 'published') AS active
         FROM public.offers
         WHERE producer_id = $1 AND deleted_at IS NULL`,
        [producerId]
      ),
      this.pool.query<{ total: string; total_kg: string; last_at: Date | null }>(
        `SELECT COUNT(*)                          AS total,
                COALESCE(SUM(quantity_rescued),0) AS total_kg,
                MAX(created_at)                   AS last_at
         FROM public.rescues
         WHERE producer_id = $1 AND deleted_at IS NULL`,
        [producerId]
      ),
      this.pool.query<{
        temporada: string; cultivo: string; hectareas: string;
        toneladas: string; ingresos: string; costos: string; fecha_corte: Date;
      }>(
        `SELECT temporada, cultivo, hectareas, toneladas, ingresos, costos, fecha_corte
         FROM public.estadisticas_productor
         WHERE producer_id = $1
         ORDER BY fecha_corte DESC
         LIMIT 24`,
        [producerId]
      )
    ]);

    const o = offersResult.rows[0];
    const r = rescuesResult.rows[0];

    return {
      producer,
      totalOffers: parseInt(o.total, 10),
      activeOffers: parseInt(o.active, 10),
      totalRescues: parseInt(r.total, 10),
      totalKgRescued: Number(r.total_kg),
      lastActivityAt: r.last_at ? r.last_at.toISOString() : null,
      historicalProduction: histResult.rows.map((row) => ({
        temporada: row.temporada,
        cultivo: row.cultivo,
        hectareas: Number(row.hectareas),
        toneladas: Number(row.toneladas),
        ingresos: Number(row.ingresos),
        costos: Number(row.costos),
        fechaCorte: row.fecha_corte.toISOString().slice(0, 10)
      }))
    };
  }

  private async resolveTenantId(tenantKey: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.tenants
        WHERE id::text = $1 OR UPPER(code) = UPPER($1)
        LIMIT 1
      `,
      [tenantKey]
    );

    if (!result.rows[0]) {
      throw new Error("TENANT_NOT_FOUND");
    }

    return result.rows[0].id;
  }

  private async resolveUserId(userId: string, tenantId: string): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `
        SELECT id
        FROM public.users
        WHERE id = $1
          AND tenant_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [userId, tenantId]
    );

    if (!result.rows[0]) {
      throw new Error("USER_NOT_FOUND_FOR_TENANT");
    }

    return result.rows[0].id;
  }

  private mapRow(row: ProducerRow): Producer {
    return new Producer({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      producerType: row.producer_type,
      organizationName: row.organization_name,
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      municipalityName: row.municipality_name,
      zoneType: row.zone_type,
      productCategories: row.product_categories,
      status: row.status,
      latitude: row.latitude !== null ? Number(row.latitude) : null,
      longitude: row.longitude !== null ? Number(row.longitude) : null,
      createdAt: row.created_at
    });
  }
}

