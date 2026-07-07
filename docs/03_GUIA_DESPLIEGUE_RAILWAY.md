# Guía de Despliegue — AgroRed en Railway

> AgroRed ya no se despliega como 14 microservicios independientes: desde la consolidación en
> monolito (`api-gateway`), todo el backend corre como un único servicio Node. Railway es la
> plataforma activa (Render ya no se usa). El repo trae `railway.json` (raíz, para el monolito) y
> `apps/web-dashboard/railway.json` (para el dashboard) con la config de healthcheck/build que
> Railway no puede inferir solo; el build/start command y las variables de entorno de cada servicio
> se configuran directamente en el dashboard de Railway (NIXPACKS), no en archivos del repo.

## Índice

1. [Arquitectura del despliegue](#1-arquitectura-del-despliegue)
2. [Pre-requisitos](#2-pre-requisitos)
3. [Servicio: monolito (api-gateway)](#3-servicio-monolito)
4. [Servicio: web dashboard](#4-servicio-web-dashboard)
5. [Base de datos (Neon PostgreSQL)](#5-base-de-datos)
6. [Redis](#6-redis)
7. [Variables de entorno](#7-variables-de-entorno)
8. [Verificación post-despliegue](#8-verificación)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Arquitectura del despliegue

```
                    ┌────────────────────────┐
    Internet ──────>│  agrored-gateway         │  (monolito Node — todos los módulos)
                    │  Railway service          │
                    └───────────┬─────────────┘
                                │
                   ┌────────────┼────────────┐
                   │                         │
            ┌──────┴───────┐         ┌───────┴───────┐
            │  PostgreSQL   │         │  Redis         │
            │  (Neon,       │         │  (Railway plugin│
            │   externo)    │         │   o externo)   │
            └──────────────┘         └───────────────┘

    ┌──────────────────────────┐
    │  agrored-web-dashboard    │  (Railway service — static/serve)
    └──────────────────────────┘
```

Todo lo que antes eran 14+ microservicios (`user`, `producer`, `offer`, `rescue`, `demand`,
`inventory`, `logistics`, `incident`, `notification`, `analytics`, `ml`, `automation`, `auction`,
`institution`, `location`, `delivery`) vive hoy como módulos importados directamente dentro de
`apps/api-gateway`. Un solo servicio Railway expone todas las rutas `/api/v1/*`. Solo dos servicios
Railway son necesarios: el gateway (monolito) y el dashboard.

## 2. Pre-requisitos

- [ ] Cuenta en [Railway](https://railway.app) con el proyecto AgroRed ya creado (o por crear)
- [ ] Cuenta en [Neon](https://neon.tech) para PostgreSQL (Railway Postgres no trae PostGIS por defecto)
- [ ] Repositorio Git conectado al proyecto de Railway
- [ ] Verificar build y tests localmente antes de desplegar:
  ```bash
  npm ci
  npm run build:monolith
  npm test
  ```

## 3. Servicio: monolito (api-gateway)

- **Root Directory**: raíz del repo (el build corre `npm install` desde la raíz del monorepo, no desde `apps/api-gateway` aislado, porque los módulos consolidados viven en workspaces hermanos).
- **Build command** (NIXPACKS, configurar en el dashboard del servicio): `npm install --include=dev && npm run build:monolith`
- **Pre-deploy / release command**: `npm run migrate`
- **Start command**: `npm run start:monolith`
- **Healthcheck**: `/ping` (ya configurado en `railway.json`) — responde 200 siempre, no depende de Redis, así un Redis caído no tumba el deploy.
- **Puerto**: Railway inyecta `PORT`; `API_GATEWAY_PORT` debe leer esa variable (ver `apps/api-gateway/src/config/env.ts`).

## 4. Servicio: web dashboard

- **Root Directory**: `apps/web-dashboard`
- **Build command**: `npm run build:dashboard` (definido en `apps/web-dashboard/railway.json`)
- **Start command**: `npx serve -s dist -l $PORT`
- **Variables**: `VITE_API_BASE_URL` apuntando a la URL pública del servicio del gateway.

## 5. Base de datos

AgroRed usa **Neon** (PostgreSQL serverless con soporte PostGIS) como base de datos, tanto en
desarrollo como en producción.

```
POSTGRES_HOST=<host>.neon.tech
POSTGRES_PORT=5432
POSTGRES_DB=neondb
POSTGRES_USER=<usuario>
POSTGRES_PASSWORD=<contraseña>
```

Migraciones en `infra/postgres/init/` (bootstrap) e `infra/postgres/` (incrementales), aplicadas con
el runner propio del repo — no manualmente con `psql` archivo por archivo:

```bash
npx tsx scripts/migrate.ts           # aplica todo lo pendiente, en orden numérico
npx tsx scripts/migrate.ts --dry-run # solo lista lo pendiente
```

> Nota: `docker-compose.yml` en la raíz levanta un Postgres local para quien prefiera desarrollar
> offline, pero el flujo por defecto (`.env`) apunta directo a Neon incluso en desarrollo local. El
> Postgres local nativo (si se usa) no trae la extensión PostGIS por defecto — algunas migraciones
> territoriales (GIS) requieren instalarla aparte.

## 6. Redis

Usado para JWT blacklist (logout), rate limiting distribuido, colas BullMQ (notificaciones,
automatizaciones) y cache. Se puede usar el plugin de Redis de Railway o una instancia externa —
solo se necesita `REDIS_URL` apuntando a ella. `analytics-service` y `ml-service` degradan a modo
fail-open si Redis no está disponible (no bloquean requests, solo pierden cache).

## 7. Variables de entorno

Variables compartidas del gateway (configurarlas como Shared Variables del proyecto en Railway):

| Variable | Notas |
|---|---|
| `NODE_ENV` | `production` |
| `POSTGRES_HOST` / `PORT` / `DB` / `USER` / `PASSWORD` | credenciales de Neon |
| `JWT_SECRET` | ≥32 caracteres aleatorios — `apps/api-gateway/src/config/env.ts` rechaza el arranque en producción si detecta el valor por defecto del repo |
| `JWT_EXPIRES_IN` | `8h` |
| `REDIS_URL` | del plugin de Railway o instancia externa |
| `API_GATEWAY_CORS_ORIGIN` | URL pública del dashboard |
| `EMAIL_USER` / `EMAIL_PASS` | recuperación de contraseña |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | notification-service |
| `OSRM_URL` | logistics-service, por defecto el demo público de OSRM |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | copiloto IA (Gemini) |

Variable propia del dashboard: `VITE_API_BASE_URL` (URL pública del gateway).

## 8. Verificación

```bash
# Healthcheck
curl https://<tu-gateway>.up.railway.app/ping

# Login
curl -X POST https://<tu-gateway>.up.railway.app/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@agrored.co", "password": "<password>"}'
```

Abrir la URL pública del dashboard y verificar que carga y autentica contra el gateway.

## 9. Troubleshooting

### Error: `JWT_SECRET` / `POSTGRES_PASSWORD` validation en producción
`apps/api-gateway/src/config/env.ts` rechaza el arranque en `NODE_ENV=production` si detecta el
`JWT_SECRET` o el password de Postgres por defecto del repo. Completar las variables reales en
Railway.

### El build falla con `npm install`
El build debe correr desde la **raíz** del monorepo (no desde `apps/api-gateway` aislado), porque
los módulos consolidados en el monolito importan código fuente de sus paquetes hermanos
(`apps/user-service`, `apps/offer-service`, etc. — ver el patrón de imports en
`apps/api-gateway/src/interface/http/routes/monolithRouters.ts`). Si el Root Directory del servicio
apunta a `apps/api-gateway`, esos imports no resuelven.

### Healthcheck falla pero el servicio está corriendo
Confirmar que el healthcheck apunta a `/ping` (siempre 200) y no a `/health` (agrega el estado de
Redis y puede devolver un código distinto de 200 si Redis está degradado).

---

## Checklist final

- [ ] Servicio gateway desplegado (build → migrate → start)
- [ ] Servicio web-dashboard desplegado
- [ ] Variables de entorno completadas (Neon, JWT_SECRET real, Redis, email/SMTP, AI)
- [ ] Migraciones aplicadas (`npm run migrate` como pre-deploy o manual)
- [ ] `GET /ping` responde 200
- [ ] Login de usuario funciona end-to-end
- [ ] Dashboard carga y conecta con el gateway
