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
  // ── Entregas ──────────────────────────────────────────────
  deliveries: number;
  deliveriesReceived: number;
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
  // ── Entregas ──────────────────────────────────────────────
  pendingDeliveries: number;
  deliveriesKgTotal: number;
  deliveriesValueTotal: number;
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
  // ── Entregas ──────────────────────────────────────────────
  totalDeliveries: number;
  deliveriesReceived: number;
  deliveriesValueTotal: number;
}
