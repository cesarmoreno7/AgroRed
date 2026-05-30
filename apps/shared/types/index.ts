// Shared domain types used across AgroRed microservices.
// Import as: import type { AgroUser, AgroOffer, ... } from "@agrored/shared/types.js"

export interface AgroUser {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export interface AgroProducer {
  id: string;
  tenantId: string;
  fullName: string;
  nit: string;
  municipalityName: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

export interface AgroOffer {
  id: string;
  tenantId: string;
  producerId: string;
  title: string;
  productName: string;
  category: string;
  unit: string;
  quantityAvailable: number;
  priceAmount: number;
  currency: string;
  availableFrom: string;
  availableUntil?: string;
  municipalityName: string;
  latitude?: number;
  longitude?: number;
  status: "available" | "reserved" | "closed";
  createdAt: string;
}

export interface AgroDemand {
  id: string;
  tenantId: string;
  institutionName: string;
  productName: string;
  category: string;
  unit: string;
  quantityNeeded: number;
  requiredFrom: string;
  requiredUntil?: string;
  municipalityName: string;
  status: "open" | "matched" | "fulfilled" | "cancelled";
  createdAt: string;
}

export interface AgroAuction {
  id: string;
  tenantId: string;
  producerId: string;
  productName: string;
  category: string;
  unit: string;
  quantityKg: number;
  auctionType: "standard" | "dutch" | "sealed";
  basePrice: number;
  currentPrice: number;
  currency: string;
  status: "active" | "extended" | "closed" | "cancelled";
  endsAt: string;
  municipalityName: string;
  winnerId?: string;
  winnerPrice?: number;
}

export interface AgroNotification {
  id: string;
  tenantId: string;
  recipientId: string;
  recipientEmail: string;
  type: string;
  subject: string;
  body: string;
  status: "pending" | "sent" | "failed";
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ServiceHealthStatus {
  status: "ok" | "degraded" | "down";
  database?: string;
  redis?: string;
  latencyMs?: number;
}

export interface GatewayRequestHeaders {
  "x-user-id": string;
  "x-tenant-id": string;
  "x-user-email": string;
  "x-user-role": string;
  "x-correlation-id"?: string;
}
