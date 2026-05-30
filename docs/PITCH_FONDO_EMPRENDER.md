# AGRORED — Plan de Negocio para Fondo Emprender

## Plataforma GovTech/FoodTech para la Gestión del Sistema Alimentario Territorial de Colombia

---

## 1. RESUMEN EJECUTIVO

**AGRORED** es una plataforma digital de alcance nacional que articula productores rurales, operadores logísticos, programas alimentarios institucionales, comercio y gobiernos territoriales en un ecosistema único para gestionar la cadena alimentaria territorial de Colombia.

La plataforma aborda tres problemas críticos de forma simultánea:

1. **Desperdicio alimentario**: Colombia pierde 9,76 millones de toneladas de alimentos al año (34% de la producción), según el DNP.
2. **Inseguridad alimentaria territorial**: 54,2% de los hogares colombianos presentan algún grado de inseguridad alimentaria (ENSIN 2015), con mayor afectación en zonas rurales dispersas.
3. **Desarticulación entre actores**: Productores, comedores comunitarios, programas PAE, operadores logísticos y gobiernos municipales operan de forma aislada, sin datos interoperables ni inteligencia territorial compartida.

**AGRORED** resuelve estos problemas mediante una infraestructura digital compuesta por 14 microservicios especializados, una aplicación móvil para trabajo en campo, un panel web de control en tiempo real y un modelo geoespacial alineado con los códigos DANE del territorio colombiano.

**Propuesta de valor central**: Reducir el desperdicio alimentario, mejorar la cobertura de programas alimentarios institucionales y generar inteligencia territorial para la toma de decisiones públicas, todo desde una sola plataforma escalable a cualquier municipio de Colombia.

---

## 2. PROBLEMA

### 2.1 Desperdicio alimentario masivo

- Colombia pierde **9,76 millones de toneladas** de alimentos al año.
- El **40,5% de las pérdidas** ocurre en la etapa de producción y postcosecha por falta de conexión con la demanda.
- Los supermercados y plazas de mercado descartan alimentos próximos a vencer sin canal eficiente de redistribución.

### 2.2 Inseguridad alimentaria en zonas rurales y periurbanas

- **54,2% de los hogares** colombianos presentan inseguridad alimentaria.
- Los comedores comunitarios y programas PAE (Programa de Alimentación Escolar) no tienen visibilidad de la oferta disponible en su territorio.
- No existe un indicador territorial unificado para priorizar la intervención.

### 2.3 Desarticulación logística y operativa

- Los productores rurales no tienen un canal digital para publicar su oferta.
- Los operadores logísticos planifican rutas sin datos de demanda real.
- Los gobiernos municipales carecen de un observatorio territorial que integre oferta, demanda, logística e incidencias en tiempo real.
- Cada actor opera con sus propias herramientas (Excel, WhatsApp, papel), generando datos no interoperables.

### 2.4 Falta de inteligencia territorial para decisiones públicas

- Los municipios no cuentan con un índice de riesgo alimentario que permita priorizar inversión.
- Los datos de programas alimentarios están dispersos en múltiples fuentes no conectadas.
- No hay trazabilidad del alimento desde la finca hasta el plato del beneficiario.

---

## 3. SOLUCIÓN: PLATAFORMA AGRORED

### 3.1 Visión general

AGRORED opera como una **infraestructura digital para gestionar el sistema alimentario territorial**, no como una aplicación transaccional aislada. El sistema integra seis capacidades clave:

| Capacidad | Descripción |
|-----------|-------------|
| **Registro de actores** | Productores, supermercados, comedores, operadores logísticos, analistas territoriales y administraciones municipales |
| **Gestión de oferta y demanda** | Publicación de oferta alimentaria con matching automático contra demanda institucional |
| **Rescate de excedentes** | Canal digital para redistribución de alimentos desde supermercados, bancos de alimentos y donaciones |
| **Logística inteligente** | Planificación de rutas, tracking GPS en tiempo real, geocercas, ETA y optimización multi-vehículo |
| **Analítica territorial** | Observatorio con IRAT (Índice de Riesgo Alimentario Territorial), dashboards y exportación PDF/CSV |
| **Inteligencia artificial** | Modelos heurísticos de apoyo a la decisión con clasificación y recomendaciones operativas |

