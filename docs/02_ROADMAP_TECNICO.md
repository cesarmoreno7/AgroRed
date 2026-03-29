# Roadmap tecnico inicial

## Fase 0. Fundacion tecnica

- monorepo
- PostgreSQL + PostGIS persistente
- API Gateway
- template hexagonal

## Fase 1. Identidad y actores

- `user-service`
- `producer-service`
- roles RBAC
- onboarding por municipio

## Fase 2. Oferta, demanda y rescate

- `offer-service`
- `demand-service`
- `rescue-service`
- primeras reglas de trazabilidad

## Fase 3. Logistica e incidencias

- `logistics-service`
- `incident-service`
- rutas, entregas y novedades territoriales

## Fase 4. Inventario y analitica

- `inventory-service`
- `analytics-service`
- dataset operativo para observatorio e IRAT

## Fase 5. Inteligencia territorial

- `notification-service`
- `ml-service`
- `automation-service`
- observatorio e IRAT productivo

## Estado actual del repositorio

- `user-service` inicial implementado
- `producer-service` inicial implementado
- `offer-service` inicial implementado
- `rescue-service` inicial implementado
- `demand-service` inicial implementado
- `inventory-service` inicial implementado
- `logistics-service` inicial implementado
- `incident-service` inicial implementado
- `notification-service` inicial implementado
- `analytics-service` inicial implementado
- `ml-service` inicial implementado
- `automation-service` inicial implementado
- `api-gateway` tipado y validado
- persistencia PostgreSQL real activa en servicios de negocio base