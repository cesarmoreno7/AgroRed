# Template Node Service

Plantilla base para crear microservicios AGRORED en Node.js + Express + TypeScript bajo arquitectura hexagonal.

## Convenciones

- reemplazar `__SERVICE_NAME__` por el nombre del servicio, por ejemplo `user-service`
- reemplazar `__ENTITY_NAME__` por la entidad principal del bounded context
- reemplazar `__ROUTE_NAME__` por el recurso HTTP principal
- mantener imports con sufijo `.js` para compatibilidad con `NodeNext`

## Estructura sugerida

```text
src/
|-- application/
|   `-- use-cases/
|-- domain/
|   |-- entities/
|   `-- ports/
|-- infrastructure/
|   `-- repositories/
|-- interface/
|   `-- http/
|       `-- routes/
`-- index.ts
```

## Checklist para un nuevo servicio

1. crear `package.json` y `tsconfig.json` a partir de los templates
2. implementar entidad y puertos de dominio
3. agregar adaptadores de persistencia para PostgreSQL y RabbitMQ
4. exponer `GET /health`
5. definir feature BDD antes de completar endpoints de negocio

