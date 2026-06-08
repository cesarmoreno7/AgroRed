import { api, ApiResult } from "./api";

export interface Departamento {
  id: string;
  codigoDane: string;
  nombre: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface Municipio {
  id: string;
  codigoDane: string;
  nombre: string;
  departmentCode: string;
  departmentName: string;
  latitude?: number;
  longitude?: number;
  population?: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface Corregimiento {
  id: string;
  daneCode: string;
  nombre: string;
  municipalityCode: string;
  municipalityName: string;
  departmentCode: string;
  latitude?: number;
  longitude?: number;
  population?: number;
  areaKm2?: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface Vereda {
  id: string;
  nombre: string;
  corregimientoId?: string;
  municipalityCode: string;
  municipalityName: string;
  departmentCode: string;
  latitude?: number;
  longitude?: number;
  population?: number;
  areaKm2?: number;
  mainProduct?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ===================== DEPARTAMENTOS =====================

export async function fetchDepartamentos(page = 1, limit = 50, search = ""): Promise<ApiResult<PaginatedResponse<Departamento>>> {
  return api<PaginatedResponse<Departamento>>("/api/v1/departamentos", {
    params: { page, limit, search },
  });
}

export async function fetchDepartamentoById(id: string): Promise<ApiResult<Departamento>> {
  return api<Departamento>(`/api/v1/departamentos/${id}`);
}

export async function createDepartamento(data: { codigoDane: string; nombre: string }): Promise<ApiResult<Departamento>> {
  return api<Departamento>("/api/v1/departamentos", {
    method: "POST",
    body: data,
  });
}

export async function updateDepartamento(id: string, data: { codigoDane?: string; nombre?: string }): Promise<ApiResult<Departamento>> {
  return api<Departamento>(`/api/v1/departamentos/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteDepartamento(id: string): Promise<ApiResult<void>> {
  return api<void>(`/api/v1/departamentos/${id}`, {
    method: "DELETE",
  });
}

// ===================== MUNICIPIOS =====================

export async function fetchMunicipios(
  page = 1,
  limit = 50,
  search = "",
  departmentCode = ""
): Promise<ApiResult<PaginatedResponse<Municipio>>> {
  return api<PaginatedResponse<Municipio>>("/api/v1/municipios", {
    params: { page, limit, search, departmentCode },
  });
}

export async function fetchMunicipioById(id: string): Promise<ApiResult<Municipio>> {
  return api<Municipio>(`/api/v1/municipios/${id}`);
}

export async function createMunicipio(data: {
  codigoDane: string;
  nombre: string;
  departmentCode: string;
  departmentName: string;
  latitude?: number;
  longitude?: number;
  population?: number;
}): Promise<ApiResult<Municipio>> {
  return api<Municipio>("/api/v1/municipios", {
    method: "POST",
    body: data,
  });
}

export async function updateMunicipio(
  id: string,
  data: {
    codigoDane?: string;
    nombre?: string;
    departmentCode?: string;
    departmentName?: string;
    latitude?: number;
    longitude?: number;
    population?: number;
  }
): Promise<ApiResult<Municipio>> {
  return api<Municipio>(`/api/v1/municipios/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteMunicipio(id: string): Promise<ApiResult<void>> {
  return api<void>(`/api/v1/municipios/${id}`, {
    method: "DELETE",
  });
}

// ===================== CORREGIMIENTOS =====================

export async function fetchCorregimientos(
  page = 1,
  limit = 50,
  search = "",
  municipalityCode = ""
): Promise<ApiResult<PaginatedResponse<Corregimiento>>> {
  return api<PaginatedResponse<Corregimiento>>("/api/v1/corregimientos", {
    params: { page, limit, search, municipalityCode },
  });
}

export async function fetchCorregimientoById(id: string): Promise<ApiResult<Corregimiento>> {
  return api<Corregimiento>(`/api/v1/corregimientos/${id}`);
}

export async function createCorregimiento(data: {
  daneCode: string;
  nombre: string;
  municipalityCode: string;
  municipalityName: string;
  departmentCode: string;
  latitude?: number;
  longitude?: number;
  population?: number;
  areaKm2?: number;
}): Promise<ApiResult<Corregimiento>> {
  return api<Corregimiento>("/api/v1/corregimientos", {
    method: "POST",
    body: data,
  });
}

export async function updateCorregimiento(
  id: string,
  data: {
    daneCode?: string;
    nombre?: string;
    municipalityCode?: string;
    municipalityName?: string;
    departmentCode?: string;
    latitude?: number;
    longitude?: number;
    population?: number;
    areaKm2?: number;
  }
): Promise<ApiResult<Corregimiento>> {
  return api<Corregimiento>(`/api/v1/corregimientos/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteCorregimiento(id: string): Promise<ApiResult<void>> {
  return api<void>(`/api/v1/corregimientos/${id}`, {
    method: "DELETE",
  });
}

// ===================== VEREDAS =====================

export async function fetchVeredas(
  page = 1,
  limit = 50,
  search = "",
  municipalityCode = ""
): Promise<ApiResult<PaginatedResponse<Vereda>>> {
  return api<PaginatedResponse<Vereda>>("/api/v1/veredas", {
    params: { page, limit, search, municipalityCode },
  });
}

export async function fetchVeredaById(id: string): Promise<ApiResult<Vereda>> {
  return api<Vereda>(`/api/v1/veredas/${id}`);
}

export async function createVereda(data: {
  nombre: string;
  municipalityCode: string;
  municipalityName: string;
  departmentCode: string;
  corregimientoId?: string;
  latitude?: number;
  longitude?: number;
  population?: number;
  areaKm2?: number;
  mainProduct?: string;
}): Promise<ApiResult<Vereda>> {
  return api<Vereda>("/api/v1/veredas", {
    method: "POST",
    body: data,
  });
}

export async function updateVereda(
  id: string,
  data: {
    nombre?: string;
    municipalityCode?: string;
    municipalityName?: string;
    departmentCode?: string;
    corregimientoId?: string;
    latitude?: number;
    longitude?: number;
    population?: number;
    areaKm2?: number;
    mainProduct?: string;
  }
): Promise<ApiResult<Vereda>> {
  return api<Vereda>(`/api/v1/veredas/${id}`, {
    method: "PUT",
    body: data,
  });
}

export async function deleteVereda(id: string): Promise<ApiResult<void>> {
  return api<void>(`/api/v1/veredas/${id}`, {
    method: "DELETE",
  });
}
