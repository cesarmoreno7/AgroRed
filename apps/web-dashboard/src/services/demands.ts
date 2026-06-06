import { api } from "./api";

export function fetchDemands(limit = 500) {
  return api<any[]>("/api/v1/demands", { params: { limit } });
}
export function registerDemand(data: any) {
  return api<any>("/api/v1/demands/register", { method: "POST", body: data });
}
export function updateDemand(id: string, data: any) {
  return api<any>(`/api/v1/demands/${id}`, { method: "PATCH", body: data });
}
