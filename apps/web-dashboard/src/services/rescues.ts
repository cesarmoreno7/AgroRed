import { api } from "./api";

export function fetchRescues() {
  return api<any[]>("/api/v1/rescues");
}
export function registerRescue(data: any) {
  return api<any>("/api/v1/rescues/register", { method: "POST", body: data });
}
export function updateRescue(id: string, data: any) {
  return api<any>(`/api/v1/rescues/${id}`, { method: "PATCH", body: data });
}
