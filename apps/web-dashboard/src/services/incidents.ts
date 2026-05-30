import { api } from "./api";

export function fetchIncidents() {
  return api<any[]>("/api/v1/incidents");
}

export function registerIncident(data: any) {
  return api<any>("/api/v1/incidents", { method: "POST", body: data });
}
