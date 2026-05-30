import { api } from "./api";

export function fetchInventory() {
  return api<any[]>("/api/v1/inventory");
}
export function registerInventoryItem(data: any) {
  return api<any>("/api/v1/inventory/register", { method: "POST", body: data });
}
export function updateInventoryItem(id: string, data: any) {
  return api<any>(`/api/v1/inventory/${id}`, { method: "PATCH", body: data });
}
