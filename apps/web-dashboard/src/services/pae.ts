import { api } from "./api";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Alcance (municipios visibles para supervisor_departamental) ──
export function getPaeScope() {
  return api<{ tenantIds: string[] }>("/api/v1/pae/scope");
}

export function getPaeOverview() {
  return api<any>("/api/v1/pae");
}

// ── Operadores ──
export function listOperators(tenantId?: string) {
  return api<any[]>("/api/v1/pae/operators", { params: { tenantId } });
}
export function createOperator(data: any) {
  return api<any>("/api/v1/pae/operators", { method: "POST", body: data });
}

// ── Inspecciones ──
export function listInspections(params: Record<string, string | undefined> = {}) {
  return api<any[]>("/api/v1/pae/inspections", { params });
}
export function classifyInspection(data: any) {
  return api<any>("/api/v1/pae/inspections/classify", { method: "POST", body: data });
}
export function createInspection(data: any) {
  return api<any>("/api/v1/pae/inspections", { method: "POST", body: data });
}

// ── Requerimientos ──
export function listRequerimientos(params: Record<string, string | undefined> = {}) {
  return api<any[]>("/api/v1/pae/requerimientos", { params });
}
export function respondRequerimiento(id: string, data: { responseNotes: string; status?: string }) {
  return api<any>(`/api/v1/pae/requerimientos/${id}/respond`, { method: "PATCH", body: data });
}
export function closeRequerimiento(id: string, status: "subsanado" | "archivada" = "archivada") {
  return api<any>(`/api/v1/pae/requerimientos/${id}/close`, { method: "PATCH", body: { status } });
}
export function escalateRequerimientoToSanction(id: string) {
  return api<any>(`/api/v1/pae/requerimientos/${id}/escalate-to-sanction`, { method: "POST", body: {} });
}

// ── Sanciones ──
export function listSanctions(params: Record<string, string | undefined> = {}) {
  return api<any[]>("/api/v1/pae/sanctions", { params });
}
export function proposeSanction(data: any) {
  return api<any>("/api/v1/pae/sanctions", { method: "POST", body: data });
}
export function applySanction(id: string, resolutionDocUrl?: string) {
  return api<any>(`/api/v1/pae/sanctions/${id}/apply`, { method: "PATCH", body: { resolutionDocUrl } });
}

// ── CAE ──
export function listCaeReports(params: Record<string, string | undefined> = {}) {
  return api<any[]>("/api/v1/pae/cae/reports", { params });
}
export function triageCaeReport(id: string, data: { status: string; triageNotes?: string }) {
  return api<any>(`/api/v1/pae/cae/reports/${id}/triage`, { method: "PATCH", body: data });
}
export function createCaeCommittee(data: any) {
  return api<any>("/api/v1/pae/cae/committees", { method: "POST", body: data });
}

// ── Formulario público (sin token de sesión) ──
export function getPublicCaeForm(token: string) {
  return api<{ schoolName: string; municipality: string; categories: string[] }>(
    `/api/v1/pae/cae/public/${token}`
  );
}
export function submitPublicCaeReport(token: string, data: any) {
  return api<{ trackingCode: string; status: string }>(`/api/v1/pae/cae/public/${token}`, {
    method: "POST",
    body: data
  });
}
