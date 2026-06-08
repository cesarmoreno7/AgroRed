# Manual de Usuario — Plataforma AgroRed

**Versión:** 1.0  
**Fecha:** Junio 2026  
**Audiencia:** Usuarios finales de la plataforma

---

## Tabla de Contenidos

1. [¿Qué es AgroRed?](#1-qué-es-agrored)
2. [Roles de usuario](#2-roles-de-usuario)
3. [Acceso a la plataforma](#3-acceso-a-la-plataforma)
4. [Panel de Control (Dashboard)](#4-panel-de-control-dashboard)
5. [Módulo: Productores](#5-módulo-productores)
6. [Módulo: Ofertas](#6-módulo-ofertas)
7. [Módulo: Subastas (Mercado Spot)](#7-módulo-subastas-mercado-spot)
8. [Módulo: Demandas Alimentarias](#8-módulo-demandas-alimentarias)
9. [Módulo: Rescate de Alimentos](#9-módulo-rescate-de-alimentos)
10. [Módulo: Inventario](#10-módulo-inventario)
11. [Módulo: Logística y Geocercas](#11-módulo-logística-y-geocercas)
12. [Módulo: Incidencias Sociales](#12-módulo-incidencias-sociales)
13. [Módulo: Instituciones](#13-módulo-instituciones)
14. [Módulo: Vista Territorial](#14-módulo-vista-territorial)
15. [Módulo: Flota en Tiempo Real](#15-módulo-flota-en-tiempo-real)
16. [Módulo: Notificaciones](#16-módulo-notificaciones)
17. [Módulo: Análisis y Alertas](#17-módulo-análisis-y-alertas)
18. [Módulo: Gestión de Usuarios](#18-módulo-gestión-de-usuarios)
19. [Módulo: Tablas Maestras Territoriales](#19-módulo-tablas-maestras-territoriales)
20. [Índice de Riesgo Alimentario Territorial (IRAT)](#20-índice-de-riesgo-alimentario-territorial-irat)
21. [Preguntas frecuentes](#21-preguntas-frecuentes)

---

## 1. ¿Qué es AgroRed?

**AgroRed** es una plataforma digital de gobernanza alimentaria diseñada para municipios y territorios de Colombia. Conecta productores rurales, instituciones públicas, operadores logísticos y gestores territoriales en un ecosistema único que permite:

- Comprar y vender alimentos mediante **subastas en tiempo real** (mercado spot).
- Registrar y atender **demandas alimentarias** de comedores comunitarios, colegios, hospitales y programas sociales.
- Organizar operaciones de **rescate de alimentos** para evitar desperdicios.
- Gestionar el **inventario** de alimentos disponibles en bodegas y centros de acopio.
- Monitorear el **transporte y la logística** de los recursos alimentarios.
- Detectar y responder a **incidencias de inseguridad alimentaria** en el territorio.
- Medir el **Índice de Riesgo Alimentario Territorial (IRAT)** para orientar decisiones de política pública.

La plataforma está organizada en **módulos** que se habilitan según el **rol** del usuario. Esto garantiza que cada persona vea únicamente las funciones que necesita para su trabajo.

---

## 2. Roles de usuario

AgroRed define cinco roles principales. Cada rol tiene acceso a módulos específicos y puede realizar acciones determinadas dentro de ellos.

### 2.1 Productor (`producer`)

**¿Quién es?** Agricultor individual, asociación de productores o cooperativa rural que ofrece productos alimentarios al mercado.

**¿Qué puede hacer en AgroRed?**
- Registrar su perfil como productor.
- Publicar **ofertas** de producción disponible.
- Crear y gestionar **subastas** de sus productos.
- Programar y registrar operaciones de **rescate** de excedentes.

**Módulos disponibles:**

| Módulo | Acceso |
|---|---|
| Panel de Control | Ver resumen de actividad |
| Productores | Gestionar su propio perfil |
| Ofertas | Publicar ofertas de producción |
| Subastas | Crear y monitorear subastas |
| Rescate de Alimentos | Programar rescates de excedentes |

---

### 2.2 Operador Logístico (`logistics_operator`)

**¿Quién es?** Persona u organización encargada de coordinar la compra, transporte, distribución e inventario de alimentos.

**¿Qué puede hacer en AgroRed?**
- Pujar en **subastas** de productores.
- Gestionar **demandas** alimentarias y emparejarlas con oferta disponible.
- Administrar el **inventario** de alimentos.
- Crear y supervisar **órdenes logísticas** de transporte.
- Enviar **notificaciones** a los actores del sistema.

**Módulos disponibles:**

| Módulo | Acceso |
|---|---|
| Panel de Control | Ver resumen de actividad |
| Subastas | Pujar y aceptar precios |
| Demandas | Registrar y gestionar demandas |
| Inventario | Administrar stock alimentario |
| Logística | Crear y supervisar órdenes de transporte |
| Ofertas | Consultar ofertas disponibles |
| Notificaciones | Enviar y gestionar comunicaciones |

---

### 2.3 Administrador Municipal (`admin_municipal` / `municipality`)

**¿Quién es?** Funcionario de una alcaldía, secretaría o entidad pública municipal responsable de la política alimentaria local.

**¿Qué puede hacer en AgroRed?**
- Pujar en **subastas** para abastecerse de alimentos.
- Registrar **demandas** de instituciones bajo su responsabilidad.
- Gestionar el **inventario** municipal.
- Supervisar la **logística** de distribución en su territorio.
- Registrar y atender **incidencias** de inseguridad alimentaria.
- Administrar el catálogo de **instituciones** receptoras.
- Consultar la **vista territorial** del municipio.
- Monitorear la **flota** de recursos en tránsito.

**Módulos disponibles:**

| Módulo | Acceso |
|---|---|
| Panel de Control | Ver resumen de actividad |
| Subastas | Pujar y aceptar precios; ver reportes |
| Demandas | Gestionar demandas municipales |
| Inventario | Administrar stock |
| Logística | Supervisar transporte |
| Ofertas | Consultar mercado de alimentos |
| Incidencias | Reportar y gestionar incidencias |
| Instituciones | Administrar comedores, escuelas, hospitales, etc. |
| Vista Territorial | Mapa de productores y demandas |
| Flota | Monitorear recursos en tránsito |
| Rescate | Programar rescates alimentarios |

---

### 2.4 Analista Territorial (`territorial_analyst` / `territorial_manager`)

**¿Quién es?** Profesional encargado del análisis de datos, monitoreo del riesgo alimentario y coordinación inter-institucional en el territorio.

**¿Qué puede hacer en AgroRed?**
- Consultar subastas y ver reportes de mercado.
- Monitorear **incidencias** de seguridad alimentaria.
- Gestionar la **logística** territorial.
- Ver la **vista territorial** con mapas interactivos.
- Monitorear la **flota** de recursos.
- Analizar **alertas y KPIs** territoriales.

**Módulos disponibles:**

| Módulo | Acceso |
|---|---|
| Panel de Control | Ver indicadores estratégicos |
| Subastas | Consultar y ver reportes |
| Incidencias | Monitorear y gestionar riesgos |
| Logística | Supervisar transporte territorial |
| Vista Territorial | Mapa de actividad alimentaria |
| Flota | Monitorear recursos en tránsito |
| Análisis y Alertas | Revisar KPIs y alertas |

---

### 2.5 Administrador del Sistema (`admin`)

**¿Quién es?** Administrador técnico y operativo de la plataforma AgroRed con acceso completo a todos los módulos.

**¿Qué puede hacer en AgroRed?**
- Acceder a **todos los módulos** del sistema.
- Gestionar **usuarios** y asignar roles.
- Auditar el sistema y las subastas.
- Administrar tablas maestras territoriales.
- Acceder a funciones de inteligencia artificial y análisis avanzado.

**Módulos disponibles:** Todos los módulos sin restricción.

---

### Resumen de acceso por módulo

| Módulo | Productor | Operador | Admin Municipal | Analista Territorial | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Panel de Control | ✓ | ✓ | ✓ | ✓ | ✓ |
| Productores | ✓ | — | — | — | ✓ |
| Ofertas | ✓ | ✓ | ✓ | — | ✓ |
| Subastas | ✓ | ✓ | ✓ | ✓ | ✓ |
| Demandas | — | ✓ | ✓ | — | ✓ |
| Rescate de Alimentos | ✓ | — | ✓ | — | ✓ |
| Inventario | — | ✓ | ✓ | — | ✓ |
| Logística | — | ✓ | ✓ | ✓ | ✓ |
| Incidencias | — | — | ✓ | ✓ | ✓ |
| Instituciones | — | — | ✓ | — | ✓ |
| Vista Territorial | — | — | ✓ | ✓ | ✓ |
| Flota en Tiempo Real | — | — | ✓ | ✓ | ✓ |
| Notificaciones | — | ✓ | — | — | ✓ |
| Análisis y Alertas | — | — | — | ✓ | ✓ |
| Gestión de Usuarios | — | — | — | — | ✓ |
| Tablas Maestras | — | — | — | — | ✓ |

---

## 3. Acceso a la plataforma

### 3.1 Iniciar sesión

1. Ingrese a la URL de AgroRed proporcionada por su municipio o por el administrador del sistema.
2. En la pantalla de inicio de sesión, ingrese su **correo electrónico** y **contraseña**.
3. Haga clic en **Iniciar sesión**.
4. Si sus credenciales son correctas, será redirigido al **Panel de Control**.

> **Nota:** Si olvidó su contraseña o no tiene cuenta, comuníquese con el administrador del sistema de su municipio.

### 3.2 Requisitos de contraseña

Para garantizar la seguridad de su cuenta, la contraseña debe cumplir las siguientes condiciones:

- Mínimo **8 caracteres**
- Al menos **1 letra mayúscula**
- Al menos **1 número**
- Al menos **1 carácter especial** (por ejemplo: `@`, `#`, `$`, `!`)

### 3.3 Navegación principal

Una vez dentro del sistema, encontrará un menú lateral izquierdo con los módulos habilitados para su rol. El menú puede incluir:

- Panel de Control
- Productores
- Ofertas
- Subastas
- Demandas
- Rescate
- Inventario
- Logística
- Incidencias
- Instituciones
- Vista Territorial
- Flota
- Notificaciones
- Análisis y Alertas
- Usuarios *(solo Administrador)*

Solo verá en el menú los módulos a los que su rol tiene acceso.

---

## 4. Panel de Control (Dashboard)

**Roles con acceso:** Todos los usuarios autenticados.

El Panel de Control es la página principal de AgroRed. Ofrece una vista resumida de la actividad alimentaria de su municipio o territorio.

### Indicadores principales

| Indicador | Descripción |
|---|---|
| **IRAT** | Índice de Riesgo Alimentario Territorial (0 a 100). Indica el nivel de riesgo de inseguridad alimentaria en el territorio. |
| **Cobertura de programas** | Porcentaje de beneficiarios atendidos sobre el total registrado. |
| **Productores activos** | Número de productores con estado "activo" en el sistema. |
| **Ofertas vigentes** | Total de ofertas de alimentos publicadas y disponibles. |
| **Demandas abiertas** | Solicitudes de alimentos aún sin atender. |
| **Rescates programados** | Operaciones de rescate alimentario pendientes. |
| **Inventario disponible** | Unidades de alimentos en bodega disponibles para asignación. |
| **Incidentes activos** | Incidencias de inseguridad alimentaria reportadas y en seguimiento. |
| **Subastas activas** | Subastas en curso en el mercado spot. |

### Semáforo del IRAT

El tablero muestra el IRAT con un indicador visual de color:

| Rango | Color | Significado |
|---|---|---|
| 0 – 40 | 🟢 Verde | Riesgo bajo — Monitoreo regular |
| 40 – 60 | 🟡 Amarillo | Riesgo medio — Atención preventiva |
| 60 – 80 | 🟠 Naranja | Riesgo alto — Intervención requerida |
| 80 – 100 | 🔴 Rojo | Riesgo crítico — Acción inmediata |

Los datos del panel se actualizan automáticamente cada 30 segundos.

---

## 5. Módulo: Productores

**Roles con acceso:** Productor, Administrador.

Este módulo permite registrar y administrar el perfil de los productores rurales que participan en la plataforma.

### 5.1 ¿Qué es un productor en AgroRed?

Un productor puede ser:
- **Individual:** Agricultor o campesino que trabaja de forma independiente.
- **Asociación:** Grupo de productores organizados formalmente.
- **Cooperativa:** Empresa solidaria de producción agropecuaria.

### 5.2 Cómo registrar un productor

1. En el módulo **Productores**, haga clic en **+ Registrar productor**.
2. Complete los campos del formulario:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Tipo de productor | Individual, Asociación o Cooperativa | Sí |
| Nombre / Organización | Nombre del productor o razón social | Sí |
| Nombre de contacto | Persona de contacto | Sí |
| Teléfono de contacto | Número de celular o fijo | Sí |
| Departamento | Departamento donde opera | Sí |
| Municipio | Municipio de ubicación | Sí |
| Tipo de zona | Rural o Urbana | No |
| Categorías de productos | Tipos de alimentos que produce (ej: frutas, tubérculos) | Sí |
| Latitud / Longitud | Coordenadas GPS del predio | No |
| ID de usuario | Vincular con un usuario existente en el sistema | No |

3. Haga clic en **Guardar**.

### 5.3 Estados del productor

| Estado | Significado |
|---|---|
| ⏳ Pendiente de verificación | El productor fue registrado pero aún no ha sido validado por un administrador |
| ✓ Activo | El productor está verificado y puede participar en ofertas y subastas |
| ✗ Inactivo | El productor está suspendido temporalmente |

> Un productor debe estar en estado **Activo** para poder publicar ofertas y subastas.

### 5.4 Mapa de productores

Si el productor tiene coordenadas GPS registradas, el botón **📍 Ver en mapa** estará disponible en su fila. Al hacer clic, se abrirá la Vista Territorial centrada en ese productor.

### 5.5 Editar información

Haga clic en **✏️ Editar** junto al productor que desea modificar. Actualice los campos necesarios y guarde los cambios.

---

## 6. Módulo: Ofertas

**Roles con acceso:** Productor, Operador Logístico, Administrador Municipal, Administrador.

Este módulo permite a los productores publicar su producción disponible y a los compradores consultarla antes de hacer una demanda o pujar en subasta.

### 6.1 ¿Qué es una oferta?

Una oferta es un anuncio de disponibilidad de un producto agrícola: indica qué hay, en qué cantidad, a qué precio y durante qué período. Es la vitrina de la producción de un agricultor.

### 6.2 Cómo publicar una oferta

1. En el módulo **Ofertas**, haga clic en **+ Nueva oferta**.
2. Complete el formulario:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Productor | Seleccione el productor que ofrece el producto | Sí |
| Departamento | Departamento de origen del producto | Sí |
| Municipio | Municipio de origen | Sí |
| Título de la oferta | Descripción breve de la oferta | Sí |
| Producto | Nombre del alimento ofertado | Sí |
| Categoría | Tipo de producto (tubérculo, hortaliza, fruta, etc.) | Sí |
| Unidad | Unidad de medida (kg, libra, tonelada, und, litro, arroba, bulto) | Sí |
| Cantidad disponible | Volumen total disponible | Sí |
| Precio | Precio por unidad | Sí |
| Moneda | COP o USD | No |
| Disponible desde | Fecha de inicio de disponibilidad | Sí |
| Disponible hasta | Fecha de fin de disponibilidad | No |
| Estado | Borrador, Publicada o Cerrada | No |
| Notas | Observaciones adicionales | No |

3. Haga clic en **Guardar**.

### 6.3 Estados de una oferta

| Estado | Descripción |
|---|---|
| **Borrador** | La oferta está creada pero no visible para compradores |
| **Publicada** | La oferta está activa y visible en el mercado |
| **Cerrada** | La oferta ya no está disponible (vendida o expirada) |

### 6.4 Buscar y filtrar ofertas

Puede buscar ofertas usando los filtros disponibles:
- Título del producto
- Nombre del producto
- Nombre del productor
- Municipio de origen
- Categoría de producto

---

## 7. Módulo: Subastas (Mercado Spot)

**Roles con acceso:** Productor (publicar), Operador / Admin Municipal / Analista (pujar y ver), Administrador.

Las subastas son el corazón del mercado spot de AgroRed. Permiten vender y comprar alimentos en tiempo real mediante un mecanismo transparente y competitivo.

### 7.1 Tipos de subasta

#### Subasta Ascendente (Precio sube)

El precio comienza desde un **precio base** y sube con cada puja. Gana quien ofrezca más al cierre de la subasta. Este modelo es ideal cuando hay varios compradores interesados y el productor quiere maximizar el precio.

#### Subasta Holandesa (Precio baja)

El precio comienza alto y **baja automáticamente** en pasos regulares hasta que un comprador lo acepta. Este modelo es ideal cuando el producto es perecedero y se requiere rapidez en la venta. El primero en aceptar el precio gana.

### 7.2 Cómo publicar una subasta (Productor)

1. En el módulo **Subastas**, haga clic en **🔨 Publicar subasta**.
2. Complete el formulario:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Productor | Seleccione su perfil de productor | Sí |
| Producto | Nombre del alimento | Sí |
| Categoría | Tipo de producto | Sí |
| Unidad | Unidad de medida | Sí |
| Cantidad | Volumen disponible para subastar | Sí |
| Fecha de cosecha | Fecha en que fue recolectado el producto (no puede ser futura) | Sí |
| Tipo de subasta | Ascendente o Holandesa | Sí |
| Precio base | Precio inicial por unidad (en COP) | Sí |
| Precio de reserva | Mínimo precio al que está dispuesto a vender | No |
| Duración | Tiempo de la subasta: 2h, 4h, 6h, 8h, 12h o 24h | Sí |
| Departamento / Municipio | Ubicación del producto | Sí |
| Latitud / Longitud | Coordenadas GPS | Sí |

**Parámetros adicionales para subasta holandesa:**

| Campo | Descripción | Obligatorio |
|---|---|---|
| % de bajada por paso | Porcentaje en que baja el precio en cada paso (1% – 50%) | Sí |
| Minutos entre pasos | Cada cuántos minutos baja el precio (1 – 60 minutos) | Sí |

3. Haga clic en **Publicar**.

### 7.3 Cómo pujar en una subasta (Operador / Admin Municipal)

1. Encuentre la subasta de su interés en la lista.
2. Haga clic en **💰 Pujar** (disponible solo si la subasta está activa).
3. Ingrese el monto de su puja (debe ser mayor al precio actual).
4. Confirme la puja.

> En una **subasta holandesa**, en lugar de pujar puede hacer clic en **Aceptar precio actual** para comprar inmediatamente al precio vigente.

### 7.4 Estados de una subasta

| Estado | Descripción |
|---|---|
| **Activa** | La subasta está en curso y acepta pujas |
| **Extendida** | Se recibió una puja en los últimos 5 minutos y el tiempo se extendió automáticamente |
| **Cerrada con ganador** | La subasta terminó y hay un comprador ganador |
| **Cerrada sin ganador** | La subasta terminó sin pujas que superen el precio de reserva |
| **Cancelada** | El productor o el administrador canceló la subasta |

### 7.5 Alerta de urgencia (⚡)

Si el producto fue cosechado hace poco tiempo y tiene menos de **6 horas de vida útil** estimada, la subasta aparece marcada con el símbolo ⚡ como **urgente**. Esto indica que el producto debe venderse y transportarse rápidamente para evitar pérdidas.

### 7.6 Extensión automática

Si se realiza una puja en los últimos **5 minutos** antes del cierre, la subasta se extiende automáticamente por 5 minutos adicionales. Esto ocurre hasta un máximo de **5 veces**, garantizando que todos los compradores tengan oportunidad de competir.

---

## 8. Módulo: Demandas Alimentarias

**Roles con acceso:** Operador Logístico, Administrador Municipal, Administrador.

Este módulo permite registrar las necesidades de alimentos de instituciones y programas sociales, para que puedan ser atendidas mediante el inventario disponible o el mercado spot.

### 8.1 ¿Qué es una demanda?

Una demanda es una solicitud formal de alimentos por parte de una organización (comedor comunitario, colegio, hospital, programa social, etc.) que especifica qué producto necesita, en qué cantidad, para cuándo y para cuántos beneficiarios.

### 8.2 Canales de demanda

| Canal | Descripción | Color |
|---|---|---|
| **Comedor comunitario** | Solicitudes de comedores vecinales y fundaciones | Naranja |
| **Programa escolar** | PAE y programas de alimentación en colegios | Azul |
| **Programa social** | ICBF, adultos mayores, población vulnerable | Púrpura |
| **Emergencia** | Respuesta urgente a crisis o desastres | Rojo |

### 8.3 Cómo registrar una demanda

1. En el módulo **Demandas**, haga clic en **+ Nueva demanda**.
2. Complete el formulario:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Institución | Seleccione la institución solicitante (auto-completa municipio y beneficiarios) | No |
| Canal de demanda | Tipo de programa que solicita | Sí |
| Organización | Nombre de la organización si no usa institución registrada | Sí |
| Producto | Alimento solicitado | Sí |
| Categoría | Tipo de producto | Sí |
| Unidad | Unidad de medida | Sí |
| Cantidad requerida | Volumen solicitado | Sí |
| Necesario antes de | Fecha límite para recibir el alimento | Sí |
| Número de beneficiarios | Personas que serán atendidas | Sí |
| Departamento / Municipio | Municipio de entrega | Sí |
| Notas | Observaciones adicionales | No |

3. Haga clic en **Guardar**.

### 8.4 Estados de una demanda

| Estado | Descripción |
|---|---|
| **Abierta** | La demanda fue registrada y está pendiente de atención |
| **Emparejada** | El sistema encontró oferta o inventario compatible y lo asignó automáticamente |
| **Atendida** | La demanda fue completamente satisfecha |
| **Cancelada** | La demanda fue cancelada por la organización o el operador |

### 8.5 Emparejamiento automático

El sistema revisa periódicamente las demandas abiertas y las compara con las ofertas e inventario disponibles, considerando:
- **Proximidad geográfica** (municipio y coordenadas)
- **Disponibilidad temporal** (la oferta debe estar disponible antes de la fecha límite)
- **Cantidad compatible**
- **Categoría del producto**

Cuando encuentra una coincidencia, la demanda pasa automáticamente al estado **Emparejada**.

---

## 9. Módulo: Rescate de Alimentos

**Roles con acceso:** Productor, Administrador Municipal, Administrador.

Este módulo gestiona la recuperación de excedentes alimentarios que de otro modo se desperdiciarían, redistribuyéndolos a quienes más los necesitan.

### 9.1 ¿Qué es un rescate alimentario?

Un rescate es una operación planificada para recoger alimentos en buen estado que no serán comercializados (excedentes de mercados, producciones no vendidas, donaciones) y llevarlos a organizaciones receptoras como comedores, bancos de alimentos o programas sociales.

### 9.2 Canales de rescate

| Canal | Descripción | Color |
|---|---|---|
| **Banco de alimentos** | Recolección para banco de alimentos municipio/regional | Púrpura |
| **Comedor comunitario** | Distribución directa a comedores | Naranja |
| **Programa social** | Entrega a programas del ICBF u otras entidades | Azul |
| **Recuperación de mercado** | Rescate en plazas de mercado y centros de acopio | Verde |

### 9.3 Cómo registrar un rescate

1. En el módulo **Rescate**, haga clic en **+ Nuevo rescate**.
2. Complete el formulario:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Origen | Punto donde se recogerán los alimentos | Sí |
| Canal de rescate | Tipo de rescate | Sí |
| Destino (organización) | Nombre de la entidad que recibirá los alimentos | No |
| Producto | Alimento a rescatar | Sí |
| Categoría | Tipo de producto | Sí |
| Unidad | Unidad de medida | Sí |
| Cantidad | Volumen estimado a rescatar | Sí |
| Programado para | Fecha y hora de la operación | Sí |
| Número de beneficiarios | Personas que serán atendidas | Sí |
| Municipio | Municipio donde ocurre el rescate | Sí |
| Notas | Observaciones adicionales | No |

3. Haga clic en **Guardar**.

### 9.4 Estados de un rescate

| Estado | Descripción |
|---|---|
| **Programado** | El rescate está agendado y pendiente de ejecución |
| **En progreso** | El operario está recogiendo los alimentos |
| **Completado** | Los alimentos fueron entregados en destino |
| **Cancelado** | La operación no pudo realizarse |

### 9.5 Gestión de orígenes (puntos de acopio)

El panel de **Orígenes** dentro del módulo de Rescate permite registrar los puntos donde habitualmente se generan excedentes:

1. Haga clic en **+ Agregar origen**.
2. Complete:
   - **Nombre del origen:** Por ejemplo, "Plaza de mercado El Potrero"
   - **Departamento / Municipio**
   - **Dirección**
   - **Coordenadas GPS** (latitud y longitud)
3. Guarde el origen.

Los orígenes registrados quedan disponibles para seleccionar al crear nuevos rescates.

---

## 10. Módulo: Inventario

**Roles con acceso:** Operador Logístico, Administrador Municipal, Administrador.

Este módulo gestiona el stock de alimentos disponibles en bodegas, centros de acopio y puntos de distribución del territorio.

### 10.1 ¿Qué es el inventario en AgroRed?

El inventario registra los alimentos que ya fueron adquiridos (por compra, rescate o donación) y están físicamente disponibles para ser distribuidos. Funciona como el almacén digital del programa alimentario.

### 10.2 Tipos de stock

| Tipo | Descripción | Color |
|---|---|---|
| **Stock de oferta** | Alimentos comprados a productores mediante oferta o subasta | Azul |
| **Stock rescatado** | Alimentos recuperados mediante operaciones de rescate | Púrpura |
| **Stock buffer** | Reserva estratégica para emergencias | Naranja |

### 10.3 Cómo registrar un ítem de inventario

1. En el módulo **Inventario**, haga clic en **+ Nuevo ítem**.
2. Complete el formulario:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Productor | Productor de origen del alimento | Sí |
| Tipo de stock | Oferta, rescatado o buffer | Sí |
| Ubicación / Bodega | Nombre del lugar de almacenamiento | Sí |
| Producto | Alimento almacenado (puede seleccionar del catálogo) | Sí |
| Cantidad en mano | Unidades físicamente disponibles | Sí |
| Cantidad reservada | Unidades ya comprometidas para una entrega | No |
| Departamento / Municipio | Municipio de la bodega | Sí |
| Fecha de vencimiento | Fecha límite de consumo | No |
| Notas | Observaciones de almacenamiento | No |

3. Haga clic en **Guardar**.

### 10.4 Estados del inventario

| Estado | Descripción |
|---|---|
| **Disponible** | El ítem puede ser asignado a demandas o logística |
| **Reservado** | El ítem está comprometido pero aún no despachado |
| **Agotado** | El stock llegó a cero |
| **Vencido** | El producto superó su fecha de vencimiento |

### 10.5 Catálogo de productos

Al seleccionar un producto del catálogo integrado, el sistema completa automáticamente la **categoría** y la **unidad de medida**, reduciendo errores de digitación.

---

## 11. Módulo: Logística y Geocercas

**Roles con acceso:** Operador Logístico, Administrador Municipal, Analista Territorial, Administrador.

Este módulo permite organizar el transporte de alimentos desde el origen hasta el destino, y definir zonas geográficas (geocercas) para controlar el movimiento de recursos.

### 11.1 Gestión de Geocercas

Una **geocerca** es una zona geográfica virtual definida por un punto central y un radio en metros. Se usa para delimitar áreas de entrega, bodegas, zonas restringidas y zonas críticas.

#### Tipos de geocerca

| Tipo | Uso típico |
|---|---|
| **Entrega** | Punto donde se entregan los alimentos |
| **Restringida** | Zona donde no deben circular los recursos |
| **Bodega** | Ubicación de almacenamiento |
| **Crítica** | Zona de alta prioridad por riesgo alimentario |

#### Cómo registrar una geocerca

1. En el módulo **Logística**, vaya a la pestaña **Geocercas**.
2. Haga clic en **+ Nueva geocerca**.
3. Complete:
   - **Nombre de la zona**
   - **Tipo de zona**
   - **Latitud y longitud del centro**
   - **Radio en metros**
4. Guarde la geocerca.

### 11.2 Órdenes Logísticas

Una orden logística representa el movimiento físico de alimentos desde una bodega o punto de origen hasta un destino final (institución, comedor, beneficiario).

#### Cómo crear una orden logística

1. En el módulo **Logística**, vaya a la pestaña **Órdenes**.
2. Haga clic en **+ Nueva orden**.
3. Complete el formulario:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Ítem de inventario | Seleccione el stock a transportar | Sí |
| Modo de transporte | Carretera, aéreo o férreo | No |
| Origen | Bodega o ubicación de salida | No |
| Organización destino | Entidad que recibirá los alimentos | Sí |
| Dirección destino | Dirección de entrega | Sí |
| Pickup programado | Fecha y hora de recogida | Sí |
| Entrega programada | Fecha y hora estimada de entrega | Sí |
| Cantidad asignada | Unidades a transportar | Sí |
| Municipio | Municipio de destino | Sí |
| Notas | Observaciones de transporte | No |

4. Haga clic en **Guardar**.

#### Estados de una orden logística

| Estado | Descripción |
|---|---|
| **Programada** | La orden fue creada y está pendiente de ejecución |
| **En tránsito** | Los alimentos están siendo transportados |
| **Entregada** | Los alimentos llegaron al destino |
| **Fallida** | Hubo un problema que impidió la entrega |
| **Cancelada** | La orden fue cancelada |

---

## 12. Módulo: Incidencias Sociales

**Roles con acceso:** Administrador Municipal, Analista Territorial, Administrador.

Este módulo permite detectar, registrar y hacer seguimiento a situaciones de riesgo alimentario o social que requieren atención prioritaria.

### 12.1 Tipos de incidencia

| Tipo | Descripción |
|---|---|
| 🍽️ Inseguridad Alimentaria | Hogares sin acceso suficiente a alimentos nutritivos |
| ❤️‍🩹 Desnutrición Infantil | Niños con indicadores de desnutrición |
| ❤️‍🩹 Desnutrición en Adultos | Adultos mayores u otros grupos en riesgo nutricional |
| 🚧 Falta de Acceso a Alimentos | Barreras físicas, económicas o logísticas para acceder a alimentos |
| 📉 Falla en Programa Social | Un programa de alimentación dejó de funcionar correctamente |
| 🗑️ Riesgo de Desperdicio | Alimentos en riesgo de perderse por falta de distribución |
| 🚚 Problema Logístico | Falla en transporte que afecta la distribución de alimentos |
| 🆘 Emergencia Social | Crisis humanitaria que requiere respuesta inmediata |

### 12.2 Niveles de riesgo

| Nivel | Color | Acción recomendada |
|---|---|---|
| **Baja** | 🟢 Verde | Monitorear periódicamente |
| **Media** | 🟡 Amarillo | Atención preventiva, plan de respuesta |
| **Alta** | 🔴 Rojo | Intervención inmediata |
| **Crítica** | 🔴🔴 Rojo intenso | Acción urgente, escalar a nivel superior |

### 12.3 Cómo reportar una incidencia

1. En el módulo **Incidencias**, haga clic en **⚠️ Activar Alerta**.
2. Complete el formulario:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Tipo de incidencia | Seleccione la categoría del problema | Sí |
| Nivel de riesgo | Defina la severidad | Sí |
| Descripción | Describa la situación detalladamente | Sí |
| Ubicación | Coordenadas o descripción del lugar | No |
| Notas de seguimiento | Acciones tomadas o pendientes | No |

3. Haga clic en **Reportar**.

### 12.4 Estados de una incidencia

| Estado | Descripción |
|---|---|
| **Reportada** | La incidencia fue registrada y está en espera de análisis |
| **En análisis** | El equipo territorial está evaluando la situación |
| **Intervenida / Cerrada** | Se tomaron acciones correctivas y la situación se resolvió |

### 12.5 Escalamiento automático

Las incidencias de nivel **Crítico** y **Alto** generan automáticamente notificaciones al Analista Territorial responsable del municipio, para garantizar una respuesta oportuna.

---

## 13. Módulo: Instituciones

**Roles con acceso:** Administrador Municipal, Administrador.

Este módulo registra las organizaciones receptoras de alimentos: comedores comunitarios, escuelas, hospitales, hogares de adultos mayores y otras entidades que atienden población vulnerable.

### 13.1 Tipos de institución

| Tipo | Ejemplos |
|---|---|
| Institución Educativa | Colegios, jardines infantiles |
| Hospital / Centro de Salud | Hospitales, clínicas, centros de salud |
| Centro Penitenciario | Cárceles, colonias penales |
| Comedor Comunitario | Comedores barriales, fundaciones |
| Aeropuerto | Aeropuertos con programas de atención |
| Base Militar | Cuarteles y batallones |
| Hogar de Adultos Mayores | Ancianatos, centros de día |
| Albergue / Refugio | Refugios para población desplazada o en emergencia |
| Otra | Cualquier organización no listada |

### 13.2 Cómo registrar una institución

1. En el módulo **Instituciones**, haga clic en **+ Nueva institución**.
2. Complete el formulario:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Tipo | Tipo de institución | Sí |
| Nombre | Nombre oficial de la institución | Sí |
| Nombre de contacto | Persona responsable | Sí |
| Teléfono de contacto | Número de contacto | Sí |
| Email | Correo electrónico institucional | No |
| Departamento / Municipio | Ubicación | Sí |
| Dirección | Dirección física | No |
| Número de beneficiarios | Personas atendidas por día | Sí |
| Categorías preferidas | Tipos de alimentos que recibe habitualmente | No |
| Coordenadas | Latitud y longitud | No |
| Notas | Observaciones adicionales | No |

3. Haga clic en **Guardar**.

### 13.3 Estados de una institución

| Estado | Descripción |
|---|---|
| ⏳ **Pendiente de verificación** | Registrada, en proceso de validación |
| ✓ **Activa** | Verificada y puede recibir asignaciones |
| ✗ **Inactiva** | Suspendida temporalmente |

> Las instituciones **Activas** pueden ser seleccionadas al registrar demandas. Al seleccionarlas, el sistema auto-completa el municipio y el número de beneficiarios.

---

## 14. Módulo: Vista Territorial

**Roles con acceso:** Administrador Municipal, Analista Territorial, Administrador.

Este módulo presenta un **mapa interactivo** de Colombia que muestra la distribución geográfica de productores, demandas e instituciones en el territorio.

### 14.1 Elementos del mapa

| Elemento | Color | Descripción |
|---|---|---|
| Productor activo | 🟢 Verde | Productor verificado y operando |
| Productor pendiente | 🟡 Amarillo | Productor en proceso de verificación |
| Productor inactivo | ⚪ Gris | Productor suspendido |
| Demanda abierta | 🔵 Azul | Solicitud de alimentos sin atender |

### 14.2 Cómo usar el mapa

1. En el módulo **Vista Territorial**, el mapa carga automáticamente los puntos de su territorio.
2. Use la **barra de búsqueda** para encontrar un productor o institución por nombre.
3. Haga clic en cualquier marcador del mapa para ver un **panel de detalles** con:
   - Nombre del productor / institución
   - Tipo y estado
   - Datos de contacto
   - Categorías de productos
   - Ofertas activas
   - Demandas abiertas
   - Inventario disponible
4. El mapa hace un vuelo animado al punto seleccionado.

---

## 15. Módulo: Flota en Tiempo Real

**Roles con acceso:** Administrador Municipal, Analista Territorial, Administrador.

Este módulo muestra la posición y estado actual de los vehículos y recursos de transporte que están operando en el territorio.

### 15.1 Información por recurso

| Dato | Descripción |
|---|---|
| ID del recurso | Identificador único del vehículo o mensajero |
| Nombre | Nombre o placa del recurso |
| Tipo | Tipo de vehículo o recurso |
| Estado | En ruta, Disponible, Inactivo, En mantenimiento |
| Posición actual | Coordenadas GPS en tiempo real |
| Velocidad | km/h aproximados |
| Orden asociada | Número de la orden logística que está ejecutando |

### 15.2 Estados de flota

| Estado | Color | Descripción |
|---|---|---|
| **En ruta** | 🟢 Verde | Transportando alimentos activamente |
| **Disponible** | 🔵 Azul | Libre, puede ser asignado |
| **Inactivo** | ⚪ Gris | Fuera de servicio |
| **En mantenimiento** | 🟠 Naranja | En taller o revisión |

### 15.3 Actualización de datos

- La posición se actualiza cada **15 segundos** como mínimo.
- Si hay conexión en tiempo real disponible (servidor SSE activo), los datos se actualizan **instantáneamente**.
- Un indicador en la pantalla muestra si está en modo **En vivo** o **Actualizando**.

---

## 16. Módulo: Notificaciones

**Roles con acceso:** Operador Logístico, Administrador.

Este módulo permite enviar comunicaciones a los actores del sistema a través de múltiples canales.

### 16.1 Canales de notificación

| Canal | Descripción |
|---|---|
| 📧 **Email** | Correo electrónico |
| 💬 **SMS** | Mensaje de texto al celular |
| 📱 **WhatsApp** | Mensaje por WhatsApp |
| 🔔 **In-App** | Notificación dentro de la plataforma |

### 16.2 Cómo crear una notificación

1. En el módulo **Notificaciones**, haga clic en **+ Nueva notificación**.
2. Complete el formulario:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Canal | Medio de envío | Sí |
| Destinatario | Nombre, etiqueta o número del receptor | Sí |
| Título | Asunto del mensaje | Sí |
| Mensaje | Contenido de la comunicación | Sí |
| Fecha programada | Cuándo debe enviarse | Sí |
| ID Incidencia | Vincular a una incidencia específica | No |
| ID Orden Logística | Vincular a una orden de transporte | No |
| ID Oferta | Vincular a una oferta de mercado | No |

3. Haga clic en **Guardar**.

### 16.3 Estados de una notificación

| Estado | Color | Descripción |
|---|---|---|
| **Pendiente** | 🟠 Naranja | Programada para envío futuro |
| **Enviada** | 🟢 Verde | Fue enviada exitosamente |
| **Fallida** | 🔴 Rojo | No pudo enviarse (error de conexión o datos) |
| **Leída** | ⚪ Gris | El destinatario la leyó (solo aplica a In-App) |

---

## 17. Módulo: Análisis y Alertas

**Roles con acceso:** Analista Territorial, Administrador.

Este módulo presenta indicadores clave de rendimiento (KPIs) del sistema alimentario territorial y permite monitorear el estado de las alertas activas.

### 17.1 KPIs monitoreados

| KPI | Descripción |
|---|---|
| **IRAT** | Índice de Riesgo Alimentario Territorial (ver sección 20) |
| **Cobertura de programas** | Porcentaje de beneficiarios siendo atendidos |
| **Incidentes abiertos** | Número de incidencias sin resolver |
| **Ofertas vigentes** | Productos disponibles en el mercado |
| **Demandas sin emparejar** | Solicitudes que aún no han encontrado oferta compatible |
| **Rescates pendientes** | Operaciones de rescate programadas no ejecutadas |

### 17.2 Uso del módulo

- Revise los KPIs periódicamente para identificar tendencias negativas.
- Si el IRAT supera el umbral de **60**, considere activar protocolos de intervención.
- Las alertas críticas se generan automáticamente cuando los indicadores superan los umbrales definidos.

---

## 18. Módulo: Gestión de Usuarios

**Roles con acceso:** Administrador.

Este módulo permite crear, editar y gestionar las cuentas de los usuarios que tienen acceso a AgroRed en el municipio o territorio.

### 18.1 Cómo crear un usuario

1. En el módulo **Usuarios**, haga clic en **+ Nuevo usuario**.
2. Complete el formulario:

| Campo | Descripción | Obligatorio |
|---|---|---|
| Email | Correo electrónico del usuario (será su nombre de acceso) | Sí |
| Nombre completo | Nombre y apellidos | Sí |
| Rol | Rol que se le asignará en el sistema | Sí |
| Contraseña | Debe cumplir los requisitos de seguridad | Sí |

3. Haga clic en **Guardar**.

> El usuario recibirá sus credenciales de acceso. Asegúrese de compartirlas de forma segura.

### 18.2 Roles disponibles al crear usuarios

| Rol | Descripción |
|---|---|
| 🏛️ **Admin Municipal** | Administrador con acceso a gestión territorial y municipal |
| 🌾 **Productor** | Agricultor o asociación que ofrece productos |
| 🚛 **Operador Logístico** | Gestiona inventario, demandas y transporte |
| 🗺️ **Analista Territorial** | Monitorea el territorio y analiza datos |
| 🍲 **Cocina Comunitaria** | Gestiona comedores comunitarios |

### 18.3 Editar un usuario

1. Encuentre el usuario en la lista.
2. Haga clic en **✏️ Editar**.
3. Puede modificar el **nombre completo** y el **rol**.
4. Guarde los cambios.

### 18.4 Resumen de usuarios

El módulo muestra un panel con el conteo de usuarios por cada rol, para tener visibilidad rápida de la estructura del equipo.

---

## 19. Módulo: Tablas Maestras Territoriales

**Roles con acceso:** Administrador.

Este módulo permite administrar el catálogo de la división político-administrativa del territorio colombiano dentro del sistema.

### 19.1 ¿Qué son las tablas maestras?

Son los catálogos de referencia que alimentan los selectores de municipio, corregimiento y vereda en todos los formularios de la plataforma. Permiten al administrador mantener actualizada la estructura territorial de su jurisdicción.

### 19.2 Submódulos disponibles

| Submódulo | Descripción |
|---|---|
| **Departamentos** | Lista de los 32 departamentos de Colombia |
| **Municipios** | Municipios asociados a cada departamento |
| **Corregimientos** | Divisiones territoriales dentro de los municipios |
| **Veredas** | Zonas rurales dentro de los corregimientos |

### 19.3 Operaciones disponibles

En cada submódulo puede:
- **Ver** el listado completo con búsqueda y paginación.
- **Crear** nuevos registros con sus códigos DANE y nombres oficiales.
- **Editar** registros existentes para corregir datos.
- **Eliminar** registros que ya no apliquen (con confirmación).

---

## 20. Índice de Riesgo Alimentario Territorial (IRAT)

El **IRAT** es el indicador central de la plataforma AgroRed. Mide el nivel de riesgo de inseguridad alimentaria en un territorio en un momento dado, en una escala de **0 a 100**.

### Composición del IRAT

El índice se calcula considerando múltiples variables:
- Número de incidencias de inseguridad alimentaria activas
- Demandas sin atender respecto al total
- Cobertura de beneficiarios en programas alimentarios
- Disponibilidad de inventario frente a la demanda
- Nivel de actividad del mercado spot (ofertas y subastas)

### Semáforo del IRAT

| Rango | Color | Nivel | Acción |
|---|---|---|---|
| 0 – 40 | 🟢 Verde | Bajo | Operación normal, monitoreo rutinario |
| 40 – 60 | 🟡 Amarillo | Medio | Reforzar programas, revisar demandas |
| 60 – 80 | 🟠 Naranja | Alto | Activar plan de respuesta territorial |
| 80 – 100 | 🔴 Rojo | Crítico | Emergencia alimentaria, escalar a nivel departamental |

### Cómo mejorar el IRAT

Para reducir el índice de riesgo:
1. **Atender demandas abiertas** asignando inventario disponible.
2. **Programar rescates** de excedentes en riesgo de desperdicio.
3. **Registrar y resolver incidencias** de seguridad alimentaria.
4. **Conectar productores** con instituciones receptoras.
5. **Mantener el inventario** de buffer stock actualizado.

---

## 21. Preguntas frecuentes

**¿Por qué no veo todos los módulos del menú?**
Cada usuario solo ve los módulos habilitados para su rol. Si necesita acceso a un módulo adicional, comuníquese con el administrador del sistema.

**¿Puedo registrar un productor sin coordenadas GPS?**
Sí, las coordenadas son opcionales. Sin embargo, tener coordenadas permite que el productor aparezca en el mapa y que el sistema de emparejamiento funcione de forma más precisa.

**¿Qué pasa si una subasta termina sin ganador?**
La subasta pasa al estado "Cerrada sin ganador". El productor puede publicar una nueva subasta con ajustes en el precio base o la duración.

**¿Cómo sé si mi demanda fue atendida?**
El sistema cambia automáticamente el estado de la demanda a "Emparejada" cuando encuentra una oferta compatible, y a "Atendida" cuando el proceso de entrega es completado. Puede revisar el estado en cualquier momento en el módulo de Demandas.

**¿Puedo modificar una subasta después de publicarla?**
No. Una vez publicada y activa, la subasta no puede modificarse. Si hay un error, comuníquese con el administrador para cancelarla.

**¿Cuántos usuarios puedo crear por municipio?**
No hay límite de usuarios por municipio. Sin embargo, cada usuario debe tener un correo electrónico único.

**¿Los datos de un municipio son visibles para otros municipios?**
No. AgroRed aplica aislamiento de datos por municipio (tenant). Cada municipio solo ve su propia información.

**¿Qué significa la etiqueta ⚡ en una subasta?**
Indica que el producto tiene menos de 6 horas de vida útil estimada desde la cosecha. Es una alerta de urgencia: el producto debe venderse y transportarse lo antes posible.

**¿Puedo exportar los datos del sistema?**
Consulte con su administrador. La plataforma tiene módulos de análisis que permiten visualizar reportes; la exportación a Excel u otros formatos depende de la configuración habilitada para su municipio.

**¿Qué hago si olvidé mi contraseña?**
En la pantalla de inicio de sesión, haga clic en **¿Olvidaste tu contraseña?**. Ingrese su correo electrónico y recibirá un enlace de restablecimiento válido por **1 hora**. Haga clic en el enlace del correo, ingrese su nueva contraseña (debe cumplir los requisitos de seguridad) y confirme. Será redirigido automáticamente al inicio de sesión.

---

*Manual elaborado para la plataforma AgroRed — Sistema de Gobernanza Alimentaria para Colombia*  
*Para soporte técnico, contacte al administrador del sistema de su municipio.*
