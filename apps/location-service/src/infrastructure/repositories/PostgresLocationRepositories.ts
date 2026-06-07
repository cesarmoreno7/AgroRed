import type { Pool } from "pg";
import type { DepartamentoEntity, MunicipioEntity, CorregimientoEntity, VeredaEntity } from "../../domain/entities/LocationEntities.js";
import type { DepartamentoRepository, MunicipioRepository, CorregimientoRepository, VeredaRepository, PaginatedResult } from "../../domain/ports/LocationRepositories.js";

export class PostgresDepartamentoRepository implements DepartamentoRepository {
  constructor(private pool: Pool) {}

  async list(page: number, limit: number, search = ""): Promise<PaginatedResult<DepartamentoEntity>> {
    const offset = (page - 1) * limit;
    const searchPattern = `%${search}%`;
    
    const countQuery = `SELECT COUNT(*) FROM departamentos WHERE nombre ILIKE $1`;
    const countResult = await this.pool.query(countQuery, [searchPattern]);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT id, codigo_dane as "codigoDane", nombre, created_at as "createdAt", updated_at as "updatedAt"
      FROM departamentos
      WHERE nombre ILIKE $1
      ORDER BY nombre ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.pool.query(dataQuery, [searchPattern, limit, offset]);

    return {
      data: result.rows.map((r) => ({
        id: r.id,
        codigoDane: r.codigoDane,
        nombre: r.nombre,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      })),
      total,
      page,
      limit
    };
  }

