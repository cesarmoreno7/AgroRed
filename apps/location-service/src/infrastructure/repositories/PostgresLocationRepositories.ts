import type { Pool } from "pg";
import type { DepartamentoEntity, MunicipioEntity, CorregimientoEntity, VeredaEntity } from "../../domain/entities/LocationEntities.js";
import type { DepartamentoRepository, MunicipioRepository, CorregimientoRepository, VeredaRepository, PaginatedResult } from "../../domain/ports/LocationRepositories.js";

export class PostgresDepartamentoRepository implements DepartamentoRepository {
  constructor(private pool: Pool) {}

  async list(page: number, limit: number, search = ""): Promise<PaginatedResult<DepartamentoEntity>> {
    const offset = (page - 1) * limit;
    const searchPattern = `%${search}%`;

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM departamentos WHERE name ILIKE $1`,
      [searchPattern]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT id, dane_code as "codigoDane", name as nombre, is_active as "isActive",
             created_at as "createdAt"
      FROM departamentos
      WHERE name ILIKE $1
      ORDER BY name ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.pool.query(dataQuery, [searchPattern, limit, offset]);

    return {
      data: result.rows.map((r) => ({
        id: r.id,
        codigoDane: r.codigoDane,
        nombre: r.nombre,
        isActive: r.isActive,
        createdAt: r.createdAt
      })),
      total,
      page,
      limit
    };
  }

  async findById(id: string): Promise<DepartamentoEntity | null> {
    const result = await this.pool.query(
      `SELECT id, dane_code as "codigoDane", name as nombre, is_active as "isActive",
              created_at as "createdAt"
       FROM departamentos WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return { id: r.id, codigoDane: r.codigoDane, nombre: r.nombre, isActive: r.isActive, createdAt: r.createdAt };
  }

  async findByCodigoDane(codigoDane: string): Promise<DepartamentoEntity | null> {
    const result = await this.pool.query(
      `SELECT id, dane_code as "codigoDane", name as nombre, is_active as "isActive",
              created_at as "createdAt"
       FROM departamentos WHERE dane_code = $1`,
      [codigoDane]
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return { id: r.id, codigoDane: r.codigoDane, nombre: r.nombre, isActive: r.isActive, createdAt: r.createdAt };
  }

  async create(data: { codigoDane: string; nombre: string }): Promise<DepartamentoEntity> {
    const result = await this.pool.query(
      `INSERT INTO departamentos (dane_code, name)
       VALUES ($1, $2)
       RETURNING id, dane_code as "codigoDane", name as nombre, is_active as "isActive",
                 created_at as "createdAt"`,
      [data.codigoDane, data.nombre]
    );
    const r = result.rows[0];
    return { id: r.id, codigoDane: r.codigoDane, nombre: r.nombre, isActive: r.isActive, createdAt: r.createdAt };
  }

  async update(id: string, data: { codigoDane?: string; nombre?: string }): Promise<DepartamentoEntity> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.codigoDane !== undefined) {
      fields.push(`dane_code = $${paramIndex++}`);
      values.push(data.codigoDane);
    }
    if (data.nombre !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.nombre);
    }

    if (fields.length === 0) throw new Error("No fields to update");

    values.push(id);
    const result = await this.pool.query(
      `UPDATE departamentos
       SET ${fields.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING id, dane_code as "codigoDane", name as nombre, is_active as "isActive",
                 created_at as "createdAt"`,
      values
    );
    const r = result.rows[0];
    return { id: r.id, codigoDane: r.codigoDane, nombre: r.nombre, isActive: r.isActive, createdAt: r.createdAt };
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM departamentos WHERE id = $1", [id]);
  }
}

export class PostgresMunicipioRepository implements MunicipioRepository {
  constructor(private pool: Pool) {}

