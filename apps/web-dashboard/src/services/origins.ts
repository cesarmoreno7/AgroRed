import { api } from "./api";

export function fetchOrigins() {
  return api<any[]>("/api/v1/rescues/origins");
}
export function registerOrigin(data: any) {
  return api<any>("/api/v1/rescues/origins", { method: "POST", body: data });
}
export function updateOrigin(id: string, data: any) {
  return api<any>(`/api/v1/rescues/origins/${id}`, { method: "PATCH", body: data });
}
export function deleteOrigin(id: string) {
  return api<null>(`/api/v1/rescues/origins/${id}`, { method: "DELETE" });
}