### 3.2 Flujo operativo principal

```
Productor rural         Supermercado/Plaza          Comedor/PAE
      │                        │                        │
      ├─ Publica oferta ──────>│                        │
      │                        ├─ Reporta excedente ───>│
      │                        │                        │
      └────────────┬───────────┘                        │
                   │                                    │
           ┌───────▼────────┐                           │
           │   AGRORED      │                           │
           │  Matching      │──── Match automático ────>│
           │  automático    │     (local + regional)    │
           │  oferta↔demanda│                           │
           └───────┬────────┘                           │
                   │                                    │
           ┌───────▼────────┐                           │
           │  Logística     │                           │
           │  - Ruta óptima │──── Entrega trazable ────>│
           │  - Tracking GPS│                           │
           │  - Geocercas   │                           │
           └───────┬────────┘                           │
                   │                                    │
           ┌───────▼────────┐                           │
           │  Observatorio  │                           │
           │  - IRAT        │──── Decisiones basadas ──>│
           │  - Dashboards  │     en evidencia          │
           │  - Reportes    │                           │
           └────────────────┘
```

### 3.3 Matching inteligente oferta-demanda

El sistema implementa un algoritmo de matching automático en tres fases:

1. **Fase local**: Al publicar una oferta, se buscan demandas compatibles en el mismo municipio.
2. **Fase regional**: Si no hay match local, se amplía la búsqueda a municipios vecinos.
3. **Notificación automática**: Los comedores comunitarios y programas PAE reciben alertas inmediatas de disponibilidad.

### 3.4 Subastas agrícolas con 6 algoritmos propietarios

AGRORED incluye un módulo de subastas agrícolas con seis algoritmos diseñados específicamente para el contexto rural colombiano:

| Algoritmo | Descripción |
|-----------|-------------|
| **AEA (Emparejamiento Agrológico)** | Pondera Frescura (30%) + Proximidad geográfica (30%) + Capacidad logística (20%) + Historial (20%) usando Haversine |
| **Subasta Holandesa** | Precio descendente automático por intervalos hasta precio de reserva — ideal para productos perecederos |
| **Visibilidad Geográfica** | Radio segmentado: 0-4h → 50km, 4-12h → 150km, 12h+ → nacional. Urgente: inmediato 150km |
| **Smart Match** | Resolución de empates: Oferta (60%) + Cercanía (30%) + Puntaje Social (10%) |
| **Anti-Sniping** | Cierre suave: puja en último minuto → extensión 3 min (máx 5 extensiones) |
| **Proxy Bidding** | Puja automática en nombre del comprador hasta su presupuesto máximo |

### 3.5 IRAT — Índice de Riesgo Alimentario Territorial

El IRAT es un indicador compuesto propio de AGRORED que evalúa 5 dimensiones por zona territorial:

| Dimensión | Descripción |
|-----------|-------------|
| **Disponibilidad** | Volumen de oferta alimentaria vs. población |
| **Acceso** | Cobertura de programas PAE, comedores comunitarios, subsidios |
| **Logística** | Capacidad de distribución, estado de vías, operadores disponibles |
| **Estabilidad** | Continuidad del suministro, estacionalidad, riesgo climático |
| **Incidencias** | Presión de incidencias territoriales (desabastecimiento, vías bloqueadas, etc.) |

**Clasificación resultante**: ÓPTIMO → ACEPTABLE → VIGILANCIA → CRÍTICO

El IRAT permite a los gobiernos municipales y departamentales **priorizar inversión pública** en las zonas con mayor riesgo alimentario, con datos verificables y actualizados en tiempo real.

---

## 4. ARQUITECTURA TECNOLÓGICA

### 4.1 Visión general