  async list(page: number, limit: number, search = "", departmentCode = ""): Promise<PaginatedResult<MunicipioEntity>> {
    const offset = (page - 1) * limit;
    const searchPattern = `%${search}%`;

    let whereClause = "WHERE name ILIKE $1";
    const params: unknown[] = [searchPattern];
    let paramIndex = 2;

    if (departmentCode) {
      whereClause += ` AND department_code = $${paramIndex++}`;
      params.push(departmentCode);
    }

    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM municipios ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT id, dane_code as "codigoDane", name as nombre,
             department_code as "departmentCode", department_name as "departmentName",
             latitude, longitude, population, is_active as "isActive",
             created_at as "createdAt"
      FROM municipios
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await this.pool.query(dataQuery, params);

    return {
      data: result.rows.map((r) => ({
        id: r.id,
        codigoDane: r.codigoDane,
        nombre: r.nombre,
        departmentCode: r.departmentCode,
        departmentName: r.departmentName,
        latitude: r.latitude ? parseFloat(r.latitude) : undefined,
        longitude: r.longitude ? parseFloat(r.longitude) : undefined,
        population: r.population,
        isActive: r.isActive,
        createdAt: r.createdAt
      })),
      total,
      page,
      limit
    };
  }

  async findById(id: string): Promise<MunicipioEntity | null> {
    const result = await this.pool.query(
      `SELECT id, dane_code as "codigoDane", name as nombre,
              department_code as "departmentCode", department_name as "departmentName",
              latitude, longitude, population, is_active as "isActive",
              created_at as "createdAt"
       FROM municipios WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return this.mapRow(r);
  }

  async findByCodigoDane(codigoDane: string): Promise<MunicipioEntity | null> {
    const result = await this.pool.query(
      `SELECT id, dane_code as "codigoDane", name as nombre,
              department_code as "departmentCode", department_name as "departmentName",
              latitude, longitude, population, is_active as "isActive",
              created_at as "createdAt"
       FROM municipios WHERE dane_code = $1`,
      [codigoDane]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async create(data: { codigoDane: string; nombre: string; departmentCode: string; departmentName: string; latitude?: number | null; longitude?: number | null; population?: number | null }): Promise<MunicipioEntity> {
    const result = await this.pool.query(
      `INSERT INTO municipios (dane_code, name, department_code, department_name, latitude, longitude, population)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, dane_code as "codigoDane", name as nombre,
                 department_code as "departmentCode", department_name as "departmentName",
                 latitude, longitude, population, is_active as "isActive",
                 created_at as "createdAt"`,
      [data.codigoDane, data.nombre, data.departmentCode, data.departmentName,
       data.latitude ?? null, data.longitude ?? null, data.population ?? null]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, data: { codigoDane?: string; nombre?: string; departmentCode?: string; departmentName?: string; latitude?: number | null; longitude?: number | null; population?: number | null }): Promise<MunicipioEntity> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.codigoDane !== undefined) { fields.push(`dane_code = $${paramIndex++}`); values.push(data.codigoDane); }
    if (data.nombre !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(data.nombre); }
    if (data.departmentCode !== undefined) { fields.push(`department_code = $${paramIndex++}`); values.push(data.departmentCode); }
    if (data.departmentName !== undefined) { fields.push(`department_name = $${paramIndex++}`); values.push(data.departmentName); }
    if (data.latitude !== undefined) { fields.push(`latitude = $${paramIndex++}`); values.push(data.latitude); }
    if (data.longitude !== undefined) { fields.push(`longitude = $${paramIndex++}`); values.push(data.longitude); }
    if (data.population !== undefined) { fields.push(`population = $${paramIndex++}`); values.push(data.population); }

    if (fields.length === 0) throw new Error("No fields to update");

    values.push(id);
    const result = await this.pool.query(
      `UPDATE municipios
       SET ${fields.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING id, dane_code as "codigoDane", name as nombre,
                 department_code as "departmentCode", department_name as "departmentName",
                 latitude, longitude, population, is_active as "isActive",
                 created_at as "createdAt"`,
      values
    );
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM municipios WHERE id = $1", [id]);
  }

  private mapRow(r: Record<string, unknown>): MunicipioEntity {
    return {
      id: r.id as string,
      codigoDane: r.codigoDane as string,
      nombre: r.nombre as string,
      departmentCode: r.departmentCode as string,
      departmentName: r.departmentName as string,
      latitude: r.latitude != null ? parseFloat(String(r.latitude)) : undefined,
      longitude: r.longitude != null ? parseFloat(String(r.longitude)) : undefined,
      population: r.population as number | undefined,
      isActive: r.isActive as boolean,
      createdAt: r.createdAt as Date
    };
  }
}

export class PostgresCorregimientoRepository implements CorregimientoRepository {
  constructor(private pool: Pool) {}

  async list(page: number, limit: number, municipalityCode = "", search = ""): Promise<PaginatedResult<CorregimientoEntity>> {
    const offset = (page - 1) * limit;
    const params: unknown[] = [];
    let whereClause = "WHERE 1=1";
    let paramIndex = 1;

    if (municipalityCode) {
      whereClause += ` AND municipality_code = $${paramIndex++}`;
      params.push(municipalityCode);
    }
    if (search) {
      whereClause += ` AND name ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    const countResult = await this.pool.query(`SELECT COUNT(*) FROM corregimientos ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT id, dane_code as "daneCode", name as nombre, municipality_code as "municipalityCode",
             municipality_name as "municipalityName", department_code as "departmentCode",
             latitude, longitude, population, area_km2 as "areaKm2", is_active as "isActive",
             metadata, created_at as "createdAt"
      FROM corregimientos
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await this.pool.query(dataQuery, params);

    return {
      data: result.rows.map((r) => this.mapRow(r)),
      total,
      page,
      limit
    };
  }

  async findById(id: string): Promise<CorregimientoEntity | null> {
    const result = await this.pool.query(
      `SELECT id, dane_code as "daneCode", name as nombre, municipality_code as "municipalityCode",
              municipality_name as "municipalityName", department_code as "departmentCode",
              latitude, longitude, population, area_km2 as "areaKm2", is_active as "isActive",
              metadata, created_at as "createdAt"
       FROM corregimientos WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async findByDaneCode(daneCode: string): Promise<CorregimientoEntity | null> {
    const result = await this.pool.query(
      `SELECT id, dane_code as "daneCode", name as nombre, municipality_code as "municipalityCode",
              municipality_name as "municipalityName", department_code as "departmentCode",
              latitude, longitude, population, area_km2 as "areaKm2", is_active as "isActive",
              metadata, created_at as "createdAt"
       FROM corregimientos WHERE dane_code = $1`,
      [daneCode]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async create(data: Omit<CorregimientoEntity, "id" | "createdAt" | "metadata">): Promise<CorregimientoEntity> {
    const result = await this.pool.query(
      `INSERT INTO corregimientos (dane_code, name, municipality_code, municipality_name, department_code,
                                   latitude, longitude, population, area_km2, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, dane_code as "daneCode", name as nombre, municipality_code as "municipalityCode",
                 municipality_name as "municipalityName", department_code as "departmentCode",
                 latitude, longitude, population, area_km2 as "areaKm2", is_active as "isActive",
                 metadata, created_at as "createdAt"`,
      [data.daneCode, data.nombre, data.municipalityCode, data.municipalityName, data.departmentCode,
       data.latitude ?? null, data.longitude ?? null, data.population ?? null, data.areaKm2 ?? null, data.isActive]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, data: Partial<Omit<CorregimientoEntity, "id" | "createdAt" | "metadata">>): Promise<CorregimientoEntity> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.daneCode !== undefined) { fields.push(`dane_code = $${paramIndex++}`); values.push(data.daneCode); }
    if (data.nombre !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(data.nombre); }
    if (data.municipalityCode !== undefined) { fields.push(`municipality_code = $${paramIndex++}`); values.push(data.municipalityCode); }
    if (data.municipalityName !== undefined) { fields.push(`municipality_name = $${paramIndex++}`); values.push(data.municipalityName); }
    if (data.departmentCode !== undefined) { fields.push(`department_code = $${paramIndex++}`); values.push(data.departmentCode); }
    if (data.latitude !== undefined) { fields.push(`latitude = $${paramIndex++}`); values.push(data.latitude); }
    if (data.longitude !== undefined) { fields.push(`longitude = $${paramIndex++}`); values.push(data.longitude); }
    if (data.population !== undefined) { fields.push(`population = $${paramIndex++}`); values.push(data.population); }
    if (data.areaKm2 !== undefined) { fields.push(`area_km2 = $${paramIndex++}`); values.push(data.areaKm2); }
    if (data.isActive !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(data.isActive); }

    if (fields.length === 0) throw new Error("No fields to update");

    values.push(id);
    const result = await this.pool.query(
      `UPDATE corregimientos
       SET ${fields.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING id, dane_code as "daneCode", name as nombre, municipality_code as "municipalityCode",
                 municipality_name as "municipalityName", department_code as "departmentCode",
                 latitude, longitude, population, area_km2 as "areaKm2", is_active as "isActive",
                 metadata, created_at as "createdAt"`,
      values
    );
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM corregimientos WHERE id = $1", [id]);
  }

  private mapRow(r: Record<string, unknown>): CorregimientoEntity {
    return {
      id: r.id as string,
      daneCode: r.daneCode as string,
      nombre: r.nombre as string,
      municipalityCode: r.municipalityCode as string,
      municipalityName: r.municipalityName as string,
      departmentCode: r.departmentCode as string,
      latitude: r.latitude != null ? parseFloat(String(r.latitude)) : undefined,
      longitude: r.longitude != null ? parseFloat(String(r.longitude)) : undefined,
      population: r.population as number | undefined,
      areaKm2: r.areaKm2 != null ? parseFloat(String(r.areaKm2)) : undefined,
      isActive: r.isActive as boolean,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt as Date
    };
  }
}

export class PostgresVeredaRepository implements VeredaRepository {
  constructor(private pool: Pool) {}

  async list(page: number, limit: number, corregimientoId = "", municipalityCode = "", search = ""): Promise<PaginatedResult<VeredaEntity>> {
    const offset = (page - 1) * limit;
    const params: unknown[] = [];
    let whereClause = "WHERE 1=1";
    let paramIndex = 1;

    if (corregimientoId) {
      whereClause += ` AND corregimiento_id = $${paramIndex++}`;
      params.push(corregimientoId);
    }
    if (municipalityCode) {
      whereClause += ` AND municipality_code = $${paramIndex++}`;
      params.push(municipalityCode);
    }
    if (search) {
      whereClause += ` AND name ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    const countResult = await this.pool.query(`SELECT COUNT(*) FROM veredas ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT id, name as nombre, corregimiento_id as "corregimientoId", municipality_code as "municipalityCode",
             municipality_name as "municipalityName", department_code as "departmentCode",
             latitude, longitude, population, area_km2 as "areaKm2", main_product as "mainProduct",
             is_active as "isActive", metadata, created_at as "createdAt"
      FROM veredas
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await this.pool.query(dataQuery, params);

    return {
      data: result.rows.map((r) => this.mapRow(r)),
      total,
      page,
      limit
    };
  }

  async findById(id: string): Promise<VeredaEntity | null> {
    const result = await this.pool.query(
      `SELECT id, name as nombre, corregimiento_id as "corregimientoId", municipality_code as "municipalityCode",
              municipality_name as "municipalityName", department_code as "departmentCode",
              latitude, longitude, population, area_km2 as "areaKm2", main_product as "mainProduct",
              is_active as "isActive", metadata, created_at as "createdAt"
       FROM veredas WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async create(data: Omit<VeredaEntity, "id" | "createdAt" | "metadata">): Promise<VeredaEntity> {
    const result = await this.pool.query(
      `INSERT INTO veredas (name, corregimiento_id, municipality_code, municipality_name, department_code,
                           latitude, longitude, population, area_km2, main_product, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name as nombre, corregimiento_id as "corregimientoId", municipality_code as "municipalityCode",
                 municipality_name as "municipalityName", department_code as "departmentCode",
                 latitude, longitude, population, area_km2 as "areaKm2", main_product as "mainProduct",
                 is_active as "isActive", metadata, created_at as "createdAt"`,
      [data.nombre, data.corregimientoId ?? null, data.municipalityCode, data.municipalityName, data.departmentCode,
       data.latitude ?? null, data.longitude ?? null, data.population ?? null, data.areaKm2 ?? null,
       data.mainProduct ?? null, data.isActive]
    );
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, data: Partial<Omit<VeredaEntity, "id" | "createdAt" | "metadata">>): Promise<VeredaEntity> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.nombre !== undefined) { fields.push(`name = $${paramIndex++}`); values.push(data.nombre); }
    if (data.corregimientoId !== undefined) { fields.push(`corregimiento_id = $${paramIndex++}`); values.push(data.corregimientoId); }
    if (data.municipalityCode !== undefined) { fields.push(`municipality_code = $${paramIndex++}`); values.push(data.municipalityCode); }
    if (data.municipalityName !== undefined) { fields.push(`municipality_name = $${paramIndex++}`); values.push(data.municipalityName); }
    if (data.departmentCode !== undefined) { fields.push(`department_code = $${paramIndex++}`); values.push(data.departmentCode); }
    if (data.latitude !== undefined) { fields.push(`latitude = $${paramIndex++}`); values.push(data.latitude); }
    if (data.longitude !== undefined) { fields.push(`longitude = $${paramIndex++}`); values.push(data.longitude); }
    if (data.population !== undefined) { fields.push(`population = $${paramIndex++}`); values.push(data.population); }
    if (data.areaKm2 !== undefined) { fields.push(`area_km2 = $${paramIndex++}`); values.push(data.areaKm2); }
    if (data.mainProduct !== undefined) { fields.push(`main_product = $${paramIndex++}`); values.push(data.mainProduct); }
    if (data.isActive !== undefined) { fields.push(`is_active = $${paramIndex++}`); values.push(data.isActive); }

    if (fields.length === 0) throw new Error("No fields to update");

    values.push(id);
    const result = await this.pool.query(
      `UPDATE veredas
       SET ${fields.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING id, name as nombre, corregimiento_id as "corregimientoId", municipality_code as "municipalityCode",
                 municipality_name as "municipalityName", department_code as "departmentCode",
                 latitude, longitude, population, area_km2 as "areaKm2", main_product as "mainProduct",
                 is_active as "isActive", metadata, created_at as "createdAt"`,
      values
    );
    return this.mapRow(result.rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM veredas WHERE id = $1", [id]);
  }

  private mapRow(r: Record<string, unknown>): VeredaEntity {
    return {
      id: r.id as string,
      nombre: r.nombre as string,
      corregimientoId: r.corregimientoId as string | undefined,
      municipalityCode: r.municipalityCode as string,
      municipalityName: r.municipalityName as string,
      departmentCode: r.departmentCode as string,
      latitude: r.latitude != null ? parseFloat(String(r.latitude)) : undefined,
      longitude: r.longitude != null ? parseFloat(String(r.longitude)) : undefined,
      population: r.population as number | undefined,
      areaKm2: r.areaKm2 != null ? parseFloat(String(r.areaKm2)) : undefined,
      mainProduct: r.mainProduct as string | undefined,
      isActive: r.isActive as boolean,
      metadata: (r.metadata ?? {}) as Record<string, unknown>,
      createdAt: r.createdAt as Date
    };
  }
}
