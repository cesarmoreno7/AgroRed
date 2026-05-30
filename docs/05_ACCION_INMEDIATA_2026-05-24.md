# Accion Inmediata — 2026-05-24

## Objetivo
Aplicar correcciones criticas de seguridad y calidad detectadas en la revision del proyecto, y validarlas con pruebas automatizadas.

## Cambios Implementados

### 1) Auth publica para recuperacion de contrasena
- Se habilitaron rutas publicas en gateway:
  - `POST /api/v1/users/recover-password`
  - `POST /api/v1/users/reset-password`
- Archivos:
  - apps/api-gateway/src/interface/http/middlewares/auth.ts
  - apps/shared/middleware/internalAuth.ts

### 2) RBAC con matching robusto para rutas dinamicas
- Se reemplazo el matching por prefijo simple con matching por segmentos.
- Se agrego prioridad por especificidad de ruta para evitar que politicas genericas tapen politicas con `:id`.
- Archivo:
  - apps/api-gateway/src/interface/http/middlewares/rbac.ts

### 3) Coherencia operacional de puerto/origen
- Puerto por defecto del gateway alineado a `8080`.
- Fallback CORS de user-service alineado a `http://localhost:8080`.
- Archivos:
  - apps/api-gateway/src/config/env.ts
  - apps/user-service/src/index.ts

### 4) Contrato OpenAPI actualizado
- Se documentaron endpoints de recuperacion y reseteo de contrasena.
- Archivo:
  - apps/api-gateway/openapi.yaml

### 5) Correcciones de seed expandido
- Fix de mapeo de columnas/valores para `password_hash`.
- Fix de municipio por tenant real (`tenantNameById`).
- Fix de placeholders SQL en insercion de `logistics_orders`.
- Upsert de usuarios por email para refrescar `password_hash` en re-seed.
- Archivo:
  - scripts/seed_expanded.ts

### 6) Pruebas nuevas
- Gateway:
  - Validacion de paso por auth en recover/reset (sin 401, proxy 502 esperado sin downstream)
  - Matriz RBAC para subastas con rutas dinamicas
  - Matriz RBAC para logistica/incidencias
- Integracion:
  - Ejecucion de `seed_expanded.ts` (volumen minimo) y login real contra PostgreSQL.
- Archivos:
  - apps/api-gateway/src/interface/http/routes/gateway.test.ts
  - apps/api-gateway/src/interface/http/middlewares/rbac.test.ts
  - tests/integration/seed-expanded-login.test.ts

## Evidencia de Pruebas

### Suite consolidada
Comando:

```bash
npm test -- apps/api-gateway/src/interface/http/routes/gateway.test.ts apps/api-gateway/src/interface/http/middlewares/rbac.test.ts tests/integration/seed-expanded-login.test.ts
```

Resultado:
- Test Suites: 3 passed
- Tests: 10 passed

## Riesgo Residual
- El test de rutas publicas recover/reset valida comportamiento de auth/ruteo en gateway (no flujo de negocio completo del user-service), ya que en esa suite no se levanta downstream real.
- Recomendado en siguiente iteracion: E2E HTTP completo de recover -> reset en entorno integrado (gateway + user-service + redis).

## Recomendacion de Despliegue
1. Aplicar estas correcciones primero a entorno staging.
2. Ejecutar suite consolidada de pruebas y smoke de login/recover/reset.
3. Promover a produccion con ventana de observacion de 24h sobre 401/403/502 en gateway.
