# Guia Local de Levantamiento y Accesos por Rol

## 1. Objetivo
Este documento explica como levantar AgroRed en entorno local y como acceder con usuarios de prueba por rol.

## 2. Pre-requisitos
1. Node.js 22 o superior.
2. npm disponible en terminal.
3. PostgreSQL 16 (o compatible) corriendo en local.
4. Redis 7 (recomendado para features de gateway y user-service).
5. Windows PowerShell (para scripts `.ps1`) o terminal equivalente.

## 3. Variables de entorno
Crear o actualizar `.env` en raiz del repo con valores locales, por ejemplo:

```env
NODE_ENV=development

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=agrored
POSTGRES_USER=777
POSTGRES_PASSWORD=777

REDIS_URL=redis://localhost:6379

JWT_SECRET=change_this_to_a_long_secure_local_secret_32_chars_min
JWT_EXPIRES_IN=8h
INTERNAL_API_KEY=local_internal_key_change_me

API_GATEWAY_PORT=8080
API_GATEWAY_CORS_ORIGIN=http://localhost:5173,http://localhost:8080
AI_CHAT_SERVICE_URL=http://127.0.0.1:8080

FRONTEND_URL=http://localhost:5173
```

Notas locales importantes:
- Si tienes XAMPP/Apache corriendo en `8080`, usa `API_GATEWAY_PORT=8082` o deten Apache antes de levantar AgroRed.
- Si vas a usar el copiloto AI via gateway Node, deja el gateway en un puerto distinto al backend PHP y apunta `AI_CHAT_SERVICE_URL` al PHP embebido, por ejemplo `http://127.0.0.1:8080`.
- El script `scripts/dev-all.ps1` ahora toma el puerto del gateway directamente desde `.env`.
- Si tu Redis local es menor a 5, `automation-service` y `notification-service` levantan en modo degradado sin workers BullMQ.
- Si Redis no esta disponible, `api-gateway`, `analytics-service`, `ml-service` y `user-service` igual pueden levantar en modo degradado.
- En modo degradado sin Redis: `analytics-service` y `ml-service` responden sin cache; `recover-password` y `reset-password` devuelven `503`; `logout` distribuido y rate limit compartido del gateway pasan a capacidad reducida.

## 4. Instalacion de dependencias
En raiz del proyecto:

```bash
npm install
```

## 5. Migraciones de base de datos
Ejecutar en raiz:

```bash
npm run migrate
```

Opcional (solo ver pendientes):

```bash
npx tsx scripts/migrate.ts --dry-run
```

## 6. Carga de datos de prueba por roles
Para cargar datos base + cobertura de roles + tablas avanzadas:

```bash
npm run seed:roles
```

Este comando usa `scripts/seed_expanded.ts` y es idempotente (se puede ejecutar varias veces).

## 7. Levantar servicios en local

### Opcion A (recomendada): todos los servicios con script

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-all.ps1
```

Puertos esperados:
- API Gateway: `API_GATEWAY_PORT` definido en `.env` (por ejemplo `8080` o `8082`)
- user-service: 3001
- producer-service: 3002
- offer-service: 3003
- rescue-service: 3004
- demand-service: 3005
- inventory-service: 3006
- logistics-service: 3007
- incident-service: 3008
- notification-service: 3009
- analytics-service: 3010
- ml-service: 3011
- automation-service: 3012
- auction-service: 3013

### Opcion B: por servicio
Ejemplo:

```bash
npm run dev:gateway
npm run dev:user
npm run dev:offer
```

## 8. Verificacion rapida
1. Health gateway:
- `GET http://localhost:<API_GATEWAY_PORT>/health`
- Si Redis no esta disponible, el gateway puede responder `503` con `success=true` y `data.status=degraded`; revisar `data.gatewayDependencies.redis` para confirmar si Redis quedo en `degraded`.

2. Catalogo servicios:
- `GET http://localhost:<API_GATEWAY_PORT>/api/v1/catalog/services`

3. Login (ejemplo):
- `POST http://localhost:<API_GATEWAY_PORT>/api/v1/users/login`

Body:

```json
{
  "email": "role.admin_municipal.bogota@agrored.co",
  "password": "Role@BOGOTA1!"
}
```

## 9. Accesos por rol (usuarios seed)

## 9.1 Formato de usuario
Usuarios generados por tenant:
- Email: `role.<rol>.<tenant_code_lower>@agrored.co`
- Password: `Role@<TENANT_CODE><indice>!`

Roles gateway creados por tenant:
1. admin_municipal
2. producer
3. supermarket
4. logistics_operator
5. territorial_analyst
6. community_kitchen
7. monitoring_agent

