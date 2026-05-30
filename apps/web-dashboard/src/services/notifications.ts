import { api } from "./api";

export function fetchNotifications() {
  return api<any[]>("/api/v1/notifications");
}
export function registerNotification(data: any) {
  return api<any>("/api/v1/notifications/register", { method: "POST", body: data });
}
export function updateNotification(id: string, data: any) {
  return api<any>(`/api/v1/notifications/${id}`, { method: "PATCH", body: data });
}
