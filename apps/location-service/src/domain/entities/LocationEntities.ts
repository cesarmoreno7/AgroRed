export interface DepartamentoEntity {
  id: string;
  codigoDane: string;
  nombre: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MunicipioEntity {
  id: string;
  codigoDane: string;
  nombre: string;
  departamentoId: string;
  departamentoNombre?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CorregimientoEntity {
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
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface VeredaEntity {
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
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
