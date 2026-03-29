import type { AppEnv } from "../../config/env.js";

export interface ServiceRouteDefinition {
  key:
    | "users"
    | "producers"
    | "offers"
    | "rescues"
    | "demands"
    | "inventory"
    | "logistics"
    | "incidents"
    | "analytics"
    | "notifications"
    | "ml"
    | "automation"
    | "auctions";
  name: string;
  description: string;
  pathPrefix: string;
  target: string;
}

export function buildServiceRegistry(env: AppEnv): ServiceRouteDefinition[] {
  return [
    {
      key: "users",
      name: "user-service",
      description: "Autenticacion, autorizacion y perfiles de actores del ecosistema.",
      pathPrefix: "/api/v1/users",
      target: env.USER_SERVICE_URL
    },
    {
      key: "producers",
      name: "producer-service",
      description: "Registro y perfil productivo de productores rurales.",
      pathPrefix: "/api/v1/producers",
      target: env.PRODUCER_SERVICE_URL
    },
    {
      key: "offers",
      name: "offer-service",
      description: "Oferta alimentaria disponible por territorio y productor.",
      pathPrefix: "/api/v1/offers",
      target: env.OFFER_SERVICE_URL
    },
    {
      key: "rescues",
      name: "rescue-service",
      description: "Gestion de excedentes y rescate alimentario.",
      pathPrefix: "/api/v1/rescues",
      target: env.RESCUE_SERVICE_URL
    },
    {
      key: "demands",
      name: "demand-service",
      description: "Demanda institucional de comedores y programas alimentarios.",
      pathPrefix: "/api/v1/demands",
      target: env.DEMAND_SERVICE_URL
    },
    {
      key: "inventory",
      name: "inventory-service",
      description: "Inventario y trazabilidad operativa.",
      pathPrefix: "/api/v1/inventory",
      target: env.INVENTORY_SERVICE_URL
    },
    {
      key: "logistics",
      name: "logistics-service",
      description: "Rutas, entregas y seguimiento logistico.",
      pathPrefix: "/api/v1/logistics",
      target: env.LOGISTICS_SERVICE_URL
    },
    {
      key: "incidents",
      name: "incident-service",
      description: "Incidencias urbanas y rurales georreferenciadas.",
      pathPrefix: "/api/v1/incidents",
      target: env.INCIDENT_SERVICE_URL
    },
    {
      key: "analytics",
      name: "analytics-service",
      description: "Indicadores, observatorio y base para IRAT.",
      pathPrefix: "/api/v1/analytics",
      target: env.ANALYTICS_SERVICE_URL
    },
    {
      key: "notifications",
      name: "notification-service",
      description: "Notificaciones transaccionales y alertas del ecosistema.",
      pathPrefix: "/api/v1/notifications",
      target: env.NOTIFICATION_SERVICE_URL
    },
    {
      key: "ml",
      name: "ml-service",
      description: "Apoyo heuristico a decision territorial y operacional.",
      pathPrefix: "/api/v1/ml",
      target: env.ML_SERVICE_URL
    },
    {
      key: "automation",
      name: "automation-service",
      description: "Orquestacion operativa y corridas automatizadas persistidas.",
      pathPrefix: "/api/v1/automation",
      target: env.AUTOMATION_SERVICE_URL
    },
    {
      key: "auctions",
      name: "auction-service",
      description: "Subastas de excedentes alimentarios con cierre suave y modelo holandes.",
      pathPrefix: "/api/v1/auctions",
      target: env.AUCTION_SERVICE_URL
    }
  ];
}

