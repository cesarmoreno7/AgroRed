# Manual de Usuario — AgroRed
**Ecosistema Digital de Gobernanza Alimentaria**
Versión 1.0 · Mayo 2026

---

## Índice

1. [Introducción al Sistema](#1-introducción-al-sistema)
2. [Acceso y Autenticación](#2-acceso-y-autenticación)
3. [Roles y Perfiles de Usuario](#3-roles-y-perfiles-de-usuario)
4. [Rol: Administrador Municipal (admin_municipal)](#4-rol-administrador-municipal)
5. [Rol: Productor (producer)](#5-rol-productor)
6. [Rol: Operador Logístico (logistics_operator)](#6-rol-operador-logístico)
7. [Rol: Analista Territorial (territorial_analyst)](#7-rol-analista-territorial)
8. [Rol: Cocina Comunitaria (community_kitchen)](#8-rol-cocina-comunitaria)
9. [Rol: Supermercado / Establecimiento Aliado (supermarket)](#9-rol-supermercado--establecimiento-aliado)
10. [Módulos del Sistema — Referencia Rápida](#10-módulos-del-sistema--referencia-rápida)
11. [Credenciales de Prueba](#11-credenciales-de-prueba)

---

## 1. Introducción al Sistema

**AgroRed** es una plataforma GovTech / FoodTech que conecta productores rurales, instituciones públicas, operadores logísticos y establecimientos aliados para coordinar la distribución alimentaria en municipios colombianos.

### Arquitectura general

- **Frontend:** Dashboard web en React + Vite, accesible desde cualquier navegador.
- **Backend:** API Gateway + 13 microservicios especializados.
- **Base de datos:** PostgreSQL (Neon) con soporte multi-tenant por municipio.
- **URL de producción:** `https://agrored-web-dashboard.onrender.com`

### Modelo Multi-Tenant

Cada municipio es un **tenant** independiente. Los usuarios pertenecen a un tenant y por defecto solo ven la información de su municipio, salvo el `admin_municipal` que puede activar la vista global.

---

## 2. Acceso y Autenticación

### Inicio de Sesión

1. Ingresar a `https://agrored-web-dashboard.onrender.com`
2. Introducir **Email** y **Contraseña**
3. Hacer clic en **Iniciar sesión**

El sistema emite un token JWT con vigencia de **8 horas**. Al vencerse, la sesión expira automáticamente y se redirige al login.

### Recuperación de Contraseña

Disponible mediante el endpoint `POST /api/v1/users/recover-password` (integrado con SMTP). Función disponible para todos los roles.

### Cierre de Sesión

Botón **"Cerrar sesión"** en la parte inferior del menú lateral. El token queda invalidado en el servidor (blacklist Redis).

---

## 3. Roles y Perfiles de Usuario

| Rol | Perfil | Municipios de prueba |
|-----|--------|---------------------|
| `admin_municipal` | Administrador con acceso total | Bogotá, Rionegro, Santa Rosa, San Roque |
| `producer` | Productor agrícola / campesino | Bogotá, Rionegro, Santa Rosa, San Roque |
| `logistics_operator` | Operador de rutas y entregas | Bogotá, San Roque |
| `territorial_analyst` | Analista de datos territoriales | Bogotá, Rionegro |
| `community_kitchen` | Responsable de comedor comunitario | Bogotá, Santa Rosa |
| `supermarket` | Establecimiento comercial aliado | (sin municipio fijo) |

### Menú según rol

| Módulo | Admin | Productor | Logística | Analista | Cocina | Supermercado |
|--------|:-----:|:---------:|:---------:|:--------:|:------:|:------------:|
| Tablero Institucional | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mapa Territorial | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Usuarios | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Productores | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ofertas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Rescates | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Demandas | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Instituciones | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Orígenes Aliados | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Inventario | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Flota en tiempo real | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Geocercas Logísticas | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Incidencias Sociales | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Notificaciones | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Subastas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Alertas IRAT | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Apoyo a Decisión (ML) | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Copiloto IA | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 4. Rol: Administrador Municipal

**Email de prueba:** `admin@agrored.co` · **Contraseña:** `Admin@1234!`

El `admin_municipal` tiene **acceso completo** al sistema. Es el único rol que ve datos de **todos los municipios simultáneamente** en el Tablero de Control.

---

### 4.1 Tablero de Control Institucional (`/`)

Vista principal con métricas en tiempo real de toda la operación del ecosistema.

**KPIs visibles:**
- **Índice IRAT** (0–100): mide el riesgo alimentario territorial. Se calcula automáticamente a partir de incidentes abiertos, demandas sin cubrir, ofertas publicadas y rescates programados. Color verde = bajo riesgo, rojo = crítico.
- **Cobertura de Programas (%)**: porcentaje de beneficiarios cubiertos sobre el total objetivo de programas activos.
- **Recursos en Ruta**: vehículos y operadores con posición GPS activa.
- **Incidentes Abiertos**: alertas sociales pendientes de resolución.
- **Inventario Disponible (kg)**: stock disponible en todas las bodegas.
- **Demandas Abiertas**: solicitudes institucionales sin asignar.
- **Rescates Programados**: operaciones de rescate alimentario agendadas.
- **Productores Activos**: predios verificados con estado activo.
- **Ofertas Publicadas**: productos disponibles en el mercado.
- **Subastas Registradas**: subastas activas o históricas.
- **Logística Programada**: órdenes de distribución pendientes.
- **Usuarios del Sistema**: total de actores registrados.

**Gráficos:**
- **Balance Operativo** (dona): distribución de incidentes, demandas, rescates e inventario.
- **Seguimiento Logístico**: listado en tiempo real de recursos activos con estado, tipo y velocidad.
- **Visión Territorial** (barras): productores, ofertas y demandas por municipio.
- **Totales del Sistema**: tabla resumen de todos los módulos.

> El tablero se actualiza automáticamente cada **30 segundos**.

---

### 4.2 Gestión de Usuarios (`/users`)

Crear, visualizar y editar usuarios del sistema.

**Funciones disponibles:**
- **Registrar usuario**: nombre completo, email, contraseña, rol, municipio (tenant).
- **Listar usuarios**: vista agrupada por rol o por municipio (toggle).
- **Buscar**: filtro en tiempo real por nombre o email.
- **Editar**: cambiar nombre, rol y contraseña.
- **Cards de resumen**: conteo por cada rol del sistema.

**Roles que puede asignar:** `admin_municipal`, `producer`, `logistics_operator`, `territorial_analyst`, `community_kitchen`, `supermarket`.

> Como `admin_municipal`, ve usuarios de **todos los municipios**.

---

### 4.3 Productores (`/producers`)

Gestión del padrón de productores rurales del territorio.

**Funciones disponibles:**
- **Registrar productor**: tipo (individual / asociación / cooperativa), organización, contacto, municipio, zona (rural / periferia urbana), categorías de productos, coordenadas GPS.
- **Mapa interactivo**: marcadores con pin de color según estado (verde = activo, amarillo = pendiente, gris = inactivo). Clic en marcador → panel lateral con estadísticas detalladas.
- **Panel de detalle**: al seleccionar un productor muestra KPIs (ofertas activas, rescates, kg rescatados) y gráfico de producción histórica por temporada.
- **Tabla filtrable**: filtros por estado y municipio. Ver coordenadas (📍) o indicador de productor sin ubicación (—).
- **Editar productor**: actualizar todos los campos incluyendo coordenadas.

> Vista global: el admin ve los **10 productores** de todos los municipios.

---

### 4.4 Instituciones (`/institutions`)

Registro de entidades que reciben o demandan alimentos: colegios, hospitales, comedores, hogares, etc.

**Tipos de institución:** educativo, hospital, prisión, comedor comunitario, aeropuerto, militar, hogar del adulto mayor, albergue, otro.

**Funciones disponibles:**
- **Registrar institución**: nombre, tipo, contacto, municipio, dirección, coordenadas, capacidad de beneficiarios, categorías de productos requeridos.
- **Editar institución**: actualizar todos los campos.
- **Cambio de estado** (inline): `pending_verification` → `active` → `inactive` directamente desde la tabla.
- **Filtros**: por tipo de institución y estado.
- **KPI Cards**: total, activas, pendientes, total de beneficiarios.

---

### 4.5 Orígenes Aliados (`/origins`)

CRUD exclusivo del administrador para registrar supermercados, plazas de mercado y establecimientos comerciales que colaboran con AgroRed vendiendo productos a precios económicos.

**Campos del formulario:**
- Nombre del establecimiento
- Municipio
- Dirección (opcional)
- Coordenadas GPS (latitud / longitud)
- Estado: Activo / Inactivo (toggle)

**Funciones disponibles:**
- **Crear** origen aliado.
- **Editar** datos y estado del establecimiento.
- **Eliminar** (soft-delete): el registro no se borra físicamente.
- **Filtros**: Todos / Activos / Inactivos + buscador por nombre, municipio o dirección.

> Icono 📍 indica que el origen tiene coordenadas para aparecer en el mapa. Los orígenes se usan también como punto de partida en operaciones de rescate (`food_origins`).

---

### 4.6 Inventario (`/inventory`)

Control de existencias de productos alimentarios almacenados.

**Funciones disponibles:**
- **Registrar ítem**: nombre de producto, categoría, unidad, cantidad disponible, cantidad reservada, bodega/ubicación, municipio, tipo de fuente (oferta / rescate / compra directa / donación / transferencia), fecha de vencimiento.
- **Editar** ítem de inventario.
- **Tabla**: muestra columnas de producto, bodega, disponible, reservado, municipio, vencimiento, fuente y estado.
- **Alerta de vencimiento**: ítems próximos a vencer se destacan.

---

### 4.7 Geocercas Logísticas (`/logistics`)

Definición de zonas geográficas para la operación logística + vista de órdenes.

**Funciones disponibles:**
- **Crear geocerca**: nombre, tipo (punto de entrega / zona restringida / bodega / zona crítica), coordenadas del centro (lat/lng) y radio en metros.
- **Mapa interactivo**: círculos de colores (verde = entrega, rojo = restringida, azul = bodega, naranja = crítica). Clic en círculo → selección + info.
- **Editar geocerca**: actualizar nombre, tipo, centro y radio.
- **Órdenes logísticas** (sección inferior): tabla con órdenes reales mostrando origen → destino, cantidad asignada, fechas de recogida y entrega, modo de ruta y estado.

---

### 4.8 Flota en Tiempo Real (`/fleet`)

Seguimiento GPS de vehículos y operadores activos.

**Vista:**
- Mapa con marcadores de posición actual de cada recurso.
- Color por estado: verde (en ruta), azul (disponible), gris (inactivo), ámbar (mantenimiento).
- Popup con nombre, tipo, estado y velocidad actual.
- El mapa se ajusta automáticamente para incluir todos los recursos visibles.

---

### 4.9 Mapa Territorial (`/territorial`)

Vista integrada de productores e instituciones/comedores sobre mapa CARTO Voyager.

**Funciones:**
- **Búsqueda**: escribe nombre de productor o institución → lista desplegable → volar al punto (animación 1.2s).
- **Capas**: toggle para mostrar/ocultar productores (🌾) y clientes/instituciones (🏢).
- **Panel de detalle**: al seleccionar un punto muestra estadísticas, ofertas e inventario relacionado.

---

### 4.10 Incidencias Sociales (`/incidents`)

Registro y seguimiento de alertas territoriales.

**Funciones disponibles:**
- **Reportar incidencia**: tipo (delay, damage, accident, theft, weather, etc.), severidad (low / medium / high / critical), título, descripción, ubicación, coordenadas, fecha de ocurrencia, municipio.
- **Feed de incidencias**: tarjetas ordenadas por fecha. Borde rojo izquierdo para incidencias críticas.
- **Estados**: open → in_progress → resolved → closed.
- **Acciones**: escalar, asignar, resolver.

---

### 4.11 Notificaciones (`/notifications`)

Centro de gestión de alertas y mensajes transaccionales.

**Canales disponibles:**
| Canal | Descripción | Configuración requerida |
|-------|-------------|------------------------|
| 📧 Email | SMTP directo | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| 💬 SMS | Twilio u otro proveedor | `TWILIO_SID`, `TWILIO_TOKEN` |
| 📱 WhatsApp | API Business de Meta / Twilio | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` |
| 🔔 In-App | Tiempo real en dashboard | Redis + WebSocket |

**Funciones disponibles:**
- **Crear notificación**: canal, destinatario, título, mensaje, fecha programada.
- **Asociar** a: incidencia (`incidentId`), orden logística (`logisticsOrderId`) u oferta (`offerId`). Al menos una referencia es obligatoria.
- **Editar** notificación pendiente.
- **Tabla**: filtro por destinatario, título, mensaje o canal.
- **Guía de integración** (sección inferior): ejemplos de payload para cada canal con explicación de configuración.

---

### 4.12 Subastas (`/auctions`)

Mercado de subastas de excedentes alimentarios.

**Como administrador puede:**
- **Publicar subasta** seleccionando cualquier productor registrado (dropdown), definir producto, categoría, unidad, cantidad, fecha de cosecha, tipo (ascendente / holandesa), precio base, precio de reserva, duración (2h–24h) y coordenadas.
- **Subastas holandesas**: configurar % de bajada por paso y minutos entre pasos.
- **Pujar** en subastas activas de otros.
- **Ver histórico**: todas las subastas con estado (activa, extendida, con ganador, sin ganador, cancelada).
- **Buscar** por producto, municipio o categoría.

---

### 4.13 Alertas IRAT (`/alerts`)

Panel de alertas institucionales generadas automáticamente por el sistema analítico, con verificación
horaria automática (`irat-alert-check`) y correo real a los administradores municipales del tenant
cuando la severidad es alta o crítica.

**Tipos de alerta:**
- IRAT alto (`irat_alto`) — índice de riesgo alimentario territorial por encima del umbral
- Riesgo de desabastecimiento (`desabastecimiento`) — oferta muy por debajo de la demanda
- Exceso sin destino (`exceso_sin_destino`) — oferta sin demanda ni logística activa
- Baja cobertura de programas (`baja_cobertura`)
- Compra local insuficiente (`compra_local_insuficiente`) — incumplimiento de la Ley 2046 (ver 4.13.1)

**Función:** Ver y reconocer alertas con fecha y responsable; generar una nueva verificación manual con
el botón "Generar alertas".

#### 4.13.1 Cumplimiento Ley 2046 de 2020 — Compra Local

Panel dentro de `/alerts` que calcula, por cada institución del municipio (ESE, comedores, hogares
ICBF, aeropuerto, etc.), el porcentaje de compra directa a pequeños productores sobre el valor
registrado en el módulo de Entregas de Productos — el mínimo legal para entidades públicas es el 30%
(Ley 2046 de 2020).

- **Estados:** Cumple (≥30%), En riesgo (20–30%), Incumple (<20%), Sin datos (sin entregas registradas
  en el período).
- **Botón "Verificar cumplimiento":** ejecuta el chequeo bajo demanda y genera alertas
  `compra_local_insuficiente` para las instituciones por debajo del umbral (además del chequeo
  automático horario).
- **Exportación:** botones CSV y PDF con el reporte completo, pensado para entregar a Contraloría o
  anexar al Plan de Desarrollo municipal.
- **Alcance real:** el porcentaje cubre únicamente lo que la institución ha registrado dentro de
  AgroRed (vía Entregas de Productos), no la totalidad de su presupuesto de alimentos fuera del
  sistema — es una herramienta de trazabilidad y evidencia, no un reemplazo de la contabilidad
  institucional completa.

---

### 4.14 Apoyo a Decisión — ML (`/ml`)

Sugerencias heurísticas generadas por el motor de decisión territorial.

**Vista:**
- 4 cards de prioridad (Crítico / Alto / Medio / Bajo) con conteo.
- Tarjetas de sugerencia con: título, descripción, nivel de prioridad, barra de confianza del modelo (%), estado (pendiente / aplicado / descartado).

**Tipos de sugerencia:** activar oferta complementaria, programar logística, gestionar incidentes, optimizar rutas.

---

### 4.15 Copiloto IA (`/ai-copilot`)

Asistente conversacional para consultas sobre el sistema y el territorio.

Disponible únicamente para `admin_municipal`.

---

## 5. Rol: Productor

**Emails de prueba:** `productor@agrored.co`, `productor@rionegro.agrored.co`
**Contraseña:** `Prod@1234!`

El productor accede a los módulos relacionados con su actividad productiva y comercial.

---

### 5.1 Tablero Institucional (`/`)

Vista del tablero filtrado para su municipio/tenant.

---

### 5.2 Mis Productores (`/producers`)

El productor puede ver su propio registro y los de otros productores de la red. Al acceder al formulario de publicación de subasta, el sistema **auto-selecciona su registro de productor** (basado en el `userId` de la sesión) y pre-carga municipio y coordenadas.

**Acciones del productor:**
- Ver tabla de productores del sistema.
- Ver mapa con sus coordenadas.
- Editar **su propio** perfil de productor.

---

### 5.3 Ofertas (`/offers`)

Publicar y gestionar las ofertas de productos disponibles en el mercado.

**Funciones disponibles:**
- **Publicar oferta**: nombre del producto, categoría, unidad, cantidad disponible, precio/kg, fecha de disponibilidad, municipio, coordenadas, notas.
- **Ver todas las ofertas** activas de la red.
- **Editar/cerrar** sus propias ofertas.
- **Filtros**: por estado (publicado, reservado, agotado) y búsqueda por texto.

---

### 5.4 Rescates (`/rescues`)

Registrar operaciones de rescate alimentario de excedentes.

**Funciones disponibles:**
- **Registrar rescate**: producto, cantidad rescatada, canal (comedor popular / banco de alimentos / entidad pública / ONG / empresa privada), organización de destino, fecha programada, beneficiarios, coordenadas, origen (food_origin).
- **Ver rescates** activos y programados.
- **Editar** rescates en estado scheduled.

---

### 5.5 Incidencias Sociales (`/incidents`)

Los productores pueden **reportar incidencias sociales** que afecten la cadena de distribución o el territorio.

**Pueden reportar:**
- Problemas de vía / acceso
- Daño en producto durante transporte
- Condiciones climáticas adversas
- Accidentes
- Robo/hurto de producto

**Proceso:**
1. Panel lateral izquierdo: completar tipo, severidad, descripción y ubicación.
2. Hacer clic en **"Reportar incidencia"**.
3. La incidencia queda en estado `open` y visible para el administrador.

---

### 5.6 Subastas (`/auctions`)

**Como productor puede:**
- **Publicar subasta** (el sistema auto-selecciona su perfil de productor).
- Elegir tipo: **Ascendente** (precio sube con pujas) o **Holandesa** (precio baja por pasos hasta que alguien acepta).
- Ver subastas activas de toda la red.
- **No puede pujar** en sus propias subastas (validación en backend).

---

## 6. Rol: Operador Logístico

**Emails de prueba:** `operador@agrored.co`, `operador@sanroque.agrored.co`
**Contraseña:** `Oper@1234!`

Responsable de las operaciones de distribución, rutas y seguimiento de flota.

---

### 6.1 Tablero Institucional (`/`)

KPIs operativos filtrados para su municipio.

---

### 6.2 Productores (`/producers`)

Vista de lectura del catálogo de productores para planificar recogidas.

---

### 6.3 Ofertas (`/offers`)

Ver la oferta disponible para planificar la logística de distribución.

---

### 6.4 Rescates (`/rescues`)

Coordinar y ejecutar operaciones de rescate alimentario.

---

### 6.5 Demandas (`/demands`)

Ver demandas abiertas de instituciones para priorizar entregas.

---

### 6.6 Inventario (`/inventory`)

**Funciones disponibles:**
- Ver el inventario disponible en las bodegas.
- **Registrar ítem**: ingresar productos al inventario tras una recogida o rescate.
- **Editar** ítems existentes (cantidades, estado, vencimiento).
- Identificar ítems próximos a vencer.

---

### 6.7 Flota en Tiempo Real (`/fleet`)

Seguimiento GPS en tiempo real del propio recurso (vehículo / moto / bicicleta) y de la flota completa.

---

### 6.8 Geocercas Logísticas (`/logistics`)

**Funciones disponibles:**
- Ver zonas logísticas definidas en el mapa.
- **Crear geocercas**: marcar nuevos puntos de entrega, bodegas o zonas restringidas.
- **Editar** geocercas existentes.
- Ver tabla de **órdenes logísticas** asignadas: origen, destino, cantidad, fechas y estado.

---

### 6.9 Incidencias Sociales (`/incidents`)

- **Reportar incidencias** durante las rutas (accidentes, daños, bloqueos).
- Actualizar el estado de incidencias asignadas.

---

### 6.10 Notificaciones (`/notifications`)

- Ver notificaciones operativas del sistema.
- **Crear notificaciones** para avisar a instituciones de entregas programadas o cambios de ruta.

---

### 6.11 Subastas (`/auctions`)

- Ver subastas activas de alimentos.
- **Pujar** en subastas en nombre de la operación logística.

---

## 7. Rol: Analista Territorial

**Emails de prueba:** `analista@agrored.co`, `analista@rionegro.agrored.co`
**Contraseña:** `Ana@1234!`

Perfil de consulta y análisis. **No crea ni modifica registros operativos** — su función es observar, analizar y producir inteligencia territorial.

---

### 7.1 Tablero Institucional (`/`)

Acceso completo al tablero con KPIs, gráfico territorial y totales del sistema.

---

### 7.2 Mapa Territorial (`/territorial`)

Vista principal de trabajo del analista.

**Funciones:**
- Explorar la distribución geográfica de productores e instituciones.
- Buscar actores específicos por nombre.
- Activar/desactivar capas (productores / comedores).
- Ver panel de detalle con estadísticas al seleccionar un punto.

---

### 7.3 Productores, Ofertas, Rescates, Demandas, Instituciones

**Solo lectura**. El analista puede consultar todos estos módulos para construir su análisis territorial sin poder modificar datos.

---

### 7.4 Geocercas Logísticas / Flota (`/logistics`, `/fleet`)

Consulta de la operación logística en curso para análisis de eficiencia.

---

### 7.5 Incidencias Sociales (`/incidents`)

Monitoreo de incidencias abiertas para análisis de riesgo territorial y elaboración de informes.

---

### 7.6 Subastas (`/auctions`)

Consulta de subastas activas para análisis de precios y tendencias de mercado.

---

### 7.7 Alertas IRAT (`/alerts`)

**Módulo clave del analista.** Consulta de alertas institucionales automáticas:
- Ver alertas por severidad y tipo.
- Reconocer alertas revisadas.
- Analizar indicadores: cobertura, presupuesto ejecutado, tiempo de entrega.

---

### 7.8 Apoyo a Decisión — ML (`/ml`)

Consulta de sugerencias del motor heurístico:
- Ver recomendaciones por prioridad.
- Analizar la confianza del modelo.
- Filtrar por tipo de prioridad (crítico / alto / medio / bajo).

---

## 8. Rol: Cocina Comunitaria

**Emails de prueba:** `cocina@agrored.co`, `cocina@santarosa.agrored.co`
**Contraseña:** `Cocina@1234!`

Representa comedores comunitarios, jardines infantiles, programas de alimentación escolar y otros programas que **demandan y reciben** alimentos.

---

### 8.1 Tablero Institucional (`/`)

KPIs básicos del ecosistema filtrados por su municipio.

---

### 8.2 Ofertas (`/offers`)

Ver el catálogo completo de productos disponibles para solicitar a los productores o programar demandas.

---

### 8.3 Rescates (`/rescues`)

Ver rescates programados hacia su organización. No puede crear rescates directamente — los rescates son gestionados por productores u operadores.

---

### 8.4 Demandas (`/demands`)

**Módulo principal de la cocina comunitaria.**

**Funciones disponibles:**
- **Publicar demanda**: nombre de la organización, producto requerido, categoría, unidad, cantidad, fecha límite de necesidad, número de beneficiarios, municipio, coordenadas, canal (community_kitchen / comedor popular / banco de alimentos / etc.), institución asociada.
- **Ver demandas abiertas** del sistema.
- **Editar** sus propias demandas (cambiar cantidad, fecha o estado).
- **Filtros**: por estado, canal y búsqueda por texto.

> Las demandas abiertas son visibles para operadores logísticos y administradores para coordinar el abastecimiento.

---

### 8.5 Subastas (`/auctions`)

**Funciones disponibles:**
- Ver subastas activas de productos alimentarios.
- **Pujar** en subastas para adquirir alimentos a precio competitivo.
- Ver historial de subastas participadas.

---

## 9. Rol: Supermercado / Establecimiento Aliado

**Descripción:** Establecimientos comerciales que se integran a AgroRed para vender productos a precios económicos. Son gestionados como "Orígenes" por el administrador.

**Acceso al sistema:** Limitado a consulta de mercado.

---

### 9.1 Tablero Institucional (`/`)

Vista básica del tablero.

---

### 9.2 Ofertas (`/offers`)

Ver la oferta disponible de los productores de la red. Permite identificar productos a precios de origen para negociaciones directas.

---

### 9.3 Subastas (`/auctions`)

- Ver subastas activas.
- **Pujar** para adquirir lotes de alimentos directamente de los productores.

> Este rol es el de menor acceso en el sistema. Si el establecimiento necesita más funcionalidades, el administrador puede cambiar su rol a otro perfil.

---

## 10. Módulos del Sistema — Referencia Rápida

### Módulo: Tablero (`/`)
- **Origen de datos:** `GET /api/v1/analytics/summary` + `GET /api/v1/analytics/territorial-overview` + `GET /api/v1/analytics/map/resources`
- **Actualización:** cada 30 segundos automáticamente
- **Admin:** vista global · Otros roles: vista filtrada por tenant

### Módulo: Productores (`/producers`)
- **API:** `GET /api/v1/producers` · `POST /api/v1/producers/register` · `PATCH /api/v1/producers/:id`
- **Mapa:** `GET /api/v1/analytics/map/producers?minLng=&minLat=&maxLng=&maxLat=` (carga dinámica por bbox)

### Módulo: Ofertas (`/offers`)
- **API:** `GET /api/v1/offers` · `POST /api/v1/offers` · `PUT /api/v1/offers/:id`

### Módulo: Rescates (`/rescues`)
- **API:** `GET /api/v1/rescues` · `POST /api/v1/rescues` · `PUT /api/v1/rescues/:id`

### Módulo: Demandas (`/demands`)
- **API:** `GET /api/v1/demands` · `POST /api/v1/demands` · `PUT /api/v1/demands/:id`

### Módulo: Instituciones (`/institutions`)
- **API:** `GET /api/v1/institutions` · `POST /api/v1/institutions` · `PUT /api/v1/institutions/:id` · `PATCH /api/v1/institutions/:id/status`

### Módulo: Orígenes Aliados (`/origins`)
- **API:** `GET /api/v1/analytics/origins` · `POST /api/v1/analytics/origins` · `PUT /api/v1/analytics/origins/:id` · `DELETE /api/v1/analytics/origins/:id`
- **Acceso:** solo `admin_municipal`

### Módulo: Inventario (`/inventory`)
- **API:** `GET /api/v1/inventory` · `POST /api/v1/inventory/register` · `PUT /api/v1/inventory/:id`

### Módulo: Logística y Geocercas (`/logistics`)
- **API Geocercas:** `GET /api/v1/logistics/geofences` · `POST /api/v1/logistics/geofences` · `PUT /api/v1/logistics/geofences/:id`
- **API Órdenes:** `GET /api/v1/logistics` · `POST /api/v1/logistics/register`

### Módulo: Flota (`/fleet`)
- **API:** `GET /api/v1/analytics/map/resources` (posiciones de `tracking_actual`)

### Módulo: Incidencias (`/incidents`)
- **API:** `GET /api/v1/incidents` · `POST /api/v1/incidents`
- **Roles que pueden reportar:** `admin_municipal`, `producer`, `logistics_operator`, `territorial_analyst`

### Módulo: Notificaciones (`/notifications`)
- **API:** `GET /api/v1/notifications` · `POST /api/v1/notifications/register` · `PUT /api/v1/notifications/:id`
- **Canales:** email, sms, whatsapp, in_app

### Módulo: Subastas (`/auctions`)
- **API Publicar:** `POST /api/v1/auctions/publish`
- **API Pujar:** `POST /api/v1/auctions/:id/bid`
- **API Aceptar holandesa:** `POST /api/v1/auctions/:id/accept-dutch`
- **Tipos:** ascending (precio sube) · dutch (precio baja)

### Módulo: Mapa Territorial (`/territorial`)
- **API:** `GET /api/v1/analytics/map/producers` · `GET /api/v1/analytics/map/demands`

### Módulo: Alertas IRAT (`/alerts`)
- **API:** endpoints del analytics-service para alertas institucionales

### Módulo: Apoyo a Decisión ML (`/ml`)
- **API:** `GET /api/v1/ml/suggestions` (alias de `/recommendations`)
- **Motor:** heurístico basado en reglas sobre datos operativos reales

### Módulo: Copiloto IA (`/ai-copilot`)
- **API:** `POST /api/v1/ai/chat`
- **Acceso:** solo `admin_municipal`

---

## 11. Credenciales de Prueba

### Bogotá D.C. (Tenant principal)

| Email | Rol | Contraseña |
|-------|-----|------------|
| `admin@agrored.co` | Administrador Municipal | `Admin@1234!` |
| `productor@agrored.co` | Productor | `Prod@1234!` |
| `operador@agrored.co` | Operador Logístico | `Oper@1234!` |
| `analista@agrored.co` | Analista Territorial | `Ana@1234!` |
| `cocina@agrored.co` | Cocina Comunitaria | `Cocina@1234!` |

### Rionegro (Antioquia)

| Email | Rol | Contraseña |
|-------|-----|------------|
| `admin@rionegro.agrored.co` | Administrador Municipal | `Admin@1234!` |
| `productor@rionegro.agrored.co` | Productor | `Prod@1234!` |
| `analista@rionegro.agrored.co` | Analista Territorial | `Ana@1234!` |

### Santa Rosa de Osos (Antioquia)

| Email | Rol | Contraseña |
|-------|-----|------------|
| `admin@santarosa.agrored.co` | Administrador Municipal | `Admin@1234!` |
| `productor@santarosa.agrored.co` | Productor | `Prod@1234!` |
| `cocina@santarosa.agrored.co` | Cocina Comunitaria | `Cocina@1234!` |

### San Roque (Antioquia)

| Email | Rol | Contraseña |
|-------|-----|------------|
| `admin@sanroque.agrored.co` | Administrador Municipal | `Admin@1234!` |
| `productor@sanroque.agrored.co` | Productor | `Prod@1234!` |
| `operador@sanroque.agrored.co` | Operador Logístico | `Oper@1234!` |

---

*Documento generado automáticamente desde el código fuente de AgroRed · Mayo 2026*
