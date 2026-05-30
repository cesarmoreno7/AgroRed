## Backend PHP de AGRORED

Base nueva del backend en PHP 8 sobre PostgreSQL, manteniendo la parte espacial en la base de datos.

### Incluido en este corte

- `GET /health`
- `GET /api/v1/catalog/services`
- `POST /api/v1/users/register`
- `POST /api/v1/users/login`
- `GET /api/v1/users`
- `GET /api/v1/users/{id}`
- `POST /api/v1/producers/register`
- `POST /api/v1/producers/import/csv`
- `GET /api/v1/producers`
- `GET /api/v1/producers/{id}`
- `POST /api/v1/offers/publish`
- `GET /api/v1/offers`
- `GET /api/v1/offers/{id}`
- `POST /api/v1/rescues/register`
- `GET /api/v1/rescues`
- `GET /api/v1/rescues/{id}`
- `POST /api/v1/demands/register`
- `GET /api/v1/demands`
- `GET /api/v1/demands/{id}`
- `POST /api/v1/inventory/register`
- `GET /api/v1/inventory`
- `GET /api/v1/inventory/{id}`
- `POST /api/v1/inventory/import/csv`
- `GET /api/v1/inventory/near-expiry/{tenantId}`
- `GET /api/v1/analytics/summary`
- `GET /api/v1/analytics/territorial-overview`
- `GET /api/v1/analytics/map/{layer}`
- `GET /api/v1/analytics/map/nearby/producers`
- `GET /api/v1/analytics/map/hierarchy/departamentos`
- `GET /api/v1/analytics/map/hierarchy/municipios`
- `GET /api/v1/logistics/tracking/active`
- `POST /api/v1/logistics/geofences`
- `GET /api/v1/logistics/geofences`
- `POST /api/v1/logistics/geofences/check`
- `POST /api/v1/incidents/register`
- `GET /api/v1/incidents`
- `GET /api/v1/incidents/{id}`
- `PATCH /api/v1/incidents/{id}/status`
- `POST /api/v1/incidents/{id}/prioritize`
- `GET /api/v1/incidents/analytics/{tenantId}`
- `GET /api/v1/incidents/analytics/{tenantId}/clusters`
- `POST /api/v1/incidents/classify`
- `POST /api/v1/incidents/register-auto`
- `POST /api/v1/notifications/register`
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/{id}`
- `POST /api/v1/notifications/{id}/dispatch`
- `POST /api/v1/notifications/dispatch-pending`

### Enfoque espacial

- PHP gestiona HTTP, validacion y orquestacion.
- PostgreSQL/PostGIS sigue resolviendo geometria, cercania y geocercas.
- Si PostGIS no esta disponible, el backend usa `haversine_km` o un fallback matematico controlado.
- El matching de ofertas a demandas se calcula en PHP y puede persistir notificaciones si la tabla `notifications` ya tiene `offer_id`.
- `inventory` usa `metadata` como fallback si `expires_at` o coordenadas aun no existen en `inventory_items`.
- `incidents` usa `metadata` como fallback para campos extendidos mientras no se aplique `infra/postgres/008_modulos_revision.sql`.
- `notifications/:id/dispatch` deja el envio `email` en modo simulado y solo persiste el cambio de estado en PostgreSQL.

### Dependencias SQL pendientes en esta base

- `infra/postgres/008_modulos_revision.sql` para `incident_actions` e `incident_alerts`
- `infra/postgres/010_remaining_gaps.sql` para `v_incident_trends`, `v_incident_trends_daily` y `geofence_zones`
- `infra/postgres/011_alert_thresholds.sql` para `alert_thresholds`
- `infra/postgres/013_inventory_expiry_csv.sql` si se quiere materializar `expires_at` en `inventory_items`

### Desarrollo local

Servidor embebido:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-php-backend.ps1
```

Servidor manual:

```powershell
& d:\xampp\php\php.exe -S 127.0.0.1:8080 .\backend-php\dev-router.php
```

### Apache / XAMPP

Configurar el document root del backend PHP hacia `backend-php/public`.

La carpeta `public` incluye `.htaccess` para enviar todas las rutas a `index.php`.
