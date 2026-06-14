import { api } from "./api";
import type { ApiResult } from "./api";

// ── Domain types ─────────────────────────────────────────────

export type EstadoEntrega = "pendiente" | "recibido" | "parcial" | "rechazado";

export interface DetalleEntrega {
  id?: string;
  productoId: string;
  cantidadEntregada: number;
  unidadMedida: string;
  precioUnitario?: number | null;
  lote?: string | null;
  fechaVencimiento?: string | null;
  observacion?: string | null;
  producto_nombre?: string;
}

export interface EntregaRecord {
  id: string;
  numero_entrega: string;
  productor_id: string;
  institucion_id: string;
  fecha_entrega: string;
  hora_entrega: string | null;
  lugar_entrega: string | null;
  recibido_por: string | null;
  documento_soporte: string | null;
  observaciones: string | null;
  estado: EstadoEntrega;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
  productor_nombre?: string;
  institucion_nombre?: string;
  total_items?: number;
  valor_total?: number;
  detalle?: DetalleEntrega[];
}

export interface EntregaListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EntregaListResponse {
  data: EntregaRecord[];
  meta: EntregaListMeta;
}

export interface EntregaInput {
  productorId: string;
  institucionId: string;
  fechaEntrega: string;
  horaEntrega?: string | null;
  lugarEntrega?: string | null;
  recibirPor?: string | null;
  documentoSoporte?: string | null;
  observaciones?: string | null;
  estado?: EstadoEntrega;
  creadoPor?: string | null;
  detalle: DetalleEntrega[];
}

// ── API functions ─────────────────────────────────────────────

export function fetchEntregas(params?: {
  productor_id?: string;
  institucion_id?: string;
  estado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  page?: number;
  limit?: number;
}): Promise<ApiResult<EntregaListResponse>> {
  const cleanParams: Record<string, string | number> = {};
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") cleanParams[k] = v as string | number;
    }
  }
  return api<EntregaListResponse>("/api/v1/entregas", { params: cleanParams });
}

export function fetchEntrega(id: string): Promise<ApiResult<EntregaRecord>> {
  return api<EntregaRecord>(`/api/v1/entregas/${id}`);
}

export function createEntrega(data: EntregaInput): Promise<ApiResult<EntregaRecord>> {
  return api<EntregaRecord>("/api/v1/entregas", { method: "POST", body: data });
}

export function updateEntrega(id: string, data: Partial<EntregaInput>): Promise<ApiResult<EntregaRecord>> {
  return api<EntregaRecord>(`/api/v1/entregas/${id}`, { method: "PUT", body: data });
}

export function deleteEntrega(id: string): Promise<ApiResult<null>> {
  return api<null>(`/api/v1/entregas/${id}`, { method: "DELETE" });
}