  async findById(id: string): Promise<DepartamentoEntity | null> {
    const query = `
      SELECT id, codigo_dane as "codigoDane", nombre, created_at as "createdAt", updated_at as "updatedAt"
      FROM departamentos WHERE id = $1
    `;
    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      id: r.id,
      codigoDane: r.codigoDane,
      nombre: r.nombre,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  async findByCodigoDane(codigoDane: string): Promise<DepartamentoEntity | null> {
    const query = `
      SELECT id, codigo_dane as "codigoDane", nombre, created_at as "createdAt", updated_at as "updatedAt"
      FROM departamentos WHERE codigo_dane = $1
    `;
    const result = await this.pool.query(query, [codigoDane]);
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      id: r.id,
      codigoDane: r.codigoDane,
      nombre: r.nombre,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  async create(data: { codigoDane: string; nombre: string }): Promise<DepartamentoEntity> {
    const query = `
      INSERT INTO departamentos (codigo_dane, nombre)
      VALUES ($1, $2)
      RETURNING id, codigo_dane as "codigoDane", nombre, created_at as "createdAt", updated_at as "updatedAt"
    `;
    const result = await this.pool.query(query, [data.codigoDane, data.nombre]);
    const r = result.rows[0];
    return {
      id: r.id,
      codigoDane: r.codigoDane,
      nombre: r.nombre,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  async update(id: string, data: { codigoDane?: string; nombre?: string }): Promise<DepartamentoEntity> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.codigoDane !== undefined) {
      fields.push(`codigo_dane = $${paramIndex++}`);
      values.push(data.codigoDane);
    }
    if (data.nombre !== undefined) {
      fields.push(`nombre = $${paramIndex++}`);
      values.push(data.nombre);
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    values.push(id);
    const query = `
      UPDATE departamentos
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, codigo_dane as "codigoDane", nombre, created_at as "createdAt", updated_at as "updatedAt"
    `;
    const result = await this.pool.query(query, values);
    const r = result.rows[0];
    return {
      id: r.id,
      codigoDane: r.codigoDane,
      nombre: r.nombre,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM departamentos WHERE id = $1", [id]);
  }
}

export class PostgresMunicipioRepository implements MunicipioRepository {
  constructor(private pool: Pool) {}

  async list(page: number, limit: number, search = "", departamentoId = ""): Promise<PaginatedResult<MunicipioEntity>> {
    const offset = (page - 1) * limit;
    const searchPattern = `%${search}%`;
    
    let whereClause = "WHERE m.nombre ILIKE $1";
    const params: unknown[] = [searchPattern];
    let paramIndex = 2;

    if (departamentoId) {
      whereClause += ` AND m.departamento_id = $${paramIndex++}`;
      params.push(departamentoId);
    }

    const countQuery = `SELECT COUNT(*) FROM municipios m ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `
      SELECT m.id, m.codigo_dane as "codigoDane", m.nombre, 
             m.departamento_id as "departamentoId", d.nombre as "departamentoNombre",
             m.created_at as "createdAt", m.updated_at as "updatedAt"
      FROM municipios m
      LEFT JOIN departamentos d ON m.departamento_id = d.id
      ${whereClause}
      ORDER BY m.nombre ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);
    
    const result = await this.pool.query(dataQuery, params);

    return {
      data: result.rows.map((r) => ({
        id: r.id,
        codigoDane: r.codigoDane,
        nombre: r.nombre,
        departamentoId: r.departamentoId,
        departamentoNombre: r.departamentoNombre,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      })),
      total,
      page,
      limit
    };
  }

  async findById(id: string): Promise<MunicipioEntity | null> {
    const query = `
      SELECT m.id, m.codigo_dane as "codigoDane", m.nombre, 
             m.departamento_id as "departamentoId", d.nombre as "departamentoNombre",
             m.created_at as "createdAt", m.updated_at as "updatedAt"
      FROM municipios m
      LEFT JOIN departamentos d ON m.departamento_id = d.id
      WHERE m.id = $1
    `;
    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      id: r.id,
      codigoDane: r.codigoDane,
      nombre: r.nombre,
      departamentoId: r.departamentoId,
      departamentoNombre: r.departamentoNombre,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  async findByCodigoDane(codigoDane: string): Promise<MunicipioEntity | null> {
    const query = `
      SELECT m.id, m.codigo_dane as "codigoDane", m.nombre, 
             m.departamento_id as "departamentoId", d.nombre as "departamentoNombre",
             m.created_at as "createdAt", m.updated_at as "updatedAt"
      FROM municipios m
      LEFT JOIN departamentos d ON m.departamento_id = d.id
      WHERE m.codigo_dane = $1
    `;
    const result = await this.pool.query(query, [codigoDane]);
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      id: r.id,
      codigoDane: r.codigoDane,
      nombre: r.nombre,
      departamentoId: r.departamentoId,
      departamentoNombre: r.departamentoNombre,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  async create(data: { codigoDane: string; nombre: string; departamentoId: string }): Promise<MunicipioEntity> {
    const query = `
      INSERT INTO municipios (codigo_dane, nombre, departamento_id)
      VALUES ($1, $2, $3)
      RETURNING m.id, m.codigo_dane as "codigoDane", m.nombre, 
                m.departamento_id as "departamentoId", d.nombre as "departamentoNombre",
                m.created_at as "createdAt", m.updated_at as "updatedAt"
    `;
    const result = await this.pool.query(query, [data.codigoDane, data.nombre, data.departamentoId]);
    const r = result.rows[0];
    return {
      id: r.id,
      codigoDane: r.codigoDane,
      nombre: r.nombre,
      departamentoId: r.departamentoId,
      departamentoNombre: r.departamentoNombre,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  async update(id: string, data: { codigoDane?: string; nombre?: string; departamentoId?: string }): Promise<MunicipioEntity> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.codigoDane !== undefined) {
      fields.push(`codigo_dane = $${paramIndex++}`);
      values.push(data.codigoDane);
    }
    if (data.nombre !== undefined) {
      fields.push(`nombre = $${paramIndex++}`);
      values.push(data.nombre);
    }
    if (data.departamentoId !== undefined) {
      fields.push(`departamento_id = $${paramIndex++}`);
      values.push(data.departamentoId);
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    values.push(id);
    const query = `
      UPDATE municipios
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING m.id, m.codigo_dane as "codigoDane", m.nombre, 
                m.departamento_id as "departamentoId", d.nombre as "departamentoNombre",
                m.created_at as "createdAt", m.updated_at as "updatedAt"
    `;
    const result = await this.pool.query(query, values);
    const r = result.rows[0];
    return {
      id: r.id,
      codigoDane: r.codigoDane,
      nombre: r.nombre,
      departamentoId: r.departamentoId,
      departamentoNombre: r.departamentoNombre,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM municipios WHERE id = $1", [id]);
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

    const countQuery = `SELECT COUNT(*) FROM corregimientos ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
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
      data: result.rows.map((r) => ({
        id: r.id,
        daneCode: r.danecode,
        nombre: r.nombre,
        municipalityCode: r.municipalitycode,
        municipalityName: r.municipalityname,
        departmentCode: r.departmentcode,
        latitude: r.latitude ? parseFloat(r.latitude) : undefined,
        longitude: r.longitude ? parseFloat(r.longitude) : undefined,
        population: r.population,
        areaKm2: r.areakm2 ? parseFloat(r.areakm2) : undefined,
        isActive: r.isactive,
        metadata: r.metadata,
        createdAt: r.createdat.toISOString()
      })),
      total,
      page,
      limit
    };
  }

  async findById(id: string): Promise<CorregimientoEntity | null> {
    const query = `
      SELECT id, dane_code as "daneCode", name as nombre, municipality_code as "municipalityCode",
             municipality_name as "municipalityName", department_code as "departmentCode",
             latitude, longitude, population, area_km2 as "areaKm2", is_active as "isActive",
             metadata, created_at as "createdAt"
      FROM corregimientos WHERE id = $1
    `;
    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      id: r.id,
      daneCode: r.danecode,
      nombre: r.nombre,
      municipalityCode: r.municipalitycode,
      municipalityName: r.municipalityname,
      departmentCode: r.departmentcode,
      latitude: r.latitude ? parseFloat(r.latitude) : undefined,
      longitude: r.longitude ? parseFloat(r.longitude) : undefined,
      population: r.population,
      areaKm2: r.areakm2 ? parseFloat(r.areakm2) : undefined,
      isActive: r.isactive,
      metadata: r.metadata,
      createdAt: r.createdat
    };
  }

  async findByDaneCode(daneCode: string): Promise<CorregimientoEntity | null> {
    const query = `
      SELECT id, dane_code as "daneCode", name as nombre, municipality_code as "municipalityCode",
             municipality_name as "municipalityName", department_code as "departmentCode",
             latitude, longitude, population, area_km2 as "areaKm2", is_active as "isActive",
             metadata, created_at as "createdAt"
      FROM corregimientos WHERE dane_code = $1
    `;
    const result = await this.pool.query(query, [daneCode]);
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      id: r.id,
      daneCode: r.danecode,
      nombre: r.nombre,
      municipalityCode: r.municipalitycode,
      municipalityName: r.municipalityname,
      departmentCode: r.departmentcode,
      latitude: r.latitude ? parseFloat(r.latitude) : undefined,
      longitude: r.longitude ? parseFloat(r.longitude) : undefined,
      population: r.population,
      areaKm2: r.areakm2 ? parseFloat(r.areakm2) : undefined,
      isActive: r.isactive,
      metadata: r.metadata,
      createdAt: r.createdat
    };
  }

  async create(data: Omit<CorregimientoEntity, "id" | "createdAt" | "metadata">): Promise<CorregimientoEntity> {
    const query = `
      INSERT INTO corregimientos (dane_code, name, municipality_code, municipality_name, department_code, 
                                   latitude, longitude, population, area_km2, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, dane_code as "daneCode", name as nombre, municipality_code as "municipalityCode",
                municipality_name as "municipalityName", department_code as "departmentCode",
                latitude, longitude, population, area_km2 as "areaKm2", is_active as "isActive",
                metadata, created_at as "createdAt"
    `;
    const result = await this.pool.query(query, [
      data.daneCode, data.nombre, data.municipalityCode, data.municipalityName, data.departmentCode,
      data.latitude ?? null, data.longitude ?? null, data.population ?? null, data.areaKm2 ?? null, data.isActive
    ]);
    const r = result.rows[0];
    return {
      id: r.id,
      daneCode: r.danecode,
      nombre: r.nombre,
      municipalityCode: r.municipalitycode,
      municipalityName: r.municipalityname,
      departmentCode: r.departmentcode,
      latitude: r.latitude ? parseFloat(r.latitude) : undefined,
      longitude: r.longitude ? parseFloat(r.longitude) : undefined,
      population: r.population,
      areaKm2: r.areakm2 ? parseFloat(r.areakm2) : undefined,
      isActive: r.isactive,
      metadata: r.metadata,
      createdAt: r.createdat
    };
  }

  async update(id: string, data: Partial<Omit<CorregimientoEntity, "id" | "createdAt" | "metadata">>): Promise<CorregimientoEntity> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.daneCode !== undefined) {
      fields.push(`dane_code = $${paramIndex++}`);
      values.push(data.daneCode);
    }
    if (data.nombre !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.nombre);
    }
    if (data.municipalityCode !== undefined) {
      fields.push(`municipality_code = $${paramIndex++}`);
      values.push(data.municipalityCode);
    }
    if (data.municipalityName !== undefined) {
      fields.push(`municipality_name = $${paramIndex++}`);
      values.push(data.municipalityName);
    }
    if (data.departmentCode !== undefined) {
      fields.push(`department_code = $${paramIndex++}`);
      values.push(data.departmentCode);
    }
    if (data.latitude !== undefined) {
      fields.push(`latitude = $${paramIndex++}`);
      values.push(data.latitude);
    }
    if (data.longitude !== undefined) {
      fields.push(`longitude = $${paramIndex++}`);
      values.push(data.longitude);
    }
    if (data.population !== undefined) {
      fields.push(`population = $${paramIndex++}`);
      values.push(data.population);
    }
    if (data.areaKm2 !== undefined) {
      fields.push(`area_km2 = $${paramIndex++}`);
      values.push(data.areaKm2);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    values.push(id);
    const query = `
      UPDATE corregimientos
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, dane_code as "daneCode", name as nombre, municipality_code as "municipalityCode",
                municipality_name as "municipalityName", department_code as "departmentCode",
                latitude, longitude, population, area_km2 as "areaKm2", is_active as "isActive",
                metadata, created_at as "createdAt"
    `;
    const result = await this.pool.query(query, values);
    const r = result.rows[0];
    return {
      id: r.id,
      daneCode: r.danecode,
      nombre: r.nombre,
      municipalityCode: r.municipalitycode,
      municipalityName: r.municipalityname,
      departmentCode: r.departmentcode,
      latitude: r.latitude ? parseFloat(r.latitude) : undefined,
      longitude: r.longitude ? parseFloat(r.longitude) : undefined,
      population: r.population,
      areaKm2: r.areakm2 ? parseFloat(r.areakm2) : undefined,
      isActive: r.isactive,
      metadata: r.metadata,
      createdAt: r.createdat
    };
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM corregimientos WHERE id = $1", [id]);
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

    const countQuery = `SELECT COUNT(*) FROM veredas ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
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
      data: result.rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        corregimientoId: r.corregimientoid,
        municipalityCode: r.municipalitycode,
        municipalityName: r.municipalityname,
        departmentCode: r.departmentcode,
        latitude: r.latitude ? parseFloat(r.latitude) : undefined,
        longitude: r.longitude ? parseFloat(r.longitude) : undefined,
        population: r.population,
        areaKm2: r.areakm2 ? parseFloat(r.areakm2) : undefined,
        mainProduct: r.mainproduct,
        isActive: r.isactive,
        metadata: r.metadata,
        createdAt: r.createdat.toISOString()
      })),
      total,
      page,
      limit
    };
  }

  async findById(id: string): Promise<VeredaEntity | null> {
    const query = `
      SELECT id, name as nombre, corregimiento_id as "corregimientoId", municipality_code as "municipalityCode",
             municipality_name as "municipalityName", department_code as "departmentCode",
             latitude, longitude, population, area_km2 as "areaKm2", main_product as "mainProduct",
             is_active as "isActive", metadata, created_at as "createdAt"
      FROM veredas WHERE id = $1
    `;
    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      id: r.id,
      nombre: r.nombre,
      corregimientoId: r.corregimientoid,
      municipalityCode: r.municipalitycode,
      municipalityName: r.municipalityname,
      departmentCode: r.departmentcode,
      latitude: r.latitude ? parseFloat(r.latitude) : undefined,
      longitude: r.longitude ? parseFloat(r.longitude) : undefined,
      population: r.population,
      areaKm2: r.areakm2 ? parseFloat(r.areakm2) : undefined,
      mainProduct: r.mainproduct,
      isActive: r.isactive,
      metadata: r.metadata,
      createdAt: r.createdat
    };
  }

  async create(data: Omit<VeredaEntity, "id" | "createdAt" | "metadata">): Promise<VeredaEntity> {
    const query = `
      INSERT INTO veredas (name, corregimiento_id, municipality_code, municipality_name, department_code,
                           latitude, longitude, population, area_km2, main_product, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, name as nombre, corregimiento_id as "corregimientoId", municipality_code as "municipalityCode",
                municipality_name as "municipalityName", department_code as "departmentCode",
                latitude, longitude, population, area_km2 as "areaKm2", main_product as "mainProduct",
                is_active as "isActive", metadata, created_at as "createdAt"
    `;
    const result = await this.pool.query(query, [
      data.nombre, data.corregimientoId ?? null, data.municipalityCode, data.municipalityName, data.departmentCode,
      data.latitude ?? null, data.longitude ?? null, data.population ?? null, data.areaKm2 ?? null, 
      data.mainProduct ?? null, data.isActive
    ]);
    const r = result.rows[0];
    return {
      id: r.id,
      nombre: r.nombre,
      corregimientoId: r.corregimientoid,
      municipalityCode: r.municipalitycode,
      municipalityName: r.municipalityname,
      departmentCode: r.departmentcode,
      latitude: r.latitude ? parseFloat(r.latitude) : undefined,
      longitude: r.longitude ? parseFloat(r.longitude) : undefined,
      population: r.population,
      areaKm2: r.areakm2 ? parseFloat(r.areakm2) : undefined,
      mainProduct: r.mainproduct,
      isActive: r.isactive,
      metadata: r.metadata,
      createdAt: r.createdat
    };
  }

  async update(id: string, data: Partial<Omit<VeredaEntity, "id" | "createdAt" | "metadata">>): Promise<VeredaEntity> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.nombre !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.nombre);
    }
    if (data.corregimientoId !== undefined) {
      fields.push(`corregimiento_id = $${paramIndex++}`);
      values.push(data.corregimientoId);
    }
    if (data.municipalityCode !== undefined) {
      fields.push(`municipality_code = $${paramIndex++}`);
      values.push(data.municipalityCode);
    }
    if (data.municipalityName !== undefined) {
      fields.push(`municipality_name = $${paramIndex++}`);
      values.push(data.municipalityName);
    }
    if (data.departmentCode !== undefined) {
      fields.push(`department_code = $${paramIndex++}`);
      values.push(data.departmentCode);
    }
    if (data.latitude !== undefined) {
      fields.push(`latitude = $${paramIndex++}`);
      values.push(data.latitude);
    }
    if (data.longitude !== undefined) {
      fields.push(`longitude = $${paramIndex++}`);
      values.push(data.longitude);
    }
    if (data.population !== undefined) {
      fields.push(`population = $${paramIndex++}`);
      values.push(data.population);
    }
    if (data.areaKm2 !== undefined) {
      fields.push(`area_km2 = $${paramIndex++}`);
      values.push(data.areaKm2);
    }
    if (data.mainProduct !== undefined) {
      fields.push(`main_product = $${paramIndex++}`);
      values.push(data.mainProduct);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }

    if (fields.length === 0) {
      throw new Error("No fields to update");
    }

    values.push(id);
    const query = `
      UPDATE veredas
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING id, name as nombre, corregimiento_id as "corregimientoId", municipality_code as "municipalityCode",
                municipality_name as "municipalityName", department_code as "departmentCode",
                latitude, longitude, population, area_km2 as "areaKm2", main_product as "mainProduct",
                is_active as "isActive", metadata, created_at as "createdAt"
    `;
    const result = await this.pool.query(query, values);
    const r = result.rows[0];
    return {
      id: r.id,
      nombre: r.nombre,
      corregimientoId: r.corregimientoid,
      municipalityCode: r.municipalitycode,
      municipalityName: r.municipalityname,
      departmentCode: r.departmentcode,
      latitude: r.latitude ? parseFloat(r.latitude) : undefined,
      longitude: r.longitude ? parseFloat(r.longitude) : undefined,
      population: r.population,
      areaKm2: r.areakm2 ? parseFloat(r.areakm2) : undefined,
      mainProduct: r.mainproduct,
      isActive: r.isactive,
      metadata: r.metadata,
      createdAt: r.createdat
    };
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM veredas WHERE id = $1", [id]);
  }
}
