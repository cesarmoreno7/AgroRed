# Migracion Backend PHP

## Objetivo

Reemplazar el backend actual en Node/TypeScript por un backend modular en PHP, conservando PostgreSQL como base transaccional y PostGIS como motor espacial para mapas y geolocalizacion.

## Estado actual del repo

El repositorio ya incluye una base funcional en `backend-php/README.md` con:

- bootstrap propio en PHP 8
- carga de `.env` del proyecto
- conexion `PDO` a PostgreSQL
- router HTTP sin dependencias externas
- JWT HS256 sin Composer
- modulo de usuarios
- modulo de productores
- modulo de ofertas
- modulo de rescates
- modulo de demandas
- modulo de inventario
- modulo de analitica y capas geograficas
- modulo de tracking y geocercas
- modulo de incidencias
- modulo de notificaciones

## Criterio de arquitectura

- PHP queda como capa de aplicacion y exposicion REST.
- PostgreSQL conserva consultas, vistas y agregados operativos.
- PostGIS se usa donde aporta valor real:
  - jerarquias geograficas (`ST_AsGeoJSON`)
  - proximidad (`ST_DWithin`, `ST_Distance`)
  - geocercas (`ST_Buffer`, `ST_Contains`)
- Si la instancia no trae PostGIS, el backend usa `haversine_km` o fallback numerico solo como degradacion controlada.

## Modulos ya migrados a PHP

- `users`
- `producers`
- `offers`
- `rescues`
- `demands`
- `inventory`
- `incidents`
- `notifications`
- `analytics`
- `logistics` para tracking activo y geofencing
- `health`
- `catalog`

## Modulos pendientes

- `ml`
- `automation`
- `auctions`

## Estrategia recomendada de cierre

1. Cerrar `logistics-service` en PHP para altas y consulta de ordenes, no solo tracking/geocercas.
2. Aplicar SQL faltante para incidencias: `008_modulos_revision.sql`, `010_remaining_gaps.sql` y `011_alert_thresholds.sql`.
3. Portar `automation` y `auctions`.
4. Retirar el `api-gateway` Node cuando todas las rutas `/api/v1/*` ya apunten al backend PHP.

## Dependencias y degradaciones conocidas

- `inventory_items` en esta base todavia no trae `expires_at`, `latitude` ni `longitude`.
  El backend PHP guarda esos datos en `metadata` y mantiene operativos `register`, `list`, `get` y `near-expiry`.
- `incidents` en esta base todavia no trae las columnas extendidas de `008_modulos_revision.sql`.
  El backend PHP persiste `reportedBy`, `affectedPopulation`, `priorityScore`, SLA y demas campos extendidos dentro de `metadata`.
- `incident_actions`, `incident_alerts`, `alert_thresholds`, `v_incident_trends` y `v_incident_trends_daily` no existen hoy.
  Sus endpoints responden `503` con mensaje de migracion explicita en lugar de fallar con `500`.
- El despacho de `notifications` por `email` queda simulado por ahora.

## SQL espacial que debe mantenerse

- `infra/postgres/init/003_map_spatial_support.sql`
- `infra/postgres/init/004_logistics_tracking.sql`
- `infra/postgres/010_remaining_gaps.sql`
- `infra/postgres/014_territorial_gis_model.sql`
- `infra/postgres/017_railway_missing_views.sql`

## Despliegue local

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-php-backend.ps1
```

o

```powershell
& d:\xampp\php\php.exe -S 127.0.0.1:8080 .\backend-php\dev-router.php
```
