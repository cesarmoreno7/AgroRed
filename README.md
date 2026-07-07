# AGRORED

Ecosistema digital AGRORED: una plataforma GovTech/FoodTech para articular productores rurales,
operadores logísticos, programas alimentarios, comercio y gobiernos territoriales alrededor de
cuatro capacidades:

- registro de actores del sistema alimentario
- gestión de oferta y demanda institucional
- rescate de excedentes alimentarios
- trazabilidad y analítica territorial

## Arquitectura actual: monolito modular

> Este proyecto empezó como un conjunto de microservicios independientes (`apps/*-service`, uno por
> dominio). Ya no funciona así. Desde la consolidación en `api-gateway`, **todo el backend corre como
> un único proceso Node**: `apps/api-gateway/src` importa el código fuente de cada dominio
> directamente (`apps/user-service/src/...`, `apps/offer-service/src/...`, etc.) en vez de llamarlos
> por HTTP. Las carpetas `apps/*-service` siguen existiendo porque ahí vive el código de cada
> dominio (entidades, casos de uso, repositorios), pero no se ejecutan ni se despliegan como
> procesos separados — son módulos de una sola compilación (`npm run build:monolith`).
>
> Solo dos excepciones no siguen exactamente este patrón:
> - `apps/web-dashboard`: frontend React/Vite, se despliega como static site aparte.
> - `apps/mobile`: app React Native, consume la misma API del monolito.

Motivo de conservar los `_SERVICE_URL` en `.env`: `apps/api-gateway/src/infrastructure/http/serviceRegistry.ts`
los usa solo como **metadata descriptiva** para el endpoint de catálogo (`GET /api/v1/catalog/services`)
y para el healthcheck — no abren conexiones de red reales entre "servicios".

## Base de datos: Neon (no un Postgres local)

El `.env` de este repo apunta `POSTGRES_HOST` directo a **Neon** (PostgreSQL serverless con
soporte PostGIS), tanto en desarrollo como en producción. `docker-compose.yml` puede levantar un
Postgres local si prefieres desarrollar sin depender de la red, pero no es el flujo por defecto —
si cambias `.env` para usarlo, recuerda correr las migraciones (`npm run migrate`) contra esa base
también.

## Despliegue: Render

La plataforma activa es **Render**, mediante el Blueprint `render.yaml` en la raíz (ver
[`docs/03_GUIA_DESPLIEGUE_RENDER.md`](docs/03_GUIA_DESPLIEGUE_RENDER.md) para el detalle completo).
Despliega tres recursos: el monolito (`agrored-api-gateway`), el dashboard como static site
(`agrored-web-dashboard`) y Redis managed.

## Estructura del repo

```text
.
|-- apps/
|   |-- api-gateway/        # monolito: HTTP, auth, RBAC, y consume el resto de apps/*-service
|   |-- user-service/       # dominio: usuarios, auth
|   |-- producer-service/   # dominio: productores
|   |-- offer-service/      # dominio: oferta alimentaria y catálogo de productos
|   |-- rescue-service/     # dominio: rescate de excedentes
|   |-- demand-service/     # dominio: demanda institucional
|   |-- inventory-service/  # dominio: inventario y trazabilidad
|   |-- logistics-service/  # dominio: rutas y entregas
|   |-- incident-service/   # dominio: incidencias territoriales
|   |-- notification-service/ # dominio: notificaciones y alertas
|   |-- analytics-service/  # dominio: observatorio territorial
|   |-- ml-service/         # dominio: apoyo heurístico a decisión
|   |-- automation-service/ # dominio: orquestación operativa
|   |-- auction-service/    # dominio: subastas de excedentes
|   |-- institution-service/ # dominio: instituciones demandantes
|   |-- location-service/   # dominio: catálogo territorial (departamentos/municipios/veredas)
|   |-- delivery-service/   # dominio: entregas de productos y trazabilidad
|   |-- shared/             # utilidades compartidas (Redis, RBAC, logger, tipos)
|   |-- web-dashboard/      # frontend React + Vite
|   `-- mobile/             # app React Native
|-- infra/postgres/         # migraciones SQL (runner: scripts/migrate.ts)
|-- tests/                  # integración (Jest) y E2E (Playwright)
|-- docs/
`-- render.yaml
```

## Inicio rápido

1. Copiar `.env.example` a `.env` y completar credenciales reales de Neon, email/SMTP y Gemini.
2. Instalar dependencias del monorepo: `npm install`.
3. Aplicar migraciones: `npm run migrate`.
4. Levantar el monolito: `npm run dev:gateway` (o `npm run build:monolith && npm run start:monolith`).
5. Levantar el dashboard: `npm run dev:dashboard`.
6. Validar `GET /ping`, `GET /api/v1/catalog/services`, y login contra `/api/v1/users/login`.

## Tests

```bash
npm test              # Jest — unit + integración
npm run test:e2e      # Playwright — arranca gateway y dashboard automáticamente (ver playwright.config.ts)
npm run test:coverage
```

## Guías Operativas

- [`docs/03_GUIA_DESPLIEGUE_RENDER.md`](docs/03_GUIA_DESPLIEGUE_RENDER.md): despliegue en Render.
- [`docs/08_GUIA_LOCAL_Y_ACCESOS_ROLES.md`](docs/08_GUIA_LOCAL_Y_ACCESOS_ROLES.md): levantamiento local paso a paso y credenciales de acceso por rol.
- [`docs/07_MATRIZ_PRUEBAS_ROLES_QA.md`](docs/07_MATRIZ_PRUEBAS_ROLES_QA.md): matriz de pruebas por rol para validación QA.
- [`docs/06_CHECKLIST_DESPLIEGUE_STAGING_PROD.md`](docs/06_CHECKLIST_DESPLIEGUE_STAGING_PROD.md): checklist de despliegue controlado a staging/producción.