Roles legacy adicionales (compatibilidad):
8. ADMIN
9. PRODUCER
10. OPERATOR
11. MUNICIPALITY
12. TERRITORIAL_MANAGER

Para roles legacy, el email usa prefijo `legacy_` para evitar colisiones:
- `role.legacy_<rol_lower>.<tenant_code_lower>@agrored.co`

Tenant codes seed por defecto:
- BOGOTA
- MEDELLIN
- CALI

## 9.2 Credenciales ejemplo (tenant BOGOTA)
- admin_municipal
  - Email: `role.admin_municipal.bogota@agrored.co`
  - Password: `Role@BOGOTA1!`

- producer
  - Email: `role.producer.bogota@agrored.co`
  - Password: `Role@BOGOTA2!`

- supermarket
  - Email: `role.supermarket.bogota@agrored.co`
  - Password: `Role@BOGOTA3!`

- logistics_operator
  - Email: `role.logistics_operator.bogota@agrored.co`
  - Password: `Role@BOGOTA4!`

- territorial_analyst
  - Email: `role.territorial_analyst.bogota@agrored.co`
  - Password: `Role@BOGOTA5!`

- community_kitchen
  - Email: `role.community_kitchen.bogota@agrored.co`
  - Password: `Role@BOGOTA6!`

- monitoring_agent
  - Email: `role.monitoring_agent.bogota@agrored.co`
  - Password: `Role@BOGOTA7!`

## 9.3 Credenciales ejemplo (roles legacy en BOGOTA)
- ADMIN: `role.legacy_admin.bogota@agrored.co` / `Role@BOGOTA8!`
- PRODUCER: `role.legacy_producer.bogota@agrored.co` / `Role@BOGOTA9!`
- OPERATOR: `role.legacy_operator.bogota@agrored.co` / `Role@BOGOTA10!`
- MUNICIPALITY: `role.legacy_municipality.bogota@agrored.co` / `Role@BOGOTA11!`
- TERRITORIAL_MANAGER: `role.legacy_territorial_manager.bogota@agrored.co` / `Role@BOGOTA12!`

## 10. Pruebas recomendadas

### 10.1 Matriz automatizada de acceso por rol
```bash
npm test -- tests/integration/role-access-matrix-gateway.test.ts
```

### 10.2 Flujo recover/reset de password
```bash
npm test -- tests/integration/password-recovery-gateway-flow.test.ts
```

### 10.3 Integridad de seed + login real
```bash
npm test -- tests/integration/seed-expanded-login.test.ts
```

## 11. Troubleshooting
1. Error de DB al seed:
- Revisa migraciones ejecutadas.
- Ejecuta nuevamente `npm run migrate` y luego `npm run seed:roles`.

2. Login falla para un rol esperado:
- Verifica email/indice/tenant.
- Reejecuta `npm run seed:roles`.

3. Respuesta 502 en gateway:
- Significa que RBAC/auth paso, pero el microservicio destino no estaba levantado.

4. Respuesta 403 en gateway:
- Rol no permitido para ese endpoint segun politica RBAC.

5. Respuesta 404 en `localhost:8080` aun con el stack arriba:
- Verifica si `8080` lo esta ocupando Apache/XAMPP.
- Si Apache esta activo, usa `API_GATEWAY_PORT=8082` en `.env` y vuelve a ejecutar `powershell -ExecutionPolicy Bypass -File .\scripts\dev-all.ps1`.

6. `POST /api/v1/ai-chat` responde `503`:
- Verifica que `AI_CHAT_SERVICE_URL` apunte al backend PHP activo.
- Si usas `scripts/dev-php-backend.ps1`, evita compartir puerto con el gateway.
- Los roles `admin_municipal` y `territorial_analyst` se traducen a roles legacy al pasar por el gateway.

7. `automation-service` o `notification-service` no procesan colas:
- Revisa la version de Redis con `redis-server --version`.
- BullMQ requiere Redis `>= 5`.
- En Windows puedes instalar una opcion compatible como `Memurai Developer`.

8. `recover-password` o `reset-password` responden `503`:
- Significa que `user-service` arranco sin Redis disponible para tokens temporales de recuperacion.
- Verifica `REDIS_URL` y la conectividad contra Redis.
- Si necesitas probar recover/reset en local, levanta Redis y reinicia `user-service`.

9. `GET /health` responde `503` pero login y catalogo funcionan:
- El gateway ahora expone degradacion de dependencias en vez de fallar al arrancar.
- Revisa el campo `gatewayDependencies.redis` en la respuesta.
- Si solo Redis esta degradado, puedes seguir probando login/registro y la mayoria de rutas, pero no recover/reset ni capacidades distribuidas de Redis.
