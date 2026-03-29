import Constants from "expo-constants";

const devGatewayUrl = "http://192.168.1.100:8080";

const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;

export const API_BASE_URL: string = extra?.apiBaseUrl ?? devGatewayUrl;

export const ENDPOINTS = {
  // Auth (user-service via gateway)
  login: "/api/v1/users/login",
  register: "/api/v1/users/register",

  // Map (analytics-service via gateway)
  mapLayer: (layer: string) => `/api/v1/analytics/map/${layer}`,
  nearbyProducers: "/api/v1/analytics/map/nearby/producers",
  hierarchyDepartamentos: "/api/v1/analytics/map/hierarchy/departamentos",
  hierarchyMunicipios: "/api/v1/analytics/map/hierarchy/municipios",

  // Logistics resources
  resourceRegister: "/api/v1/logistics/resources/register",
  resourceList: "/api/v1/logistics/resources",
  resourceById: (id: string) => `/api/v1/logistics/resources/${id}`,

  // GPS Tracking
  trackingPosition: "/api/v1/logistics/tracking/position",
  trackingBatch: "/api/v1/logistics/tracking/positions/batch",
  trackingCurrent: (id: string) => `/api/v1/logistics/tracking/current/${id}`,
  trackingActive: "/api/v1/logistics/tracking/active",
  trackingHistory: (id: string) => `/api/v1/logistics/tracking/history/${id}`,
  trackingRoute: (id: string) => `/api/v1/logistics/tracking/route/${id}`,

  // Delivery events
  deliveryEvents: "/api/v1/logistics/deliveries/events",
  deliveryTimeline: (id: string) => `/api/v1/logistics/deliveries/${id}/timeline`,

  // Assignment
  assignResource: (ordenId: string) => `/api/v1/logistics/${ordenId}/assign`,

  // Analytics
  analyticsSummary: "/api/v1/analytics/summary",
  territorialOverview: "/api/v1/analytics/territorial-overview",
} as const;

export const MAP_LAYERS = [
  "producers",
  "offers",
  "canteens",
  "rescues",
  "incidents",
  "demands",
  "resources",
] as const;

export type MapLayerName = (typeof MAP_LAYERS)[number];

export const LAYER_LABELS: Record<MapLayerName, string> = {
  producers: "Productores",
  offers: "Ofertas",
  canteens: "Comedores",
  rescues: "Rescates",
  incidents: "Incidentes",
  demands: "Demandas",
  resources: "Recursos logísticos",
};

export const LAYER_COLORS: Record<MapLayerName, string> = {
  producers: "#4CAF50",
  offers: "#FF9800",
  canteens: "#2196F3",
  rescues: "#9C27B0",
  incidents: "#F44336",
  demands: "#795548",
  resources: "#00BCD4",
};

export const GPS_CONFIG = {
  intervalMs: 5000,
  distanceIntervalMeters: 10,
  batchSize: 100,
  offlineFlushIntervalMs: 30000,
} as const;
