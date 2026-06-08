export interface DepartamentoEntity {
  id: string;
  codigoDane: string;
  nombre: string;
  isActive: boolean;
  createdAt: Date;
}

export interface MunicipioEntity {
  id: string;
  codigoDane: string;
  nombre: string;
  departmentCode: string;
  departmentName: string;
  latitude?: number;
  longitude?: number;
  population?: number;
  isActive: boolean;
  createdAt: Date;
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
