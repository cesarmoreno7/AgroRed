import type { Notification } from "../entities/Notification.js";
import type { NotificationStatus } from "../value-objects/NotificationStatus.js";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface NotificationRepository {
  save(notification: Notification): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  list(params: PaginationParams, tenantId?: string | null): Promise<PaginatedResult<Notification>>;
  updateStatus(id: string, status: NotificationStatus): Promise<void>;
  findPending(limit: number): Promise<Notification[]>;
}