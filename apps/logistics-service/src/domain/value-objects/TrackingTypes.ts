export const RESOURCE_TYPES = ["vehiculo", "domiciliario", "bicicleta", "moto", "otro"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const RESOURCE_STATUSES = ["disponible", "en_ruta", "inactivo", "mantenimiento"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export const TRACKING_EVENTS = [
  "posicion", "inicio_ruta", "llegada_origen", "recogida",
  "en_transito", "llegada_destino", "entregado", "pausa", "reanudacion"
] as const;
export type TrackingEvent = (typeof TRACKING_EVENTS)[number];

export const DELIVERY_EVENTS = [
  "asignado", "aceptado", "rechazado",
  "inicio_ruta", "llegada_origen", "recogida",
  "en_transito", "llegada_destino", "entregado",
  "no_entregado", "cancelado", "pausa", "reanudacion"
] as const;
export type DeliveryEvent = (typeof DELIVERY_EVENTS)[number];
