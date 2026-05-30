export const INSTITUTION_TYPES = [
  "educational",
  "hospital",
  "prison",
  "community_canteen",
  "airport",
  "military",
  "elderly_home",
  "shelter",
  "other"
] as const;

export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const INSTITUTION_STATUSES = [
  "pending_verification",
  "active",
  "inactive"
] as const;

export type InstitutionStatus = (typeof INSTITUTION_STATUSES)[number];

export const INSTITUTION_TYPE_LABELS: Record<InstitutionType, string> = {
  educational: "Institución Educativa",
  hospital: "Hospital / Centro de Salud",
  prison: "Centro Penitenciario",
  community_canteen: "Comedor Comunitario",
  airport: "Aeropuerto",
  military: "Base Militar",
  elderly_home: "Hogar de Adultos Mayores",
  shelter: "Albergue / Refugio",
  other: "Otra Institución"
};
