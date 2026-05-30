# Matriz de Pruebas por Rol (QA)

## Objetivo
Validar permisos y flujos funcionales por rol usando los datos cargados con `seed:roles`.

## Pre-requisitos
1. Ejecutar migraciones:
```bash
npm run migrate
```
2. Cargar datos de cobertura por rol:
```bash
npm run seed:roles
```
3. Levantar gateway y servicios necesarios para pruebas funcionales reales.

## Credenciales Seed por Rol
Patron de usuario generado por tenant:
- Email: `role.<rol>.<tenant_code_lower>@agrored.co`
- Password: `Role@<TENANT_CODE><indice>!`

Ejemplos para `BOGOTA`:
- `role.admin_municipal.bogota@agrored.co`
- `role.producer.bogota@agrored.co`
- `role.supermarket.bogota@agrored.co`
- `role.logistics_operator.bogota@agrored.co`
- `role.territorial_analyst.bogota@agrored.co`
- `role.community_kitchen.bogota@agrored.co`
- `role.monitoring_agent.bogota@agrored.co`

Nota: tambien se generan roles legacy (`ADMIN`, `PRODUCER`, `OPERATOR`, `MUNICIPALITY`, `TERRITORIAL_MANAGER`) para compatibilidad.
Para roles legacy, el email usa prefijo `legacy_`:
- `role.legacy_<rol_lower>.<tenant_code_lower>@agrored.co`

## Matriz de Control de Acceso (Gateway)

| Endpoint | Metodo | admin_municipal | producer | supermarket | logistics_operator | territorial_analyst | community_kitchen | monitoring_agent |
|---|---|---|---|---|---|---|---|---|
| /api/v1/users | GET | Allow | Deny | Deny | Deny | Deny | Deny | Deny |
| /api/v1/offers | POST | Allow | Allow | Allow | Deny | Deny | Deny | Deny |
| /api/v1/demands | POST | Allow | Deny | Deny | Deny | Deny | Allow | Deny |
| /api/v1/logistics | POST | Allow | Deny | Deny | Allow | Deny | Deny | Deny |
| /api/v1/incidents | POST | Allow | Deny | Deny | Allow | Allow | Deny | Deny |
| /api/v1/analytics | GET | Allow | Deny | Deny | Deny | Allow | Deny | Deny |
| /api/v1/ai-chat | POST | Allow | Deny | Deny | Deny | Allow | Deny | Deny |
| /api/v1/auctions/{id}/bid | POST | Allow | Deny | Deny | Allow | Deny | Allow | Deny |
| /api/v1/auctions/{id}/close | POST | Allow | Deny | Deny | Deny | Deny | Deny | Deny |

## Cobertura Complementaria para Roles Seed Legacy
Los roles legacy seed (`ADMIN`, `PRODUCER`, `OPERATOR`, `MUNICIPALITY`, `TERRITORIAL_MANAGER`) deben validarse al menos en estos smoke tests:
- Login y emision de JWT con credenciales seed legacy.
- Acceso a rutas legacy o puentes de compatibilidad, especialmente `/api/v1/ai-chat` para `ADMIN` y `TERRITORIAL_MANAGER`.
- Verificacion de que una ruta restringida devuelve `403` cuando no exista mapeo RBAC equivalente en el gateway Node.

## Pruebas Automatizadas Disponibles
1. Matriz de acceso por rol en gateway:
```bash
npm test -- tests/integration/role-access-matrix-gateway.test.ts
```

2. Recuperacion y reset de contraseña (E2E gateway + user-service in-memory):
```bash
npm test -- tests/integration/password-recovery-gateway-flow.test.ts
```

## Pruebas Manuales Sugeridas por Rol
1. admin_municipal:
- Crear usuarios.
- Publicar/cerrar subastas.
- Consultar analitica y notificaciones.

2. producer:
- Crear ofertas.
- Consultar sus ofertas/rescates.
- Intentar acciones no permitidas (usuarios/logistica) y validar `403`.

3. logistics_operator:
- Crear/gestionar ordenes logisticas.
- Registrar incidencias.
- Pujar subastas.

4. territorial_analyst:
- Consultar analytics/mapa.
- Registrar incidencias.
- Verificar que no pueda crear logistica ni subastas.

5. community_kitchen:
- Crear demandas.
- Pujar subastas.
- Verificar `403` en ofertas/logistica/admin.

6. supermarket:
- Publicar ofertas.
- Verificar acceso restringido en analytics resumen y administracion.

7. monitoring_agent:
- Verificar login correcto con seed.
- Confirmar que el gateway devuelve `403` en endpoints restringidos mientras no exista una politica RBAC dedicada.

8. Roles legacy:
- Confirmar login con `legacy_*`.
- Validar compatibilidad solo en rutas documentadas para legacy o puentes explicitos.

## Criterio de Aprobacion
- Todas las pruebas automatizadas en verde.
- En pruebas manuales, cada endpoint restringido debe responder `403`.
- Endpoints permitidos deben responder `2xx`/`4xx` de negocio (no `403`) con servicios levantados.
- `monitoring_agent` y roles legacy no pueden quedar fuera de la evidencia QA: si un rol no tiene permisos funcionales en gateway, debe quedar documentado y probado como restriccion explicita.
