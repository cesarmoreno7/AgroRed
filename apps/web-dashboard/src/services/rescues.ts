import { api } from "./api";

export function fetchRescues(limit = 500) {
  return api<any[]>("/api/v1/rescues", { params: { limit } });
}
export function registerRescue(data: any) {
  return api<any>("/api/v1/rescues/register", { method: "POST", body: data });
}
export function updateRescue(id: string, data: any) {
  return api<any>(`/api/v1/rescues/${id}`, { method: "PATCH", body: data });
}