```
                        ┌──────────────────┐
       Internet ───────>│   API Gateway    │ (punto único de entrada)
                        │   Puerto 8080    │
                        │   JWT + RBAC     │
                        │   Rate Limiting  │
                        └────────┬─────────┘
                                 │ Red privada
         ┌───────────────────────┼───────────────────────┐
         │            │          │          │             │
   ┌─────┴─────┐ ┌───┴───┐ ┌───┴───┐ ┌───┴───┐ ┌───────┴───────┐
   │  User     │ │ Offer │ │Demand │ │Rescue │ │  Auction      │
   │  Service  │ │Service│ │Service│ │Service│ │  Service      │
   │  :3001    │ │ :3003 │ │ :3004 │ │ :3005 │ │  :3012        │
   └─────┬─────┘ └───┬───┘ └───┬───┘ └───┬───┘ └───────┬───────┘
         │            │         │         │              │
   ┌─────┴─────┐ ┌───┴────┐ ┌─┴────┐ ┌──┴───┐ ┌────────┴────────┐
   │ Producer  │ │Inventor│ │Logis-│ │Inci- │ │  Analytics      │
   │ Service   │ │  y     │ │tics  │ │dent  │ │  Service        │
   │ :3002     │ │ :3006  │ │:3007 │ │:3008 │ │  :3009          │
   └───────────┘ └────────┘ └──────┘ └──────┘ └────────┬────────┘
                                                        │
   ┌───────────┐ ┌────────┐ ┌────────────┐             │
   │   ML      │ │Notifi- │ │ Automation │     ┌───────┴───────┐
   │ Service   │ │cation  │ │  Service   │     │  Observatorio │
   │ :3010     │ │ :3011  │ │  :3013     │     │  Territorial  │
   └───────────┘ └────────┘ └────────────┘     └───────────────┘
         │            │          │          │             │
         └────────────┴──────────┼──────────┴─────────────┘
                                 │
                   ┌─────────────┼─────────────┐
                   │             │             │
            ┌──────┴──────┐ ┌───┴────┐ ┌──────┴──────┐
            │ PostgreSQL  │ │ Redis  │ │ Web         │
            │ + PostGIS   │ │ Cache  │ │ Dashboard   │
            │ 54 tablas   │ │ Events │ │ (React)     │
            │ Códigos DANE│ │ Queues │ │             │
            └─────────────┘ └────────┘ └─────────────┘
```

### 4.2 Stack tecnológico

| Componente | Tecnología |
|------------|-----------|
| **Backend** | Node.js ≥22, TypeScript, Express |
| **Arquitectura** | Hexagonal (Clean Architecture) por microservicio |
| **Base de datos** | PostgreSQL 18 + PostGIS 3.4 |
| **Cache y eventos** | Redis (Pub/Sub, BullMQ, JWT Blacklist, Rate Limiting) |
| **Modelo geoespacial** | PostGIS + códigos DANE + GADM + OpenStreetMap |
| **App móvil** | React Native con GPS nativo y buffer offline |
| **Dashboard web** | React + Vite + Leaflet (mapas interactivos) |
| **Testing** | Jest 30 con BDD/Gherkin — 236 tests, 36 suites |
| **Infraestructura** | Railway (cloud PaaS) — red privada entre servicios |
| **API** | OpenAPI 3.1 documentada, JWT Bearer, RBAC por roles |

### 4.3 Los 14 microservicios

| # | Servicio | Función principal |
|---|----------|-------------------|
| 1 | **API Gateway** | Punto único de entrada, autenticación JWT, rate limiting, proxy a servicios |
| 2 | **User Service** | Registro, autenticación, roles RBAC, recuperación de contraseña |
| 3 | **Producer Service** | Registro de productores rurales, importación masiva CSV, categorización |
| 4 | **Offer Service** | Publicación de oferta alimentaria con matching automático contra demanda |
| 5 | **Demand Service** | Registro de demanda institucional (comedores, PAE, ayuda humanitaria) |
| 6 | **Rescue Service** | Rescate y redistribución de excedentes alimentarios |
| 7 | **Inventory Service** | Control de inventario, trazabilidad de lotes, alertas de próximos a vencer |
| 8 | **Logistics Service** | Rutas óptimas, tracking GPS tiempo real, geocercas, ETA, VRP multi-vehículo |
| 9 | **Incident Service** | Incidencias territoriales con SLA, prioridad automática, alertas por zona |
| 10 | **Notification Service** | Alertas multicanal (email, SMS, push, in-app, webhook), despacho masivo |
| 11 | **Analytics Service** | IRAT, observatorio territorial, dashboards, mapas GIS, exportación PDF/CSV |
| 12 | **ML Service** | Apoyo a decisión heurístico, clasificación, recomendaciones operativas |
| 13 | **Automation Service** | Orquestación operativa automatizada, triggers por evento |
| 14 | **Auction Service** | Subastas agrícolas con 6 algoritmos propietarios (AEA, Dutch, Smart Match, etc.) |

