import { api } from "./api";

export function fetchOffers(limit = 500) {
  return api<any[]>("/api/v1/offers", { params: { limit } });
}
export function registerOffer(data: any) {
  return api<any>("/api/v1/offers", { method: "POST", body: data });
}
export function updateOffer(id: string, data: any) {
  return api<any>(`/api/v1/offers/${id}`, { method: "PATCH", body: data });
}
