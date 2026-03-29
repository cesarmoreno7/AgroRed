export interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface GeoJsonMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

export type GeoJsonGeometry = GeoJsonPoint | GeoJsonPolygon | GeoJsonMultiPolygon;

export interface GeoJsonFeature<G extends GeoJsonGeometry = GeoJsonGeometry, P = Record<string, unknown>> {
  type: "Feature";
  geometry: G;
  properties: P;
}

export interface GeoJsonFeatureCollection<G extends GeoJsonGeometry = GeoJsonGeometry, P = Record<string, unknown>> {
  type: "FeatureCollection";
  features: GeoJsonFeature<G, P>[];
}

export interface MapProducerProperties {
  id: string;
  nombre: string;
  tipo: string;
  contactName: string;
  contactPhone: string;
  productCategories: string[];
  status: string;
  zona: string | null;
  comuna: string | null;
  municipio: string | null;
  departamento: string | null;
}

export interface MapOfferProperties {
  id: string;
  title: string;
  productName: string;
  category: string;
  quantityAvailable: number;
  unit: string;
  priceAmount: number | null;
  currency: string | null;
  availableFrom: string | null;
  availableUntil: string | null;
  puntoEntrega: string | null;
  status: string;
  productor: string;
  contactPhone: string;
}

export interface MapCanteenProperties {
  id: number;
  nombre: string;
  tipo: string;
  direccion: string;
  capacidadDiaria: number | null;
  beneficiariosActuales: number;
  horarioAtencion: string | null;
  responsable: string | null;
  telefono: string | null;
  estado: string;
  zona: string | null;
  comuna: string | null;
  municipio: string | null;
  departamento: string | null;
}

export interface MapRescueProperties {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  status: string;
  scheduledDate: string | null;
}

export interface MapIncidentProperties {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  reportedAt: string;
}

export interface MapDemandProperties {
  id: string;
  productName: string;
  quantityRequired: number;
  unit: string;
  status: string;
  requiredBy: string | null;
}

export interface MapResourceProperties {
  id: string;
  nombre: string;
  tipo: string;
  placa: string | null;
  telefono: string | null;
  estado: string;
  velocidad: number | null;
  ordenActualId: string | null;
  ultimaActualizacion: string | null;
}

export interface NearbyProducerProperties extends MapProducerProperties {
  distanciaMetros: number;
}

export interface MapBboxFilter {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface NearbyQuery {
  lng: number;
  lat: number;
  radiusKm: number;
}

export interface HierarchyProperties {
  id: number;
  nombre: string;
  parentId: number | null;
  parentNombre: string | null;
}