### 4.4 Modelo de datos — 54 tablas

La base de datos contiene 54 tablas organizadas en módulos funcionales:

| Módulo | Tablas | Ejemplos |
|--------|--------|----------|
| **Core** | 12 | users, producers, offers, demands, rescues, inventory_items, logistics_orders, incidents, notifications, automation_runs, tenants, audit_log |
| **Tracking GPS** | 5 | recursos, tracking_historial, tracking_actual, delivery_events, coverage_zones |
| **Subastas** | 3 | auctions, auction_bids, auction_audit_log |
| **Institucional** | 6 | beneficiaries, food_programs, program_deliveries, alert_thresholds, coordination_tasks, allocation_scenarios |
| **Optimización** | 3 | vrp_solutions, vrp_vehicle_routes, spoilage_records |
| **Territorial GIS** | 7 | irat_zonas, incidencias_sociales, beneficiarios_zona, supermercados, operadores_logisticos, rutas_logisticas, productos_proximos_vencer |
| **Jerarquía DANE** | 11 | pais, departamento, municipio, comuna, zona, manzana, predio, vivienda, habitante, censo, comedor |
| **Catálogos** | 7 | geofence_zones, geofence_events, route_plans, route_stops, institutional_alerts, incident_actions, incident_alerts |

### 4.5 Modelo geoespacial con códigos DANE

AGRORED implementa un modelo geoespacial completo alineado con el Sistema de Codificación DANE (Departamento Administrativo Nacional de Estadística):

```
País  →  Departamento  →  Municipio  →  Comuna  →  Zona  →  Manzana  →  Predio
 CO        05 (Antioquia)   05001 (Medellín)   01-16     ...      ...       ...
           17 (Caldas)      17001 (Manizales)
           66 (Risaralda)   66001 (Pereira)
           ...              ...
```

**Cobertura actual cargada**:
- 1 país (Colombia)
- 6 departamentos (Antioquia, Caldas, Risaralda, Quindío, Valle del Cauca, Cundinamarca)
- 18 municipios con polígonos reales GADM
- 30 comunas con polígonos OpenStreetMap
- 16 zonas operativas
- 4 manzanas, 23 predios, 32 habitantes, 9 comedores comunitarios

**Interoperabilidad**: Los códigos DANE permiten cruzar datos con shapefiles del IGAC, QGIS, ArcGIS y cualquier sistema de información geográfica del Estado colombiano.

---

## 5. MODELO DE NEGOCIO

### 5.1 Segmentos de cliente

| Segmento | Necesidad | Propuesta de valor |
|----------|-----------|-------------------|
| **Alcaldías y gobernaciones** | Gestionar programas alimentarios, reducir desperdicio, tomar decisiones basadas en datos | IRAT, observatorio territorial, dashboards, trazabilidad |
| **Productores rurales** | Conectar con demanda institucional, acceder a subastas, reducir pérdidas postcosecha | Publicación de oferta, matching automático, subastas con visibilidad regional |
| **Comedores comunitarios y PAE** | Abastecimiento continuo, variedad, trazabilidad | Alertas de disponibilidad, registro de beneficiarios, reportes |
| **Supermercados y plazas** | Canal de redistribución para productos próximos a vencer | Módulo de rescate, deducción fiscal, impacto social medible |
| **Operadores logísticos** | Optimización de rutas, seguimiento de entregas | VRP multi-vehículo, tracking GPS, geocercas, app móvil |

### 5.2 Fuentes de ingreso

