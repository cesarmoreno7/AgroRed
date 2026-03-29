import type { Pool } from "pg";
import type { MapRepository } from "../../domain/ports/MapRepository.js";
import type {
  GeoJsonFeatureCollection,
  GeoJsonFeature,
  GeoJsonPoint,
  GeoJsonMultiPolygon,
  MapProducerProperties,
  MapOfferProperties,
  MapCanteenProperties,
  MapRescueProperties,
  MapIncidentProperties,
  MapDemandProperties,
  MapResourceProperties,
  NearbyProducerProperties,
  HierarchyProperties,
  MapBboxFilter,
  NearbyQuery,
} from "../../domain/models/GeoTypes.js";

function bboxClause(bbox: MapBboxFilter | undefined, lngCol: string, latCol: string, paramOffset: number): { sql: string; params: unknown[] } {
  if (!bbox) return { sql: "", params: [] };
  return {
    sql: ` AND ${lngCol} >= $${paramOffset} AND ${lngCol} <= $${paramOffset + 1} AND ${latCol} >= $${paramOffset + 2} AND ${latCol} <= $${paramOffset + 3}`,
    params: [bbox.minLng, bbox.maxLng, bbox.minLat, bbox.maxLat],
  };
}

function pointFeature<P>(lng: number, lat: number, properties: P): GeoJsonFeature<GeoJsonPoint, P> {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties,
  };
}

function featureCollection<G extends GeoJsonPoint | GeoJsonMultiPolygon, P>(
  features: GeoJsonFeature<G, P>[]
): GeoJsonFeatureCollection<G, P> {
  return { type: "FeatureCollection", features };
}

// ── Row interfaces ──────────────────────────────────────────

interface ProducerMapRow {
  id: string;
  nombre: string;
  tipo: string;
  contact_name: string;
  contact_phone: string;
  product_categories: string[];
  status: string;
  zona: string | null;
  comuna: string | null;
  municipio: string | null;
  departamento: string | null;
  longitud: string;
  latitud: string;
}

interface OfferMapRow {
  id: string;
  title: string;
  product_name: string;
  category: string;
  quantity_available: string;
  unit: string;
  price_amount: string | null;
  currency: string | null;
  available_from: Date | null;
  available_until: Date | null;
  punto_entrega: string | null;
  status: string;
  productor: string;
  contact_phone: string;
  longitud: string;
  latitud: string;
}

interface CanteenMapRow {
  id: number;
  nombre: string;
  tipo: string;
  direccion: string;
  capacidad_diaria: number | null;
  beneficiarios_actuales: number;
  horario_atencion: string | null;
  responsable: string | null;
  telefono: string | null;
  estado: string;
  zona: string | null;
  comuna: string | null;
  municipio: string | null;
  departamento: string | null;
  longitud: string;
  latitud: string;
}

interface RescueMapRow {
  id: string;
  product_name: string;
  quantity: string;
  unit: string;
  status: string;
  scheduled_date: Date | null;
  latitude: string;
  longitude: string;
}

interface IncidentMapRow {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  reported_at: Date;
  latitude: string;
  longitude: string;
}

interface DemandMapRow {
  id: string;
  product_name: string;
  quantity_required: string;
  unit: string;
  status: string;
  required_by: Date | null;
  latitude: string;
  longitude: string;
}

interface NearbyProducerRow extends ProducerMapRow {
  distancia_metros: string;
}

interface ResourceMapRow {
  id: string;
  nombre: string;
  tipo: string;
  placa: string | null;
  telefono: string | null;
  estado: string;
  velocidad: string | null;
  orden_actual_id: string | null;
  ultima_actualizacion: Date | null;
  longitude: string;
  latitude: string;
}

interface HierarchyRow {
  id: number;
  nombre: string;
  parent_id: number | null;
  parent_nombre: string | null;
  geojson: string;
}

// ── Repository ──────────────────────────────────────────────

export class PostgresMapRepository implements MapRepository {
  constructor(private readonly pool: Pool) {}

  // ── Producers (uses v_mapa_productores view + fallback to lat/lon) ──

