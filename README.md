# AGRORED

Base inicial del ecosistema digital AGRORED, construida a partir de:

- `AGRORED_Plan_Negocio_NACIONAL.docx`
- `AGRORED_Arquitectura_Software.docx`
- `AGRORED_Prompts_Agente.docx`

Este primer corte implementa la fundacion tecnica de los modulos `01-03` definidos en los documentos: monorepo base, infraestructura compartida, bootstrap de base de datos, plantilla hexagonal y un `api-gateway` inicial.

## Objetivo del MVP base

AGRORED nace como una plataforma GovTech/FoodTech para articular productores rurales, operadores logisticos, programas alimentarios, comercio y gobiernos territoriales alrededor de cuatro capacidades iniciales:

- registro de actores del sistema alimentario
- gestion de oferta y demanda institucional
- rescate de excedentes alimentarios
- trazabilidad y analitica territorial

## Estructura creada

```text
.
|-- apps/
|   |-- analytics-service/
|   |-- automation-service/
|   |-- api-gateway/
|   |-- demand-service/
|   |-- incident-service/
|   |-- inventory-service/
|   |-- logistics-service/
|   |-- ml-service/
|   |-- notification-service/
|   |-- offer-service/
|   |-- producer-service/
|   |-- rescue-service/
|   `-- user-service/
|-- docs/
|-- features/
|-- infra/
|   `-- postgres/
|       `-- init/
|-- templates/
|   `-- node-service/
|-- .editorconfig
|-- .env.example
|-- .gitignore
|-- package.json
`-- tsconfig.base.json
```

## Componentes incluidos

- base PostgreSQL/PostGIS bootstrapable desde `infra/postgres/init`
- `user-service` con arquitectura hexagonal y persistencia PostgreSQL
- `producer-service` con persistencia PostgreSQL
- `offer-service` inicial para publicacion de oferta alimentaria
- `rescue-service` inicial para rescate y redistribucion de excedentes
- `demand-service` inicial para demanda institucional
- `inventory-service` inicial para stock operativo y trazabilidad de lotes
- `logistics-service` inicial para programacion de entregas y seguimiento logistico
- `incident-service` inicial para incidencias territoriales y operativas
- `notification-service` inicial para alertas operativas y transaccionales
- `analytics-service` inicial para resumen operativo y observatorio territorial
- `ml-service` inicial para apoyo heuristico a decision territorial
- `automation-service` inicial para orquestacion operativa persistida
- bootstrap SQL base sobre el esquema `public`
- features BDD iniciales para usuarios, productores, ofertas, rescates, demandas, inventario, logistica, incidencias, notificaciones, analitica, apoyo a decision y automatizacion
- documentacion de vision, backlog y fases del MVP
- `api-gateway` en Node.js + Express + TypeScript
- template reusable para microservicios con arquitectura hexagonal

## Inicio rapido

1. Copiar `.env.example` a `.env` y ajustar valores.
2. Instalar dependencias del monorepo con `npm.cmd install`.
3. Asegurar PostgreSQL local en `localhost:5432` con base `agrored` y credenciales `777` / `777`.
4. Ejecutar `infra/postgres/init/001_bootstrap_agrored.sql` sobre la base persistente.
5. Compilar los servicios con `npm.cmd run build:user`, `npm.cmd run build:producer`, `npm.cmd run build:offer`, `npm.cmd run build:rescue`, `npm.cmd run build:demand`, `npm.cmd run build:inventory`, `npm.cmd run build:logistics`, `npm.cmd run build:incident`, `npm.cmd run build:notification`, `npm.cmd run build:analytics`, `npm.cmd run build:ml`, `npm.cmd run build:automation` y `npm.cmd run build:gateway`.
6. Levantar los servicios con `npm.cmd run start:user`, `npm.cmd run start:producer`, `npm.cmd run start:offer`, `npm.cmd run start:rescue`, `npm.cmd run start:demand`, `npm.cmd run start:inventory`, `npm.cmd run start:logistics`, `npm.cmd run start:incident`, `npm.cmd run start:notification`, `npm.cmd run start:analytics`, `npm.cmd run start:ml`, `npm.cmd run start:automation` y `npm.cmd run start:gateway`, y validar `GET /health`, `GET /api/v1/catalog/services` y las rutas de `user-service`, `producer-service`, `offer-service`, `rescue-service`, `demand-service`, `inventory-service`, `logistics-service`, `incident-service`, `notification-service`, `analytics-service`, `ml-service` y `automation-service`.

## Prioridad tecnica siguiente

1. trazabilidad transversal y auditoria de eventos de negocio.
2. profundizar heuristicas y versionado del modelo en `ml-service`.
3. preparar scheduler externo y reglas avanzadas sobre `automation-service`.