# Checklist de Despliegue — Staging y Produccion

## 1. Pre-despliegue (obligatorio)

1. Confirmar rama y version:
- `main` para produccion
- `develop` para staging

2. Verificar variables de entorno minimas:
- `JWT_SECRET` robusto (>= 32 chars)
- `POSTGRES_*` correctos
- `REDIS_URL` correcto
- `REDIS_URL` apuntando a una instancia Redis managed estable (no local, no efimera)
- `API_GATEWAY_CORS_ORIGIN` acorde a frontend
- `INTERNAL_API_KEY` configurado para trafico servicio-a-servicio

3. Validar migraciones pendientes:
- Ejecutar `npx tsx scripts/migrate.ts --dry-run`
- Si hay pendientes, ejecutar `npx tsx scripts/migrate.ts`

4. Validar suite de seguridad/regresion minima:
```bash
npm test -- \
  apps/api-gateway/src/interface/http/routes/gateway.test.ts \
  apps/api-gateway/src/interface/http/middlewares/rbac.test.ts \
  tests/integration/seed-expanded-login.test.ts \
  tests/integration/password-recovery-gateway-flow.test.ts
```

## 2. Despliegue a Staging

1. Desplegar servicios backend en este orden:
- `user-service`
- `api-gateway`
- resto de servicios de negocio

2. Smoke tests funcionales en staging:
- `POST /api/v1/users/register` -> `201`
- `POST /api/v1/users/login` -> `200`
- `POST /api/v1/users/recover-password` (sin token) -> `200`
- `POST /api/v1/users/reset-password` (token valido) -> `200`
- `POST /api/v1/auctions/{id}/bid` con rol permitido -> `2xx`
- `POST /api/v1/auctions/{id}/close` con rol no permitido -> `403`
- `POST /api/v1/logistics` con `producer` -> `403`

3. Verificar contrato/documentacion:
- Confirmar endpoints en `openapi.yaml` para recover/reset

4. Observabilidad (minimo 30 min):
- Revisar en gateway picos de:
  - `401 AUTH_TOKEN_MISSING`
  - `403 FORBIDDEN`
  - `502 DOWNSTREAM_SERVICE_UNAVAILABLE`

## 3. Go/No-Go para Produccion

Criterios de Go:
1. Todos los tests del bloque minimo en verde.
2. Smoke de auth/recover/reset en staging exitoso.
3. Sin aumento anormal de `502` y sin errores críticos de DB.
4. Equipo de operación y producto notificados de ventana de despliegue.

Criterios de No-Go:
1. Falla en recover/reset.
2. RBAC inconsistente en rutas criticas.
3. Errores SQL en seed/migraciones.

## 4. Despliegue a Produccion

1. Aplicar misma secuencia que staging.
2. Ejecutar smoke reducido inmediato:
- login
- recover
- reset
- endpoint RBAC de control

3. Monitoreo reforzado (primeras 24h):
- Dashboard de errores 401/403/502
- latencia p95 de gateway
- errores de autenticacion por servicio

## 5. Plan de rollback

1. Rollback de version del gateway si:
- recover/reset fallan de forma sistematica
- subida abrupta de 401/403 por reglas incorrectas

2. Rollback de servicios de dominio si:
- se detecta rotura de rutas protegidas por RBAC

3. Mantener backup previo de configuracion de variables y release anterior.

## 6. Evidencia esperada

Guardar en el ticket de release:
1. Hash de commit desplegado.
2. Captura/salida de tests minimos.
3. Resultado smoke staging y produccion.
4. Ventana de monitoreo y hallazgos.
