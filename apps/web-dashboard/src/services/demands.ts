import { api } from "./api";

export function fetchDemands() {
  return api<any[]>("/api/v1/demands");
}
export function registerDemand(data: any) {
  return api<any>("/api/v1/demands/register", { method: "POST", body: data });
}
export function updateDemand(id: string, data: any) {
  return api<any>(`/api/v1/demands/${id}`, { method: "PATCH", body: data });
}
