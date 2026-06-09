import { api } from "./api";

export function fetchOrigins() {
  return api<any[]>("/api/v1/analytics/origins?limit=200");
}
export function registerOrigin(data: any) {
  return api<any>("/api/v1/analytics/origins", { method: "POST", body: data });
}
export function updateOrigin(id: string, data: any) {
  return api<any>(`/api/v1/analytics/origins/${id}`, { method: "PUT", body: data });
}
export function deleteOrigin(id: string) {
  return api<null>(`/api/v1/analytics/origins/${id}`, { method: "DELETE" });
}
