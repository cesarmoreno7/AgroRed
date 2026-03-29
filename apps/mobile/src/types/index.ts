// ── GeoJSON ──

export interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoJsonFeature<P = Record<string, unknown>> {
  type: "Feature";
  geometry: GeoJsonPoint;
  properties: P;
}

export interface GeoJsonFeatureCollection<P = Record<string, unknown>> {
  type: "FeatureCollection";
  features: GeoJsonFeature<P>[];
}

// ── Map layer properties ──

export interface ProducerProps {
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

export interface OfferProps {
  id: string;
  title: string;
  productName: string;
  category: string;
  quantityAvailable: number;
  unit: string;
  priceAmount: number | null;
  currency: string | null;
  status: string;
  productor: string;
}

export interface CanteenProps {
  id: number;
  nombre: string;
  tipo: string;
  direccion: string;
  capacidadDiaria: number | null;
  beneficiariosActuales: number;
  estado: string;
}

export interface RescueProps {
  id: string;
  productName: string;
  quantity: number;
  unit: string;
  status: string;
  scheduledDate: string | null;
}

export interface IncidentProps {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  reportedAt: string;
}

export interface DemandProps {
  id: string;
  productName: string;
  quantityRequired: number;
  unit: string;
  status: string;
  requiredBy: string | null;
}

export interface ResourceProps {
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

export interface NearbyProducerProps extends ProducerProps {
  distanciaMetros: number;
}

// ── Auth ──

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: string;
}

// ── Tracking ──

export type ResourceType = "vehiculo" | "domiciliario" | "bicicleta" | "moto" | "otro";
export type ResourceStatus = "disponible" | "en_ruta" | "inactivo" | "mantenimiento";

export type TrackingEvent =
  | "posicion"
  | "inicio_ruta"
  | "llegada_origen"
  | "recogida"
  | "en_transito"
  | "llegada_destino"
  | "entregado"
  | "pausa"
  | "reanudacion";

export type DeliveryEvent =
  | "asignado"
  | "aceptado"
  | "rechazado"
  | "inicio_ruta"
  | "llegada_origen"
  | "recogida"
  | "en_transito"
  | "llegada_destino"
  | "entregado"
  | "no_entregado"
  | "cancelado"
  | "pausa"
  | "reanudacion";

export interface Resource {
  id: string;
  tenantId: string;
  userId: string | null;
  nombre: string;
  tipo: ResourceType;
  placa: string | null;
  telefono: string | null;
  estado: ResourceStatus;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

export interface CurrentPosition {
  recursoId: string;
  nombre: string;
  tipo: ResourceType;
  estado: ResourceStatus;
  latitude: number;
  longitude: number;
  velocidad: number | null;
  bearing: number | null;
  evento: string;
  ordenId: string | null;
  actualizadoAt: string;
}

export interface TrackingPointData {
  recursoId: string;
  ordenId?: string;
  latitude: number;
  longitude: number;
  velocidad?: number;
  precisionGps?: number;
  bearing?: number;
  evento?: TrackingEvent;
}

export interface DeliveryEventRecord {
  id: number;
  ordenId: string;
  recursoId: string;
  recursoNombre: string;
  evento: DeliveryEvent;
  latitude: number | null;
  longitude: number | null;
  notas: string | null;
  evidenciaUrl: string | null;
  registradoAt: string;
}

// ── Navigation ──

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  DeliveryDetail: { ordenId: string };
  ResourceDetail: { resourceId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  Tracking: undefined;
  Profile: undefined;
};

// ── Analytics ──

export interface AnalyticsTotals {
  users: number;
  producers: number;
  offers: number;
  rescues: number;
  demands: number;
  inventoryItems: number;
  logisticsOrders: number;
  incidents: number;
  notifications: number;
}

export interface AnalyticsOperations {
  openDemands: number;
  scheduledRescues: number;
  availableInventoryUnits: number;
  reservedInventoryUnits: number;
  scheduledLogistics: number;
  openIncidents: number;
  pendingNotifications: number;
}

export interface AnalyticsSummary {
  tenantId: string | null;
  tenantCode: string | null;
  tenantName: string | null;
  totals: AnalyticsTotals;
  operations: AnalyticsOperations;
  generatedAt: string;
}

export interface TerritorialOverviewItem {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  producers: number;
  offers: number;
  openDemands: number;
  inventoryUnits: number;
  scheduledLogistics: number;
  openIncidents: number;
  pendingNotifications: number;
}