| Fuente | Modelo | Descripción |
|--------|--------|-------------|
| **Licenciamiento SaaS municipal** | Suscripción mensual | Precio escalonado por población del municipio: Categoría 6 ($500.000 COP/mes), Categoría 5 ($1.200.000), Categoría 4 ($2.500.000), Categoría 1-3 (personalizado) |
| **Comisión por transacción en subastas** | Porcentaje | 2-3% sobre el valor de cierre de cada subasta agrícola exitosa |
| **Módulo de análisis avanzado** | Add-on premium | IRAT automatizado, reportes PDF institucionales, exportación para contratación pública |
| **Integración con ERP/SAP** | Servicio profesional | Conectores para interoperabilidad con sistemas existentes de alcaldías y gobernaciones |
| **Capacitación y acompañamiento** | Servicios | Onboarding municipal, capacitación a productores, soporte técnico dedicado |

### 5.3 Estructura de costos

| Concepto | Estimado mensual |
|----------|-----------------|
| Infraestructura cloud (Railway + Redis + PostgreSQL) | $150 - $500 USD |
| Equipo técnico (3-4 desarrolladores) | Variable según fase |
| Operaciones y soporte | Variable según escala |
| Marketing y ventas B2G (Business to Government) | Variable |

### 5.4 Modelo de escalamiento

```
Fase 1 (Año 1):    Piloto Medellín (6 departamentos, 18 municipios cargados)
                    ├─ Validación con 3-5 comedores comunitarios
                    ├─ Integración con 10-20 productores rurales
                    └─ Primeras subastas agrícolas

Fase 2 (Año 2):    Expansión Eje Cafetero + Valle
                    ├─ 30+ municipios activos
                    ├─ Modelo SaaS consolidado
                    └─ Integración con plataformas gubernamentales

Fase 3 (Año 3):    Escala nacional
                    ├─ 100+ municipios
                    ├─ API pública para terceros
                    └─ Modelo replicable para otros países de LATAM
```

---

## 6. MERCADO OBJETIVO

### 6.1 Tamaño del mercado

| Indicador | Valor |
|-----------|-------|
| Municipios de Colombia | 1.122 |
| Presupuesto PAE nacional 2024 | ~$3,2 billones COP |
| Comedores comunitarios registrados | ~4.500 |
| Productores rurales registrados (DANE) | ~2,7 millones |
| Pérdidas alimentarias anuales (valor) | ~$28 billones COP |
| Inversión pública en seguridad alimentaria | En crecimiento constante |

### 6.2 Mercado direccionable

- **TAM (Total Addressable Market)**: 1.122 municipios × licenciamiento SaaS + comisiones de subasta = ~$15.000 millones COP/año
- **SAM (Serviceable Available Market)**: 200 municipios categoría 4-6 con programas alimentarios activos = ~$2.880 millones COP/año
- **SOM (Serviceable Obtainable Market)**: 30 municipios del Eje Cafetero + Medellín en los primeros 2 años = ~$432 millones COP/año

---

## 7. VENTAJA COMPETITIVA Y DIFERENCIADORES

### 7.1 Competidores actuales

| Competidor | Limitación |
|------------|-----------|
| WhatsApp/llamadas | Sin trazabilidad, sin datos, sin escalabilidad |
| Excel/hojas de cálculo | No conectado, no georreferenciado, sin tiempo real |
| Plataformas genéricas (marketplace) | No conocen el contexto alimentario territorial colombiano |
| Sistemas de gobierno (SISBEN, SIPSA) | Datos estáticos, no operativos, no integran logística |

### 7.2 Diferenciadores de AGRORED

| Diferenciador | Detalle |
|--------------|---------|
| **IRAT propio** | Único índice de riesgo alimentario territorial con 5 dimensiones calculadas en tiempo real |
| **6 algoritmos de subasta agrícola** | AEA, Dutch Auction, Smart Match, Visibility, Anti-Sniping, Proxy Bidding — diseñados para el agro colombiano |
| **Matching automático oferta↔demanda** | Conexión inteligente local → regional → nacional entre productores y programas alimentarios |
| **Modelo geoespacial DANE** | Interoperabilidad nativa con sistemas del Estado colombiano (IGAC, QGIS, ArcGIS) |
| **14 microservicios especializados** | Arquitectura escalable, cada módulo evoluciona independientemente |
| **Tracking GPS en tiempo real** | Con buffer offline para zonas rurales con conectividad intermitente |
| **VRP multi-vehículo** | Optimización de rutas logísticas con algoritmo Clarke-Wright |
| **Multi-tenancy por municipio** | Un solo despliegue sirve a múltiples municipios de forma aislada y segura |
| **App móvil para campo** | React Native con GPS nativo, funciona offline, diseñada para operadores logísticos rurales |
| **Exportación institucional** | PDF y CSV para reportes de contratación pública y rendición de cuentas |
| **Bus de eventos asíncrono** | Los 14 servicios se comunican por Redis Pub/Sub sin acoplamiento |
| **Spoilage tracking** | Medición de desperdicio en cada eslabón de la cadena (cosecha → distribución → consumo) |

