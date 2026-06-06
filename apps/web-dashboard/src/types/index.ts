export interface AnalyticsTotals {
  users: number;
  producers: number;
  producersActive: number;
  offers: number;
  rescues: number;
  demands: number;
  inventoryItems: number;
  logisticsOrders: number;
  incidents: number;
  notifications: number;
  auctions: number;
}

export interface AnalyticsOperations {
  openDemands: number;
  scheduledRescues: number;
  availableInventoryUnits: number;
  reservedInventoryUnits: number;
  scheduledLogistics: number;
  openIncidents: number;
  pendingNotifications: number;
  iratScore: number | null;
  programCoverage: number | null;
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

export interface LoginRequest {
  email: string;
  password: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  modules?: string[];
}

export interface CurrentPosition {
  recursoId: string;
  nombre: string;
  tipo: string;
  estado: string;
  latitude: number;
  longitude: number;
  velocidad: number | null;
  bearing: number | null;
  evento: string;
  ordenId: string | null;
  actualizadoAt: string;
}

export interface Resource {
  id: string;
  tenantId: string;
  userId: string | null;
  nombre: string;
  tipo: string;
  placa: string | null;
  telefono: string | null;
  estado: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}
