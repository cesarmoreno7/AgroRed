import { api } from "./api";

export function fetchGeofences() {
  return api<any[]>("/api/v1/logistics/geofences");
}
export function registerGeofence(data: any) {
  return api<any>("/api/v1/logistics/geofences", { method: "POST", body: data });
}
export function updateGeofence(id: string, data: any) {
  return api<any>(`/api/v1/logistics/geofences/${id}`, { method: "PATCH", body: data });
}