### 7.3 Propiedad intelectual

- 6 algoritmos propietarios de subasta agrícola
- IRAT — Índice de Riesgo Alimentario Territorial (metodología propia)
- Modelo geoespacial territorial con 7 niveles de jerarquía DANE
- 17 especificaciones BDD (Behavior-Driven Development) que documentan las reglas de negocio

---

## 8. IMPACTO SOCIAL

### 8.1 ODS (Objetivos de Desarrollo Sostenible) impactados

| ODS | Meta | Contribución de AGRORED |
|-----|------|------------------------|
| **ODS 2**: Hambre Cero | 2.1 Acceso universal a alimentos nutritivos | Matching oferta↔demanda, IRAT para priorización, cobertura PAE/comedores |
| **ODS 12**: Producción y consumo responsables | 12.3 Reducir a la mitad el desperdicio alimentario per cápita | Rescate de excedentes, spoilage tracking, inventario con alertas de vencimiento |
| **ODS 11**: Ciudades y comunidades sostenibles | 11.a Vínculos económicos urbanos-rurales | Subastas agrícolas, logística campo→ciudad, observatorio territorial |
| **ODS 9**: Industria, innovación e infraestructura | 9.1 Infraestructuras fiables y sostenibles | 14 microservicios, PostGIS, tracking GPS para conectividad rural |
| **ODS 17**: Alianzas para lograr los objetivos | 17.17 Fomentar alianzas público-privadas | Modelo multi-actor: gobierno + productores + comercio + logística |

### 8.2 Indicadores de impacto medibles

| Indicador | Métrica | Fuente en AGRORED |
|-----------|---------|-------------------|
| Toneladas de alimentos rescatados | Kg/mes por municipio | rescue-service → spoilage_records |
| Beneficiarios atendidos por programa | Personas/mes por zona | analytics-service → beneficiarios_zona |
| Reducción de desperdicio | % respecto a línea base | inventory-service → near-expiry tracking |
| Productores conectados | # activos por municipio | producer-service → producers |
| Tiempo promedio de entrega | Horas desde oferta hasta entrega | logistics-service → delivery_events |
| Cobertura territorial IRAT | % de zonas con IRAT calculado | analytics-service → irat_zonas |
| Incidencias gestionadas | # resueltas con SLA cumplido | incident-service → incidents |
| Volumen transado en subastas | COP/mes | auction-service → auctions + bids |

---

## 9. EQUIPO Y CAPACIDADES

### 9.1 Estado actual del desarrollo

| Indicador | Valor |
|-----------|-------|
| Microservicios implementados | 14/14 (100%) |
| Tests automatizados | 236 tests, 36 suites — todos pasando |
| Features BDD documentadas | 17 especificaciones Gherkin |
| Tablas en base de datos | 54 tablas con relaciones, índices y vistas |
| Migraciones SQL | 17 archivos de migración evolutiva |
| Cobertura territorial cargada | 6 departamentos, 18 municipios, 30 comunas con polígonos reales |
| Endpoints REST documentados | 80+ endpoints con OpenAPI 3.1 |
| Despliegue en la nube | Railway (PostgreSQL + Redis + 14 servicios) |
| Repositorio de código | GitHub — organizado como monorepo |
| App móvil | React Native con GPS, mapas y modo offline |
| Dashboard web | React + Vite + Leaflet con KPIs en tiempo real |

### 9.2 Perfil del equipo requerido para escalar

| Rol | Cantidad | Función |
|-----|----------|---------|
| Líder técnico / CTO | 1 | Arquitectura, calidad, roadmap técnico |
| Desarrollador backend | 1-2 | Microservicios, base de datos, APIs |
| Desarrollador frontend/mobile | 1 | React, React Native, dashboards |
| Especialista GIS/datos | 1 | PostGIS, DANE, integración con IGAC |
| Comercial / Business Development | 1 | Relación con alcaldías, gobernaciones, operadores |
| Gestor de producto | 1 | Priorización, UX, validación con usuarios |

