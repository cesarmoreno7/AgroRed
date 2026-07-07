# Guía de Despliegue — AgroRed en Render

> Este documento reemplaza la guía anterior de Railway/Render. AgroRed ya no se despliega como 14
> microservicios independientes: desde la consolidación en monolito (`api-gateway`), todo el backend
> corre como un único servicio Node. Render es la plataforma activa; no se mantiene configuración de
> Railway en este repositorio.

## Índice

1. [Arquitectura del despliegue](#1-arquitectura-del-despliegue)
2. [Pre-requisitos](#2-pre-requisitos)
3. [Despliegue con Blueprint (`render.yaml`)](#3-despliegue-con-blueprint)
4. [Base de datos (Neon PostgreSQL)](#4-base-de-datos)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Verificación post-despliegue](#6-verificación)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Arquitectura del despliegue

```
                    ┌────────────────────────┐
    Internet ──────>│  agrored-api-gateway    │  (monolito Node — todos los módulos)
                    │  puerto 8080            │
                    └───────────┬─────────────┘
                                │
                   ┌────────────┼────────────┐
                   │                         │
            ┌──────┴───────┐         ┌───────┴───────┐
            │  PostgreSQL   │         │  Redis         │
            │  (Neon,       │         │  (Render       │
            │   externo)    │         │   managed)     │
            └──────────────┘         └───────────────┘

    ┌──────────────────────────┐
    │  agrored-web-dashboard    │  (static site — Vite build)
    └──────────────────────────┘
```

Todo lo que antes eran 14+ microservicios (`user`, `producer`, `offer`, `rescue`, `demand`,
`inventory`, `logistics`, `incident`, `notification`, `analytics`, `ml`, `automation`, `auction`,
`institution`, `location`, `delivery`) vive hoy como módulos importados directamente dentro de
`apps/api-gateway`. Un solo servicio web en Render (`agrored-api-gateway`) expone todas las rutas
`/api/v1/*`. No hay red interna entre servicios porque no hay servicios separados que comunicar.

## 2. Pre-requisitos

- [ ] Cuenta en [Render](https://render.com)
- [ ] Cuenta en [Neon](https://neon.tech) para PostgreSQL (Render no ofrece PostGIS nativo)
- [ ] Repositorio Git con el código de AgroRed conectado a Render
- [ ] Verificar build y tests localmente antes de desplegar:
  ```bash
  npm ci
  npm run build:monolith
  npm test
  ```
- [ ] Generar un `JWT_SECRET` seguro (Render puede generarlo automáticamente vía `generateValue: true`, ver `render.yaml`)

## 3. Despliegue con Blueprint

El repo incluye `render.yaml` en la raíz — Render lo detecta automáticamente como **Blueprint** y
crea los tres recursos definidos:

| Recurso | Tipo | Qué hace |
|---|---|---|
| `agrored-redis` | Redis managed | Cache, JWT blacklist, rate limiting, colas BullMQ |
| `agrored-api-gateway` | Web service (Node) | `npm run build:monolith` → `npm run migrate` → `npm run start:monolith` |
| `agrored-web-dashboard` | Static site | `npm run build:dashboard`, publica `apps/web-dashboard/dist` |

Pasos:

1. En Render Dashboard → **New** → **Blueprint** → conectar el repositorio.
2. Render lee `render.yaml` y muestra los tres servicios a crear — confirmar.
3. Completar las variables marcadas `sync: false` en el grupo `shared-agrored-config`
   (`POSTGRES_*`, `EMAIL_*`, `SMTP_*`, `AI_API_KEY`) con los valores reales de Neon/Gmail/Gemini.
4. Desplegar. `preDeployCommand: npm run migrate` corre las migraciones de `infra/postgres/` antes de
   cada release.

## 4. Base de datos

AgroRed usa **Neon** (PostgreSQL serverless con soporte PostGIS) como base de datos, tanto en
desarrollo como en producción — no un Postgres administrado por Render ni por Railway.

```
POSTGRES_HOST=<host>.neon.tech
POSTGRES_PORT=5432
POSTGRES_DB=neondb
POSTGRES_USER=<usuario>
POSTGRES_PASSWORD=<contraseña>
```

Las migraciones viven en `infra/postgres/init/` (bootstrap) e `infra/postgres/` (incrementales) y se
aplican con el runner propio del repo, no manualmente con `psql` uno por uno:

```bash
npx tsx scripts/migrate.ts           # aplica todo lo pendiente, en orden numérico
npx tsx scripts/migrate.ts --dry-run # solo lista lo pendiente
```

> Nota: `docker-compose.yml` en la raíz levanta un Postgres local para quien prefiera desarrollar
> 100% offline, pero el flujo por defecto de este repo (`.env`) apunta directo a Neon incluso en
> desarrollo local.

## 5. Variables de entorno

Ver `render.yaml` (grupo `shared-agrored-config`) para la lista completa y cuáles se generan
automáticamente (`JWT_SECRET`, `INTERNAL_API_KEY`) frente a las que hay que completar a mano
(credenciales de Neon, email, Gemini).

## 6. Verificación

```bash
# Healthcheck (usado también por Render para reinicios automáticos)
curl https://agrored-api-gateway.onrender.com/ping

# Login
curl -X POST https://agrored-api-gateway.onrender.com/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@agrored.co", "password": "<password>"}'
```

Abrir `https://agrored-web-dashboard.onrender.com` y verificar que carga y autentica contra el
gateway.

## 7. Troubleshooting

### Error: `JWT_SECRET` / `POSTGRES_PASSWORD` validation en producción
`apps/api-gateway/src/config/env.ts` rechaza el arranque en `NODE_ENV=production` si detecta el
`JWT_SECRET` o el password de Postgres por defecto del repo. Es intencional — completar las
variables reales en Render.

### Cold start / healthcheck falla
El healthcheck de Render apunta a `/ping` (siempre responde 200), no a `/health` (que depende de
Redis) — así un Redis caído no tumba el servicio completo. Si el deploy falla el healthcheck,
revisar los logs de arranque del servicio, no la conexión a Redis.

### El build falla en Render
El build corre desde la raíz del monorepo (`npm install --include=dev && npm run build:monolith`),
no desde `apps/api-gateway` de forma aislada — si un cambio rompe el build de algún módulo
consolidado (`apps/*-service`), el build del monolito falla igual aunque el error no sea del
`api-gateway` en sí.

---

## Checklist final

- [ ] Blueprint de `render.yaml` desplegado (Redis + api-gateway + web-dashboard)
- [ ] Variables `sync: false` completadas con credenciales reales
- [ ] Migraciones aplicadas (`preDeployCommand` o `npx tsx scripts/migrate.ts` manual)
- [ ] `GET /ping` responde 200
- [ ] Login de usuario funciona end-to-end
- [ ] Dashboard carga y conecta con el API Gateway
