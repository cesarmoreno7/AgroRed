# Guía de Despliegue — AgroRed en Railway / Render

## Índice

1. [Railway vs Render — Comparativa y recomendación](#1-railway-vs-render)
2. [Arquitectura del despliegue](#2-arquitectura-del-despliegue)
3. [Pre-requisitos](#3-pre-requisitos)
4. [Opción A — Despliegue en Railway (RECOMENDADO)](#4-opción-a--railway)
5. [Opción B — Despliegue en Render](#5-opción-b--render)
6. [Configuración de la Base de Datos (PostgreSQL + PostGIS)](#6-base-de-datos)
7. [Variables de Entorno — Referencia Completa](#7-variables-de-entorno)
8. [Despliegue del Web Dashboard](#8-web-dashboard)
9. [Verificación post-despliegue](#9-verificación)
10. [Costos estimados](#10-costos)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Railway vs Render

### ¿Se necesitan los dos?

**No.** Solo necesitas **UNO** de los dos. Ambos son plataformas PaaS que despliegan aplicaciones Node.js desde un repositorio Git. Elegir uno u otro.

### Comparativa

| Criterio | Railway | Render |
|----------|---------|--------|
| **Monorepo nativo** | ✅ Excelente — soporta múltiples servicios desde un solo repo con `root directory` por servicio | ⚠️ Funciona pero requiere crear cada servicio manualmente apuntando al subdirectorio |
| **PostgreSQL + PostGIS** | ✅ Plugin nativo de Postgres. PostGIS requiere imagen custom o Neon/Supabase externo | ⚠️ Postgres managed disponible pero sin PostGIS nativo — necesita Supabase/Neon externo |
| **Networking interno** | ✅ Red privada entre servicios (sin costo de egress) | ⚠️ Servicios se comunican por URLs públicas (o private services en plan pago) |
| **Variables de entorno** | ✅ Shared variables + por servicio + referencia cruzada `${{service.URL}}` | ✅ Environment groups compartidos |
| **Free tier** | $5 USD gratis/mes (trial) → luego Hobby $5/mes | Free tier con limitaciones (spin-down tras 15min inactividad) |
| **Auto-deploy** | ✅ Push to branch → deploy automático | ✅ Push to branch → deploy automático |
| **Escalabilidad** | Escala vertical y horizontal | Escala vertical, horizontal en plan pago |
| **Cold starts** | Sin cold starts en plan Hobby | ⚠️ Cold starts de ~30s en free tier |
| **Logs** | ✅ Logs en tiempo real por servicio | ✅ Logs en tiempo real |

### 🏆 Recomendación: **Railway**

Railway es la mejor opción para AgroRed porque:
1. **Soporte nativo de monorepo** — cada microservicio se configura desde el mismo repo
2. **Red privada interna** — los 14 servicios se comunican sin exponer puertos públicos
3. **Referencia cruzada de URLs** — `${{user-service.RAILWAY_PRIVATE_DOMAIN}}` se resuelve automáticamente
4. **Sin cold starts** — los servicios siempre están corriendo
5. **PostGIS viable** — se puede usar el plugin Postgres de Railway o conectar Supabase/Neon externo

---

## 2. Arquitectura del despliegue

```
                    ┌──────────────┐
    Internet ──────>│  API Gateway │ (puerto público)
                    │   :8080      │
                    └──────┬───────┘
                           │ Red privada
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
    │user :3001 │   │prod :3002 │   │offer :3003│  ... x13 servicios
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                ┌──────────┼──────────┐
                │          │          │
         ┌──────┴───────┐  │   ┌──────┴───────┐
         │  PostgreSQL  │  │   │    Redis      │
         │  + PostGIS   │  │   │  (cache,      │
         └──────────────┘  │   │   queues,     │
                           │   │   pub/sub)    │
                           │   └──────────────┘
                           │
    ┌──────────────┐
    │Web Dashboard │ (static site — Vite build)
    │  Render/     │
    │  Vercel/     │
    │  Railway     │
    └──────────────┘
```

**Solo el API Gateway se expone a Internet.** Los 13 microservicios se comunican internamente.

### Redis — Casos de uso

| Caso de Uso | Servicio | Descripción |
|-------------|----------|-------------|
| JWT Blacklist (Logout) | api-gateway | Tokens revocados con TTL automático |
| Rate Limiting Distribuido | api-gateway | Contadores compartidos entre instancias |
| Colas de Trabajo (BullMQ) | notification-service, automation-service | Procesamiento asíncrono de emails y automatizaciones |
| Caché de Consultas | analytics-service, ml-service | Cache de resúmenes analíticos y recomendaciones ML |
| Pub/Sub Event Bus | todos los servicios | Comunicación asíncrona entre microservicios |

---

## 3. Pre-requisitos

### 3.1 Cuentas necesarias
- [ ] Cuenta en [Railway](https://railway.app) **o** [Render](https://render.com)
- [ ] Repositorio Git (GitHub, GitLab o Bitbucket) con el código de AgroRed
- [ ] (Opcional) Cuenta en [Supabase](https://supabase.com) o [Neon](https://neon.tech) si se necesita PostGIS managed

### 3.2 Preparar el repositorio
```bash
# Asegurar que el build funciona localmente
npm ci
npm run build

# Verificar que los tests pasan
npm test
```

### 3.3 Generar un JWT_SECRET seguro
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
Guardar este valor — se usará como variable de entorno.

---

## 4. Opción A — Railway

### Paso 1: Crear el proyecto

1. Ir a [railway.app](https://railway.app) → **New Project**
2. Seleccionar **Deploy from GitHub repo**
3. Conectar tu cuenta de GitHub y seleccionar el repositorio `AgroRed`
4. Railway creará un proyecto vacío — **no aceptar el deploy automático inicial**

### Paso 2: Crear la base de datos PostgreSQL

1. En el proyecto, click **+ New** → **Database** → **PostgreSQL**
2. Railway creará una instancia Postgres con las variables:
   - `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
3. Copiar estos valores — los usaremos como variables compartidas

> **¿Necesitas PostGIS?** Railway no incluye PostGIS por defecto. Dos opciones:
> - **Opción A (recomendada):** Usar [Supabase](https://supabase.com) free tier (incluye PostGIS) → conectar la URL externa
> - **Opción B:** Usar Railway Postgres y habilitar PostGIS manualmente:
>   ```sql
>   CREATE EXTENSION IF NOT EXISTS postgis;
>   ```
>   Esto funciona si la imagen de Railway permite extensiones (verificar en el momento del deploy).

### Paso 2b: Crear instancia Redis

1. En el proyecto, click **+ New** → **Database** → **Redis**
2. Railway creará una instancia Redis con la variable `REDIS_URL`
3. Copiar `REDIS_URL` — la usaremos como variable compartida
4. Redis se usa para: JWT blacklist (logout), rate limiting distribuido, colas BullMQ (emails, automatizaciones), caché de consultas (analytics, ML), y Pub/Sub entre servicios

### Paso 3: Ejecutar las migraciones SQL

Conectarse a la base de datos desde terminal local:

```bash
# Obtener la connection string desde Railway Dashboard → PostgreSQL → Connect

# Ejecutar migraciones en orden
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/init/001_bootstrap_agrored.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/init/002_add_auth.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/init/002b_add_coordinates.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/init/003_map_spatial_support.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/init/004_logistics_tracking.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/init/005_add_foreign_keys.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/006_auction_module.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/007_offer_demand_matching.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/008_modulos_revision.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/009_sla_tracking.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/010_remaining_gaps.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/011_alert_thresholds.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/012_vrp_spoilage_classification.sql
psql "postgresql://USER:PASS@HOST:PORT/DB" -f infra/postgres/013_inventory_expiry_csv.sql
```

### Paso 4: Crear variables compartidas

En Railway Dashboard → **Project Settings** → **Shared Variables**, agregar:

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `POSTGRES_HOST` | `(host de Railway Postgres — ver Connect)` |
| `POSTGRES_PORT` | `5432` |
| `POSTGRES_DB` | `railway` (o el nombre que Railway asignó) |
| `POSTGRES_USER` | `(usuario de Railway Postgres)` |
| `POSTGRES_PASSWORD` | `(contraseña de Railway Postgres)` |
| `JWT_SECRET` | `(tu secret generado en paso 3.3)` |
| `JWT_EXPIRES_IN` | `8h` |
| `REDIS_URL` | `(URL de Redis Railway — ver Connect)` |

### Paso 5: Crear los 14 servicios backend

Para **cada uno** de los siguientes servicios, repetir este proceso:

| Servicio | Root Directory | Puerto | Build Command | Start Command |
|----------|---------------|--------|---------------|---------------|
| api-gateway | `apps/api-gateway` | 8080 | `npm install && npm run build` | `npm run start` |
| user-service | `apps/user-service` | 3001 | `npm install && npm run build` | `npm run start` |
| producer-service | `apps/producer-service` | 3002 | `npm install && npm run build` | `npm run start` |
| offer-service | `apps/offer-service` | 3003 | `npm install && npm run build` | `npm run start` |
| rescue-service | `apps/rescue-service` | 3004 | `npm install && npm run build` | `npm run start` |
| demand-service | `apps/demand-service` | 3005 | `npm install && npm run build` | `npm run start` |
| inventory-service | `apps/inventory-service` | 3006 | `npm install && npm run build` | `npm run start` |
| logistics-service | `apps/logistics-service` | 3007 | `npm install && npm run build` | `npm run start` |
| incident-service | `apps/incident-service` | 3008 | `npm install && npm run build` | `npm run start` |
| analytics-service | `apps/analytics-service` | 3009 | `npm install && npm run build` | `npm run start` |
| notification-service | `apps/notification-service` | 3010 | `npm install && npm run build` | `npm run start` |
| ml-service | `apps/ml-service` | 3011 | `npm install && npm run build` | `npm run start` |
| automation-service | `apps/automation-service` | 3012 | `npm install && npm run build` | `npm run start` |
| auction-service | `apps/auction-service` | 3013 | `npm install && npm run build` | `npm run start` |

**Procedimiento por cada servicio:**

1. En el proyecto Railway, click **+ New** → **GitHub Repo** → seleccionar `AgroRed`
2. **Settings** del servicio:
   - **Root Directory**: `apps/<nombre-servicio>` (ej: `apps/user-service`)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Watch Paths**: `apps/<nombre-servicio>/**` (solo redeploya si cambia ese servicio)
3. **Variables** → asignar las shared variables (heredan automáticamente)
4. **Networking** → **Generate Private Domain** (genera `<service>.railway.internal`)

### Paso 6: Configurar las URLs de los servicios internos

Una vez creados **todos** los servicios, cada uno tendrá un dominio privado Railway (ej: `user-service.railway.internal`).

Agregar al **api-gateway** las siguientes variables:

| Variable | Valor |
|----------|-------|
| `API_GATEWAY_PORT` | `8080` |
| `API_GATEWAY_CORS_ORIGIN` | `https://tu-dashboard.railway.app,https://tu-dominio.com` |
| `USER_SERVICE_URL` | `http://user-service.railway.internal:3001` |
| `PRODUCER_SERVICE_URL` | `http://producer-service.railway.internal:3002` |
| `OFFER_SERVICE_URL` | `http://offer-service.railway.internal:3003` |
| `RESCUE_SERVICE_URL` | `http://rescue-service.railway.internal:3004` |
| `DEMAND_SERVICE_URL` | `http://demand-service.railway.internal:3005` |
| `INVENTORY_SERVICE_URL` | `http://inventory-service.railway.internal:3006` |
| `LOGISTICS_SERVICE_URL` | `http://logistics-service.railway.internal:3007` |
| `INCIDENT_SERVICE_URL` | `http://incident-service.railway.internal:3008` |
| `ANALYTICS_SERVICE_URL` | `http://analytics-service.railway.internal:3009` |
| `NOTIFICATION_SERVICE_URL` | `http://notification-service.railway.internal:3010` |
| `ML_SERVICE_URL` | `http://ml-service.railway.internal:3011` |
| `AUTOMATION_SERVICE_URL` | `http://automation-service.railway.internal:3012` |
| `AUCTION_SERVICE_URL` | `http://auction-service.railway.internal:3013` |

> **Nota:** Los nombres de dominio privado dependen de cómo nombraste cada servicio en Railway. Verificar en cada servicio → Settings → Networking.

### Paso 7: Exponer el API Gateway a Internet

1. En el servicio **api-gateway** → **Settings** → **Networking**
2. Click **Generate Domain** → Railway genera algo como `agrored-gateway-production.up.railway.app`
3. (Opcional) Configurar dominio custom: **Custom Domain** → ingresar `api.agrored.co`

**Solo el API Gateway debe tener dominio público.** Los demás servicios se comunican por la red privada.

### Paso 8: Deploy

1. Ya con todas las variables configuradas, hacer **Deploy** en cada servicio
2. Railway construye y despliega automáticamente
3. Verificar logs de cada servicio en Railway → servicio → **Logs**

---

## 5. Opción B — Render

### Paso 1: Crear la base de datos

1. Ir a [render.com](https://render.com) → **New** → **PostgreSQL**
2. Nombre: `agrored-db`
3. Región: la más cercana a tus usuarios (ej: Oregon si estás en Colombia)
4. Plan: **Free** para pruebas (⚠️ se borra tras 90 días) o **Starter** ($7/mes)

> **PostGIS:** Render PostgreSQL **no incluye** PostGIS. Conectar una base Supabase o Neon externa.

### Paso 2: Ejecutar migraciones

Mismos comandos SQL que en Railway (ver sección 4, Paso 3).

### Paso 3: Crear un Environment Group

1. Dashboard → **Environment Groups** → **New Environment Group**
2. Nombre: `agrored-shared`
3. Agregar las variables compartidas (mismas que Railway Paso 4):

```
NODE_ENV=production
POSTGRES_HOST=<host de Render/Supabase>
POSTGRES_PORT=5432
POSTGRES_DB=<nombre db>
POSTGRES_USER=<usuario>
POSTGRES_PASSWORD=<contraseña>
JWT_SECRET=<tu secret>
JWT_EXPIRES_IN=8h
```

### Paso 4: Crear los 14 servicios

Para **cada servicio**, ir a **New** → **Web Service**:

1. **Source**: Connect repository → seleccionar `AgroRed`
2. **Root Directory**: `apps/<nombre-servicio>`
3. **Environment**: `Node`
4. **Build Command**: `npm install && npm run build`
5. **Start Command**: `npm run start`
6. **Plan**: Free (con cold starts) o Starter ($7/mes por servicio)
7. **Environment Variables**: Vincular el Environment Group `agrored-shared`
8. Agregar variable individual: `PORT=<puerto del servicio>` (ej: 3001 para user)

### Paso 5: Configurar URLs de servicios en api-gateway

En Render, cada servicio obtiene una URL pública como `user-service-xxxx.onrender.com`.

En el servicio **api-gateway**, agregar:

```
USER_SERVICE_URL=https://user-service-xxxx.onrender.com
PRODUCER_SERVICE_URL=https://producer-service-xxxx.onrender.com
... (repetir para los 13 servicios)
```

> **⚠️ Importante en Render:** Sin plan pago, todos los servicios se comunican por URLs públicas, lo cual es más lento que Railway. En plan Team ($19/mes) se puede usar Private Services para red interna.

### Paso 6: Exponer solo el API Gateway

Los 13 microservicios NO necesitan ser accesibles desde Internet. Si estás en **Render Team**, márcalos como **Private Service**. En plan Free/Starter, no hay forma de hacerlos privados — dejar público pero la autenticación JWT protege los endpoints.

---

## 6. Base de Datos

### Opción recomendada: Supabase (incluye PostGIS gratis)

1. Crear proyecto en [supabase.com](https://supabase.com)
2. En **Database Settings**, copiar la connection string
3. PostGIS ya está habilitado — verificar:
   ```sql
   SELECT PostGIS_Version();
   ```
4. Ejecutar las 14 migraciones SQL listadas en la sección 4, Paso 3
5. Usar los datos de conexión como variables de entorno en Railway/Render:
   ```
   POSTGRES_HOST=db.xxxxx.supabase.co
   POSTGRES_PORT=5432
   POSTGRES_DB=postgres
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=<tu password de supabase>
   ```

### Cargar datos iniciales (opcional)

```bash
# Datos geográficos y de prueba
psql "postgresql://..." -f scripts/create_hierarchy.sql
psql "postgresql://..." -f scripts/create_comuna_level.sql
psql "postgresql://..." -f scripts/create_population_model.sql
psql "postgresql://..." -f scripts/create_geolocation_layer.sql
psql "postgresql://..." -f scripts/insert_geolocation_data.sql
```

---

## 7. Variables de Entorno — Referencia Completa

### Compartidas (todos los servicios)

| Variable | Tipo | Ejemplo producción | Obligatoria |
|----------|------|--------------------|-------------|
| `NODE_ENV` | string | `production` | ✅ |
| `POSTGRES_HOST` | string | `db.xxxx.supabase.co` | ✅ |
| `POSTGRES_PORT` | number | `5432` | ✅ |
| `POSTGRES_DB` | string | `postgres` | ✅ |
| `POSTGRES_USER` | string | `postgres` | ✅ |
| `POSTGRES_PASSWORD` | string | `(segura, no usar 777)` | ✅ |
| `JWT_SECRET` | string | `(min 32 caracteres, aleatorio)` | ✅ |
| `JWT_EXPIRES_IN` | string | `8h` | ✅ |

### Solo API Gateway

| Variable | Tipo | Ejemplo | Nota |
|----------|------|---------|------|
| `API_GATEWAY_PORT` | number | `8080` | Railway asigna `PORT` automáticamente |
| `API_GATEWAY_CORS_ORIGIN` | string | `https://dashboard.agrored.co` | Separar múltiples con coma |
| `USER_SERVICE_URL` | URL | `http://user-service.railway.internal:3001` | URL interna |
| `PRODUCER_SERVICE_URL` | URL | `http://producer-service.railway.internal:3002` | |
| `OFFER_SERVICE_URL` | URL | `http://offer-service.railway.internal:3003` | |
| `RESCUE_SERVICE_URL` | URL | `http://rescue-service.railway.internal:3004` | |
| `DEMAND_SERVICE_URL` | URL | `http://demand-service.railway.internal:3005` | |
| `INVENTORY_SERVICE_URL` | URL | `http://inventory-service.railway.internal:3006` | |
| `LOGISTICS_SERVICE_URL` | URL | `http://logistics-service.railway.internal:3007` | |
| `INCIDENT_SERVICE_URL` | URL | `http://incident-service.railway.internal:3008` | |
| `ANALYTICS_SERVICE_URL` | URL | `http://analytics-service.railway.internal:3009` | |
| `NOTIFICATION_SERVICE_URL` | URL | `http://notification-service.railway.internal:3010` | |
| `ML_SERVICE_URL` | URL | `http://ml-service.railway.internal:3011` | |
| `AUTOMATION_SERVICE_URL` | URL | `http://automation-service.railway.internal:3012` | |
| `AUCTION_SERVICE_URL` | URL | `http://auction-service.railway.internal:3013` | |

### Solo notification-service

| Variable | Tipo | Ejemplo | Nota |
|----------|------|---------|------|
| `SMTP_HOST` | string | `smtp.gmail.com` | Requerido en producción |
| `SMTP_PORT` | number | `587` | 465 para SSL |
| `SMTP_SECURE` | boolean | `true` | true si puerto 465 |
| `SMTP_USER` | string | `notificaciones@agrored.co` | Requerido en producción |
| `SMTP_PASS` | string | `(app password)` | |
| `SMTP_FROM` | string | `noreply@agrored.co` | |

### Solo logistics-service

| Variable | Tipo | Ejemplo | Nota |
|----------|------|---------|------|
| `OSRM_URL` | URL | `https://router.project-osrm.org` | Demo público. En producción, self-host con datos de Colombia |

---

## 8. Web Dashboard

El dashboard es una app React + Vite que se despliega como **static site**.

### Railway
1. **+ New** → **GitHub Repo** → seleccionar `AgroRed`
2. Root Directory: `apps/web-dashboard`
3. Build Command: `npm install && npm run build`
4. Start Command: `npx serve dist -s -l 3000` (o usar Railway static deploy)
5. Variables:
   - `VITE_API_URL=https://agrored-gateway-production.up.railway.app` (URL pública del gateway)

### Render
1. **New** → **Static Site**
2. Root Directory: `apps/web-dashboard`
3. Build Command: `npm install && npm run build`
4. Publish Directory: `dist`
5. Variables:
   - `VITE_API_URL=https://agrored-gateway-xxxx.onrender.com`

### Vercel (alternativa gratuita para el frontend)
1. Importar repo → Root Directory: `apps/web-dashboard`
2. Framework Preset: Vite
3. Variables: `VITE_API_URL=<URL del gateway>`

---

## 9. Verificación post-despliegue

### 9.1 Health check del Gateway
```bash
curl https://<tu-gateway-url>/api/v1/catalog/services
```
Debe retornar los 13 servicios registrados.

### 9.2 Health check de la BD
```bash
# Registrar un usuario de prueba
curl -X POST https://<tu-gateway-url>/api/v1/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "t-test",
    "email": "test@agrored.co",
    "password": "TestPass123!",
    "fullName": "Test User",
    "role": "admin"
  }'
```

### 9.3 Login y token JWT
```bash
curl -X POST https://<tu-gateway-url>/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@agrored.co", "password": "TestPass123!"}'
```
Debe retornar un token JWT.

### 9.4 Verificar proxy a microservicios
```bash
TOKEN="<jwt obtenido>"

# Producers
curl https://<tu-gateway-url>/api/v1/producers?page=1&limit=5 \
  -H "Authorization: Bearer $TOKEN"

# Inventory
curl https://<tu-gateway-url>/api/v1/inventory?page=1&limit=5 \
  -H "Authorization: Bearer $TOKEN"
```

### 9.5 Verificar el Dashboard
Abrir la URL del dashboard en el navegador. Debe cargar la interfaz y conectar con el API Gateway.

---

## 10. Costos estimados

### Railway (Hobby Plan — $5/mes)

| Recurso | Costo aprox. |
|---------|-------------|
| 14 servicios Node.js (~256MB RAM c/u) | ~$5–15/mes total |
| PostgreSQL (Railway plugin) | ~$1–5/mes |
| Bandwidth | Incluido |
| **Total estimado (pruebas)** | **$10–20/mes** |

> Railway cobra por consumo real (CPU + RAM × tiempo). En pruebas con tráfico bajo, el costo es mínimo.

### Render (Free → Starter)

| Recurso | Costo aprox. |
|---------|-------------|
| 14 servicios (Free tier) | $0 (con cold starts de ~30s) |
| 14 servicios (Starter, $7 c/u) | $98/mes |
| PostgreSQL (Free tier, 90 días) | $0 |
| PostgreSQL (Starter) | $7/mes |
| **Total estimado (free)** | **$0** (pero con limitaciones) |
| **Total estimado (starter)** | **$105/mes** |

### Supabase (BD externa)

| Plan | Costo |
|------|-------|
| Free | $0 (500MB, 2 proyectos) |
| Pro | $25/mes (8GB, backups diarios) |

### Resumen de costos para pruebas

| Plataforma | Costo mínimo | Nota |
|------------|-------------|------|
| Railway + Supabase Free | ~$5–10/mes | ✅ **Mejor opción para pruebas** |
| Render Free + Supabase Free | $0/mes | Cold starts, BD expira en 90 días |
| Render Starter + Supabase Free | ~$105/mes | Sin cold starts |

---

## 11. Troubleshooting

### Error: `DOWNSTREAM_SERVICE_UNAVAILABLE`
- **Causa**: El API Gateway no puede conectar con un microservicio
- **Solución**: Verificar que la URL del servicio en las variables del gateway sea correcta. En Railway, verificar el dominio privado en Settings → Networking.

### Error: `JWT_SECRET` / `POSTGRES_PASSWORD` validation en producción
- **Causa**: Las validaciones en `env.ts` rechazan valores por defecto
- **Solución**: Usar un JWT_SECRET de ≥32 caracteres y no usar `777` como password de Postgres.

### Error: PostGIS extension no disponible
- **Causa**: La instancia de PostgreSQL no tiene PostGIS compilado
- **Solución**: Usar Supabase (PostGIS incluido) o Neon (PostGIS incluido en plan pago).

### Cold starts en Render (free tier)
- **Causa**: Render apaga servicios tras 15 minutos de inactividad
- **Solución**: Upgrade a Starter ($7/servicio) o usar Railway.

### Build falla con `npm install`
- **Causa**: Las dependencias están en el root `package.json` del monorepo
- **Solución**: En Railway, el build command debe ser:
  ```
  cd ../.. && npm ci && cd apps/<servicio> && npm run build
  ```
  O configurar el **Root Directory** correctamente para que Railway use el `package.json` del root.

### Los servicios no se descubren entre sí
- **Causa**: Las URLs apuntan a `localhost` en lugar del dominio de la plataforma
- **Solución**: Actualizar todas las `*_SERVICE_URL` a los dominios internos de Railway (`*.railway.internal`) o las URLs públicas de Render.

---

## Checklist final

- [ ] Base de datos PostgreSQL + PostGIS creada y accesible
- [ ] 14 migraciones SQL ejecutadas correctamente
- [ ] JWT_SECRET generado (≥32 chars, aleatorio)
- [ ] Variables de entorno compartidas configuradas
- [ ] 14 servicios backend desplegados y corriendo
- [ ] URLs internas de servicios configuradas en api-gateway
- [ ] API Gateway con dominio público generado
- [ ] CORS configurado con la URL del dashboard
- [ ] SMTP configurado en notification-service (si se necesitan emails)
- [ ] Web Dashboard desplegado con `VITE_API_URL` apuntando al gateway
- [ ] Health check `GET /api/v1/catalog/services` retorna 13 servicios
- [ ] Registro + login de usuario funciona
- [ ] Dashboard carga y conecta con el API