---

## 10. ROADMAP DE PRODUCTO

### Fase 0 — Fundación técnica ✅ COMPLETADA

- [x] Monorepo con 14 microservicios
- [x] PostgreSQL + PostGIS con modelo geoespacial
- [x] API Gateway con JWT, RBAC, rate limiting
- [x] Arquitectura hexagonal (Clean Architecture)
- [x] Redis Pub/Sub, BullMQ, cache
- [x] 236 tests automatizados
- [x] Despliegue en Railway

### Fase 1 — Identidad y actores ✅ COMPLETADA

- [x] user-service con 5 roles RBAC
- [x] producer-service con importación CSV
- [x] Multi-tenancy por municipio
- [x] Onboarding y autenticación JWT

### Fase 2 — Oferta, demanda y rescate ✅ COMPLETADA

- [x] offer-service con matching automático
- [x] demand-service con canales institucionales
- [x] rescue-service para excedentes
- [x] Subastas agrícolas con 6 algoritmos

### Fase 3 — Logística e incidencias ✅ COMPLETADA

- [x] logistics-service con rutas y tracking GPS
- [x] incident-service con SLA y prioridad automática
- [x] VRP multi-vehículo (Clarke-Wright)
- [x] Geocercas y ETA

### Fase 4 — Inventario y analítica ✅ COMPLETADA

- [x] inventory-service con trazabilidad y vencimientos
- [x] analytics-service con IRAT y observatorio
- [x] Mapas GIS con 7 capas interactivas
- [x] Exportación PDF/CSV

### Fase 5 — Inteligencia territorial ✅ COMPLETADA

- [x] ml-service con apoyo a decisión heurístico
- [x] automation-service con triggers operativos
- [x] notification-service multicanal
- [x] IRAT con 5 dimensiones por zona

### Fase 6 — Piloto y validación (PRÓXIMA)

- [ ] Validación con 3-5 comedores comunitarios en Medellín
- [ ] Integración con 10-20 productores rurales del Valle de Aburrá
- [ ] Primeras subastas agrícolas con producto real
- [ ] Medición de indicadores de impacto (línea base)
- [ ] Ajustes de UX basados en retroalimentación de campo

### Fase 7 — Escala regional

- [ ] Expansión a 30+ municipios del Eje Cafetero y Valle del Cauca
- [ ] Modelo SaaS consolidado con facturación
- [ ] Integración con API de datos abiertos del gobierno
- [ ] App móvil publicada en Play Store/App Store

### Fase 8 — Escala nacional

- [ ] 100+ municipios activos
- [ ] API pública para desarrolladores terceros
- [ ] Observatorio nacional alimentario
- [ ] Modelo replicable para otros países de LATAM

---

## 11. REQUERIMIENTO DE INVERSIÓN

### 11.1 Uso de los fondos solicitados

| Concepto | Porcentaje | Descripción |
|----------|-----------|-------------|
| **Desarrollo tecnológico** | 40% | Completar Fase 6 (piloto), mejorar UX, publicar app móvil, hardening de seguridad |
| **Infraestructura cloud** | 15% | Servidores Railway/AWS, PostgreSQL managed, Redis, dominio, SSL, monitoreo |
| **Equipo** | 25% | Contratación de 2-3 perfiles clave (desarrollador, comercial, GIS) |
| **Piloto en campo** | 10% | Desplazamientos, capacitaciones, equipos para productores, conectividad rural |
| **Marketing y ventas B2G** | 10% | Material comercial, participación en ferias, relaciones institucionales |

### 11.2 Hitos con los fondos

| Hito | Plazo | Entregable |
|------|-------|-----------|
| Piloto funcional Medellín | Mes 1-3 | 5 comedores + 20 productores + 2 operadores logísticos activos |
| Métricas de impacto validadas | Mes 3-4 | Reporte con toneladas rescatadas, beneficiarios atendidos, tiempos de entrega |
| App móvil en Play Store | Mes 2-4 | Aplicación publicada y en uso por operadores logísticos |
| Primer municipio SaaS | Mes 4-6 | Primer contrato de licenciamiento municipal firmado |
| Expansión a 5 municipios | Mes 6-9 | 5 municipios con IRAT calculado y operaciones activas |
| Modelo sostenible validado | Mes 9-12 | Ingresos recurrentes cubriendo costos operativos |

