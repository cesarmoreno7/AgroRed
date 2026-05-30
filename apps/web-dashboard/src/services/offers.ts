import { api } from "./api";

export function fetchOffers() {
  return api<any[]>("/api/v1/offers");
}
export function registerOffer(data: any) {
  return api<any>("/api/v1/offers", { method: "POST", body: data });
}
export function updateOffer(id: string, data: any) {
  return api<any>(`/api/v1/offers/${id}`, { method: "PATCH", body: data });
}
