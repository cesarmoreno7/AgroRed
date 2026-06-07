import { api, ApiResult } from "./api";

export interface Departamento {
  id: string;
  codigoDane: string;
  nombre: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Municipio {
  id: string;
  codigoDane: string;
  nombre: string;
  departamentoId: string;
  departamentoNombre?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ===================== DEPARTAMENTOS =====================

export async function fetchDepartamentos(page = 1, limit = 50, search = ""): Promise<ApiResult<PaginatedResponse<Departamento>>> {
  return api<PaginatedResponse<Departamento>>("/api/departamentos", {
    params: { page, limit, search },
  });
}

export async function fetchDepartamentoById(id: string): Promise<ApiResult<Departamento>> {
  return api<Departamento>(`/api/departamentos/${id}`);
}

export async function createDepartamento(data: { codigoDane: string; nombre: string }): Promise<ApiResult<Departamento>> {
  return api<Departamento>("/api/departamentos", {
    method: "POST",
    body: data,
  });
}

export async function updateDepartamento(id: string, data: { codigoDane?: string; nombre?: string }): Promise<ApiResult<Departamento>> {
  return api<Departamento>(`/api/departamentos/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteDepartamento(id: string): Promise<ApiResult<{ message: string }>> {
  return api<{ message: string }>(`/api/departamentos/${id}`, {
    method: "DELETE",
  });
}

// ===================== MUNICIPIOS =====================

export async function fetchMunicipios(page = 1, limit = 50, search = "", departamentoId = ""): Promise<ApiResult<PaginatedResponse<Municipio>>> {
  return api<PaginatedResponse<Municipio>>("/api/municipios", {
    params: { page, limit, search, departamentoId },
  });
}

export async function fetchMunicipioById(id: string): Promise<ApiResult<Municipio>> {
  return api<Municipio>(`/api/municipios/${id}`);
}

export async function createMunicipio(data: { codigoDane: string; nombre: string; departamentoId: string }): Promise<ApiResult<Municipio>> {
  return api<Municipio>("/api/municipios", {
    method: "POST",
    body: data,
  });
}

export async function updateMunicipio(id: string, data: { codigoDane?: string; nombre?: string; departamentoId?: string }): Promise<ApiResult<Municipio>> {
  return api<Municipio>(`/api/municipios/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteMunicipio(id: string): Promise<ApiResult<{ message: string }>> {
  return api<{ message: string }>(`/api/municipios/${id}`, {
    method: "DELETE",
  });
}

// ===================== CORREGIMIENTOS =====================

export interface Corregimiento {
  id: string;
  codigoDane: string;
  nombre: string;
  municipioId: string;
  municipioNombre?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchCorregimientos(page = 1, limit = 50, search = "", municipioId = ""): Promise<ApiResult<PaginatedResponse<Corregimiento>>> {
  return api<PaginatedResponse<Corregimiento>>("/api/corregimientos", {
    params: { page, limit, search, municipioId },
  });
}

export async function fetchCorregimientoById(id: string): Promise<ApiResult<Corregimiento>> {
  return api<Corregimiento>(`/api/corregimientos/${id}`);
}

export async function createCorregimiento(data: { codigoDane: string; nombre: string; municipioId: string }): Promise<ApiResult<Corregimiento>> {
  return api<Corregimiento>("/api/corregimientos", {
    method: "POST",
    body: data,
  });
}

export async function updateCorregimiento(id: string, data: { codigoDane?: string; nombre?: string; municipioId?: string }): Promise<ApiResult<Corregimiento>> {
  return api<Corregimiento>(`/api/corregimientos/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteCorregimiento(id: string): Promise<ApiResult<{ message: string }>> {
  return api<{ message: string }>(`/api/corregimientos/${id}`, {
    method: "DELETE",
  });
}

// ===================== VEREDAS =====================

export interface Vereda {
  id: string;
  codigoDane: string;
  nombre: string;
  municipioId: string;
  municipioNombre?: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function fetchVeredas(page = 1, limit = 50, search = "", municipioId = ""): Promise<ApiResult<PaginatedResponse<Vereda>>> {
  return api<PaginatedResponse<Vereda>>("/api/veredas", {
    params: { page, limit, search, municipioId },
  });
}

export async function fetchVeredaById(id: string): Promise<ApiResult<Vereda>> {
  return api<Vereda>(`/api/veredas/${id}`);
}

export async function createVereda(data: { codigoDane: string; nombre: string; municipioId: string }): Promise<ApiResult<Vereda>> {
  return api<Vereda>("/api/veredas", {
    method: "POST",
    body: data,
  });
}

export async function updateVereda(id: string, data: { codigoDane?: string; nombre?: string; municipioId?: string }): Promise<ApiResult<Vereda>> {
  return api<Vereda>(`/api/veredas/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteVereda(id: string): Promise<ApiResult<{ message: string }>> {
  return api<{ message: string }>(`/api/veredas/${id}`, {
    method: "DELETE",
  });
}