---

## 12. INFORMACIÓN DE CONTACTO

| Campo | Valor |
|-------|-------|
| **Nombre del proyecto** | AGRORED |
| **Repositorio** | https://github.com/cesarmoreno7/AgroRed |
| **Emprendedor** | César Moreno |
| **Estado** | Producto funcional con 14 microservicios, 54 tablas, 236 tests, desplegado en la nube |

---

## 13. ANEXOS TÉCNICOS

### Anexo A — Endpoints principales (80+)

La plataforma expone más de 80 endpoints REST documentados con OpenAPI 3.1, incluyendo:

- **Autenticación**: registro, login, logout, recuperación de contraseña
- **Productores**: CRUD + importación CSV masiva
- **Ofertas**: publicación con matching automático
- **Demanda**: registro institucional multicanal
- **Rescate**: redistribución de excedentes
- **Inventario**: control de lotes, alertas de vencimiento, importación CSV
- **Logística**: órdenes, rutas, paradas, optimización VRP, tracking GPS, geocercas, ETA
- **Incidencias**: registro, SLA, prioridad, acciones, alertas, auto-clasificación
- **Notificaciones**: registro, despacho individual y masivo
- **Analítica**: resumen operativo, IRAT, programas alimentarios, beneficiarios, mapas GIS
- **ML**: apoyo a decisión heurístico, recomendaciones
- **Automatización**: ejecución de workflows operativos
- **Subastas**: publicación, pujas, Dutch auction, cierre, ranking AEA

### Anexo B — Roles del sistema

| Rol | Acceso |
|-----|--------|
| **PRODUCER** | Subastas, perfil de productor, rescates |
| **OPERATOR** | Subastas, demanda, inventario, logística, notificaciones, ofertas, automatización |
| **MUNICIPALITY** | Subastas, demanda, incidencias, inventario, logística, ofertas, rescates |
| **TERRITORIAL_MANAGER** | Analítica, subastas, incidencias, logística |
| **ADMIN** | Acceso completo a todos los módulos |

### Anexo C — Features BDD documentadas (17)

1. Registro de usuario con roles controlados
2. Registro de productor rural georreferenciado
3. Publicación de oferta alimentaria
4. **Matching automático oferta↔demanda** (local + regional + notificaciones)
5. Registro de demanda institucional
6. Registro de rescate de excedentes
7. Registro de inventario operativo trazable
8. Creación de orden logística
9. Registro de incidencia territorial
10. Registro de notificación operativa
11. Consulta de resumen analítico territorial
12. Apoyo a decisión heurístico + recomendaciones ML
13. Ejecución de automatización operativa
14. Publicación de subasta (ascendente + holandesa) con visibilidad segmentada
15. Pujas con anti-sniping y proxy bidding
16. Subasta holandesa con precio descendente
17. Cierre de subasta con Smart Match

### Anexo D — Tecnologías utilizadas

| Categoría | Tecnología |
|-----------|-----------|
| Runtime | Node.js ≥22 |
| Lenguaje | TypeScript |
| Framework web | Express |
| Base de datos | PostgreSQL 18 + PostGIS 3.4 |
| Cache/Eventos | Redis (Pub/Sub, BullMQ, Cache) |
| Testing | Jest 30 + Gherkin BDD |
| API Documentation | OpenAPI 3.1 |
| App móvil | React Native (react-native-maps, GPS nativo) |
| Dashboard | React + Vite + Leaflet + Chart.js |
| Seguridad | JWT, bcrypt, Helmet, CORS, Rate Limiting |
| Geodatos | GADM, OpenStreetMap, códigos DANE |
| Cloud | Railway (PaaS) |
| Monorepo | npm workspaces |
| Arquitectura | Hexagonal (Clean Architecture) |
| CI | GitHub |

---

*Documento generado para la presentación al Fondo Emprender — AGRORED © 2025*
