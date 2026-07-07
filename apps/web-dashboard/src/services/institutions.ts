import { api } from "./api";

export function fetchInstitutions(limit = 100) {
  return api<any[]>("/api/v1/institutions", { params: { limit } });
}

export function registerInstitution(data: any) {
  return api<any>("/api/v1/institutions/register", { method: "POST", body: data });
}

export function updateInstitution(id: string, data: any) {
  return api<any>(`/api/v1/institutions/${id}`, { method: "PUT", body: data });
}

export function updateInstitutionStatus(id: string, status: string) {
  return api<any>(`/api/v1/institutions/${id}/status`, { method: "PATCH", body: { status } });
}

export function deleteInstitution(id: string) {
  return api<null>(`/api/v1/institutions/${id}`, { method: "DELETE" });
}