  async getProducers(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapProducerProperties>> {
    const bboxFilter = bboxClause(bbox, "longitud", "latitud", 1);

    const result = await this.pool.query<ProducerMapRow>(
      `
        SELECT id, nombre, tipo, contact_name, contact_phone,
               product_categories, status, zona, comuna, municipio, departamento,
               longitud, latitud
        FROM v_mapa_productores
        WHERE 1=1 ${bboxFilter.sql}

        UNION ALL

        SELECT p.id, p.organization_name AS nombre, p.producer_type AS tipo,
               p.contact_name, p.contact_phone, p.product_categories, p.status,
               NULL AS zona, NULL AS comuna, p.municipality_name AS municipio, NULL AS departamento,
               p.longitude::text AS longitud, p.latitude::text AS latitud
        FROM producers p
        WHERE p.deleted_at IS NULL
          AND p.latitude IS NOT NULL
          AND p.longitude IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM v_mapa_productores v WHERE v.id = p.id)
          ${bboxFilter.sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + bboxFilter.params.length}`)}
      `,
      [...bboxFilter.params, ...bboxFilter.params]
    );

    const features = result.rows.map((r) =>
      pointFeature<MapProducerProperties>(Number(r.longitud), Number(r.latitud), {
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo,
        contactName: r.contact_name,
        contactPhone: r.contact_phone,
        productCategories: r.product_categories,
        status: r.status,
        zona: r.zona,
        comuna: r.comuna,
        municipio: r.municipio,
        departamento: r.departamento,
      })
    );

    return featureCollection(features);
  }

  // ── Offers (uses v_mapa_ofertas view + fallback) ──

  async getOffers(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapOfferProperties>> {
    const bboxFilter = bboxClause(bbox, "longitud", "latitud", 1);

    const result = await this.pool.query<OfferMapRow>(
      `
        SELECT id, title, product_name, category, quantity_available::text,
               unit, price_amount::text, currency,
               available_from, available_until, punto_entrega,
               status, productor, contact_phone,
               longitud, latitud
        FROM v_mapa_ofertas
        WHERE 1=1 ${bboxFilter.sql}

        UNION ALL

        SELECT o.id, o.title, o.product_name, o.category, o.quantity_available::text,
               o.unit, o.price_amount::text, o.currency,
               o.available_from, o.available_until, NULL AS punto_entrega,
               o.status,
               p.organization_name AS productor, p.contact_phone,
               o.longitude::text AS longitud, o.latitude::text AS latitud
        FROM offers o
        JOIN producers p ON o.producer_id = p.id
        WHERE o.status = 'published'
          AND o.deleted_at IS NULL
          AND o.latitude IS NOT NULL AND o.longitude IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM v_mapa_ofertas v WHERE v.id = o.id
          )
          ${bboxFilter.sql.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + bboxFilter.params.length}`)}
      `,
      [...bboxFilter.params, ...bboxFilter.params]
    );

    const features = result.rows.map((r) =>
      pointFeature<MapOfferProperties>(Number(r.longitud), Number(r.latitud), {
        id: r.id,
        title: r.title,
        productName: r.product_name,
        category: r.category,
        quantityAvailable: Number(r.quantity_available),
        unit: r.unit,
        priceAmount: r.price_amount !== null ? Number(r.price_amount) : null,
        currency: r.currency,
        availableFrom: r.available_from?.toISOString() ?? null,
        availableUntil: r.available_until?.toISOString() ?? null,
        puntoEntrega: r.punto_entrega,
        status: r.status,
        productor: r.productor,
        contactPhone: r.contact_phone,
      })
    );

    return featureCollection(features);
  }

  // ── Canteens (uses v_mapa_comedores view) ──

  async getCanteens(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapCanteenProperties>> {
    const bboxFilter = bboxClause(bbox, "longitud", "latitud", 1);

    const result = await this.pool.query<CanteenMapRow>(
      `
        SELECT id, nombre, tipo, direccion, capacidad_diaria,
               beneficiarios_actuales, horario_atencion, responsable, telefono,
               estado, zona, comuna, municipio, departamento,
               longitud, latitud
        FROM v_mapa_comedores
        WHERE 1=1 ${bboxFilter.sql}
      `,
      bboxFilter.params
    );

    const features = result.rows.map((r) =>
      pointFeature<MapCanteenProperties>(Number(r.longitud), Number(r.latitud), {
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo,
        direccion: r.direccion,
        capacidadDiaria: r.capacidad_diaria,
        beneficiariosActuales: r.beneficiarios_actuales,
        horarioAtencion: r.horario_atencion,
        responsable: r.responsable,
        telefono: r.telefono,
        estado: r.estado,
        zona: r.zona,
        comuna: r.comuna,
        municipio: r.municipio,
        departamento: r.departamento,
      })
    );

    return featureCollection(features);
  }

  // ── Rescues (lat/lon from rescues table) ──

  async getRescues(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapRescueProperties>> {
    const bboxFilter = bboxClause(bbox, "longitude", "latitude", 1);

    const result = await this.pool.query<RescueMapRow>(
      `
        SELECT id, product_name, quantity::text, unit, status,
               scheduled_date, latitude::text, longitude::text
        FROM rescues
        WHERE deleted_at IS NULL
          AND latitude IS NOT NULL AND longitude IS NOT NULL
          ${bboxFilter.sql}
      `,
      bboxFilter.params
    );

    const features = result.rows.map((r) =>
      pointFeature<MapRescueProperties>(Number(r.longitude), Number(r.latitude), {
        id: r.id,
        productName: r.product_name,
        quantity: Number(r.quantity),
        unit: r.unit,
        status: r.status,
        scheduledDate: r.scheduled_date?.toISOString() ?? null,
      })
    );

    return featureCollection(features);
  }

  // ── Incidents ──

  async getIncidents(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapIncidentProperties>> {
    const bboxFilter = bboxClause(bbox, "longitude", "latitude", 1);

    const result = await this.pool.query<IncidentMapRow>(
      `
        SELECT id, title, category, severity, status,
               created_at AS reported_at, latitude::text, longitude::text
        FROM incidents
        WHERE deleted_at IS NULL
          AND latitude IS NOT NULL AND longitude IS NOT NULL
          ${bboxFilter.sql}
      `,
      bboxFilter.params
    );

    const features = result.rows.map((r) =>
      pointFeature<MapIncidentProperties>(Number(r.longitude), Number(r.latitude), {
        id: r.id,
        title: r.title,
        category: r.category,
        severity: r.severity,
        status: r.status,
        reportedAt: r.reported_at.toISOString(),
      })
    );

    return featureCollection(features);
  }

  // ── Demands ──

  async getDemands(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapDemandProperties>> {
    const bboxFilter = bboxClause(bbox, "longitude", "latitude", 1);

    const result = await this.pool.query<DemandMapRow>(
      `
        SELECT id, product_name, quantity_required::text, unit, status,
               required_by, latitude::text, longitude::text
        FROM demands
        WHERE deleted_at IS NULL
          AND latitude IS NOT NULL AND longitude IS NOT NULL
          ${bboxFilter.sql}
      `,
      bboxFilter.params
    );

    const features = result.rows.map((r) =>
      pointFeature<MapDemandProperties>(Number(r.longitude), Number(r.latitude), {
        id: r.id,
        productName: r.product_name,
        quantityRequired: Number(r.quantity_required),
        unit: r.unit,
        status: r.status,
        requiredBy: r.required_by?.toISOString() ?? null,
      })
    );

    return featureCollection(features);
  }

  // ── Nearby Producers (PostGIS proximity) ──

  async getNearbyProducers(query: NearbyQuery): Promise<GeoJsonFeatureCollection<GeoJsonPoint, NearbyProducerProperties>> {
    const radiusKm = query.radiusKm;

    const result = await this.pool.query<NearbyProducerRow>(
      `
        SELECT
          p.id,
          p.organization_name AS nombre,
          p.producer_type AS tipo,
          p.contact_name,
          p.contact_phone,
          p.product_categories,
          p.status,
          z.nombre AS zona,
          c.nombre AS comuna,
          m.nombre AS municipio,
          d.nombre AS departamento,
          p.longitude::text AS longitud,
          p.latitude::text AS latitud,
          ROUND(haversine_km(p.latitude, p.longitude, $2, $1) * 1000)::text AS distancia_metros
        FROM producers p
        LEFT JOIN zona z ON p.zona_id = z.id
        LEFT JOIN comuna c ON p.comuna_id = c.id
        LEFT JOIN municipio m ON p.municipio_id = m.id
        LEFT JOIN departamento d ON m.departamento_id = d.id
        WHERE p.deleted_at IS NULL
          AND p.latitude IS NOT NULL
          AND p.longitude IS NOT NULL
          AND haversine_km(p.latitude, p.longitude, $2, $1) <= $3
        ORDER BY distancia_metros ASC
      `,
      [query.lng, query.lat, radiusKm]
    );

    const features = result.rows.map((r) =>
      pointFeature<NearbyProducerProperties>(Number(r.longitud), Number(r.latitud), {
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo,
        contactName: r.contact_name,
        contactPhone: r.contact_phone,
        productCategories: r.product_categories,
        status: r.status,
        zona: r.zona,
        comuna: r.comuna,
        municipio: r.municipio,
        departamento: r.departamento,
        distanciaMetros: Number(r.distancia_metros),
      })
    );

    return featureCollection(features);
  }

  // ── Resources (logistics tracking: vehicles, drivers) ──

  async getResources(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapResourceProperties>> {
    const bboxFilter = bboxClause(bbox, "longitude", "latitude", 1);

    const result = await this.pool.query<ResourceMapRow>(
      `
        SELECT r.id, r.nombre, r.tipo, r.placa, r.telefono, r.estado,
               ta.velocidad::text,
               ta.orden_id AS orden_actual_id,
               ta.actualizado_at AS ultima_actualizacion,
               ta.longitude::text,
               ta.latitude::text
        FROM recursos r
        INNER JOIN tracking_actual ta ON ta.recurso_id = r.id
        WHERE r.estado IN ('disponible', 'en_ruta')
          AND ta.latitude IS NOT NULL
          ${bboxFilter.sql}
      `,
      bboxFilter.params
    );

    const features = result.rows.map((r) =>
      pointFeature<MapResourceProperties>(Number(r.longitude), Number(r.latitude), {
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo,
        placa: r.placa,
        telefono: r.telefono,
        estado: r.estado,
        velocidad: r.velocidad !== null ? Number(r.velocidad) : null,
        ordenActualId: r.orden_actual_id,
        ultimaActualizacion: r.ultima_actualizacion?.toISOString() ?? null,
      })
    );

    return featureCollection(features);
  }

  // ── Geographic hierarchy: Departamentos ──

  async getDepartamentos(): Promise<GeoJsonFeatureCollection<GeoJsonMultiPolygon, HierarchyProperties>> {
    try {
      const result = await this.pool.query<HierarchyRow>(
        `
          SELECT
            d.id,
            d.nombre,
            d.pais_id AS parent_id,
            p.nombre AS parent_nombre,
            CASE WHEN d.geom IS NOT NULL THEN d.geom::text ELSE NULL END AS geojson
          FROM departamento d
          LEFT JOIN pais p ON d.pais_id = p.id
          WHERE d.geom IS NOT NULL
          ORDER BY d.nombre
        `
      );

      const features = result.rows.map((r) => ({
        type: "Feature" as const,
        geometry: JSON.parse(r.geojson) as GeoJsonMultiPolygon,
        properties: {
          id: r.id,
          nombre: r.nombre,
          parentId: r.parent_id,
          parentNombre: r.parent_nombre,
        },
      }));

      return featureCollection(features);
    } catch {
      // PostGIS not available — return empty collection
      return featureCollection([]);
    }
  }

  // ── Geographic hierarchy: Municipios ──

  async getMunicipios(departamentoId?: number): Promise<GeoJsonFeatureCollection<GeoJsonMultiPolygon, HierarchyProperties>> {
    const whereClause = departamentoId !== undefined ? "AND m.departamento_id = $1" : "";
    const params = departamentoId !== undefined ? [departamentoId] : [];

    try {
      const result = await this.pool.query<HierarchyRow>(
        `
          SELECT
            m.id,
            m.nombre,
            m.departamento_id AS parent_id,
            d.nombre AS parent_nombre,
            CASE WHEN m.geom IS NOT NULL THEN m.geom::text ELSE NULL END AS geojson
          FROM municipio m
          LEFT JOIN departamento d ON m.departamento_id = d.id
          WHERE m.geom IS NOT NULL ${whereClause}
          ORDER BY m.nombre
        `,
        params
      );

      const features = result.rows.map((r) => ({
        type: "Feature" as const,
        geometry: JSON.parse(r.geojson) as GeoJsonMultiPolygon,
        properties: {
          id: r.id,
          nombre: r.nombre,
          parentId: r.parent_id,
          parentNombre: r.parent_nombre,
        },
      }));

      return featureCollection(features);
    } catch {
      // PostGIS not available — return empty collection
      return featureCollection([]);
    }
  }
}
