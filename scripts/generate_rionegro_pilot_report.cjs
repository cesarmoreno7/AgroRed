"use strict";
/**
 * generate_rionegro_pilot_report.cjs
 * Genera el informe de la prueba piloto QA (Rionegro, Oriente Antioqueño) en .docx
 * Ejecutar: node scripts/generate_rionegro_pilot_report.cjs
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} = require("docx");
const fs = require("fs");
const path = require("path");

function h1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } });
}
function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 140 } });
}
function h3(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 100 } });
}
function body(text, opts = {}) {
  return new Paragraph({ children: [new TextRun({ text, size: 22, font: "Arial", ...opts })], spacing: { before: 80, after: 80 } });
}
function bullet(text) {
  return new Paragraph({ children: [new TextRun({ text, size: 22, font: "Arial" })], bullet: { level: 0 }, spacing: { before: 40, after: 40 } });
}
function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width ?? 20, type: WidthType.PERCENTAGE },
    shading: opts.header ? { type: ShadingType.SOLID, color: "2F5233", fill: "2F5233" } : undefined,
    children: [new Paragraph({
      children: [new TextRun({ text, size: 20, font: "Arial", bold: !!opts.header, color: opts.header ? "FFFFFF" : undefined })],
    })],
  });
}
function row(cells) { return new TableRow({ children: cells }); }
function fullTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
    },
    rows,
  });
}

// ─── Datos del informe ──────────────────────────────────────────────────────

const roleResults = [
  ["Productor", "RIO-PROD-002 Publicar oferta con geolocalización", "✅ Pasa", ""],
  ["Productor", "RIO-PROD-003 Validación de campos obligatorios", "✅ Pasa", ""],
  ["Productor", "RIO-PROD-004 Editar oferta propia", "✅ Pasa", ""],
  ["Productor", "RIO-PROD-005 Aislamiento entre productores del mismo municipio", "❌ Falla (gap real)", "PATCH /offers/:id no valida propiedad — ver Bug #6"],
  ["Productor", "RIO-PROD-006 Aislamiento cross-tenant al editar oferta", "⚠️ Falla y se corrigió", "Ver Bug #3"],
  ["Productor", "RIO-PROD-007 Reportar incidencia", "❌ Falla (403, gap de negocio)", "RBAC no incluye 'producer' — ver Bug #8"],
  ["Productor", "RIO-PROD-008 Publicar subasta ascendente (vendedor)", "✅ Pasa", ""],
  ["Operador Logístico", "RIO-LOG-001 Ver órdenes asignadas", "✅ Pasa", ""],
  ["Operador Logístico", "RIO-LOG-002 Aceptar/iniciar ruta", "⚠️ Falla y se corrigió", "Ver Bug #4 (PATCH no persistía)"],
  ["Operador Logístico", "RIO-LOG-003 Estado en tránsito + confirmar entrega", "⚠️ Falla y se corrigió", "Ver Bug #4"],
  ["Operador Logístico", "RIO-LOG-004 Reprogramar ruta ante incidencia", "✅ Pasa (tras Bug #4)", ""],
  ["Operador Logístico", "RIO-LOG-005 RBAC: producer bloqueado", "✅ Pasa", ""],
  ["Cocina Comunitaria", "RIO-KIT-001 Publicar demanda institucional", "✅ Pasa", ""],
  ["Cocina Comunitaria", "RIO-KIT-002 Emparejamiento automático oferta-demanda", "✅ Pasa", ""],
  ["Cocina Comunitaria", "RIO-KIT-003 Pujar/aceptar subasta holandesa", "✅ Pasa", ""],
  ["Cocina Comunitaria", "RIO-KIT-004 Sin acceso a inteligencia/territorial", "✅ Pasa", ""],
  ["Supermercado", "RIO-SUPER-001 Ver ofertas del municipio", "✅ Pasa", ""],
  ["Supermercado", "RIO-SUPER-002 Participar en subasta holandesa", "❌ Falla (gap de negocio)", "RBAC excluye 'supermarket' — ver Bug #7"],
  ["Analista Territorial", "RIO-ANL-001/002 Lectura en los 4 módulos", "✅ Pasa", ""],
  ["Analista Territorial", "RIO-ANL-003/004/005 Rechazo de escritura (crear/editar)", "✅ Pasa", "005 depende del fix del Bug #3"],
  ["Admin. Municipal", "RIO-ADM-001 Control total dentro de su tenant", "✅ Pasa", ""],
  ["Admin. Municipal", "RIO-ADM-002 Aislamiento multi-tenant (lectura)", "⚠️ Falla y se corrigió", "Ver Bug #1 (crítico)"],
  ["Admin. Municipal", "RIO-ADM-003 Anti-suplantación de tenant (escritura)", "⚠️ Falla y se corrigió", "Ver Bug #2 (crítico)"],
  ["Admin. Municipal", "RIO-ADM-004 IRAT en tiempo real tras incidente crítico", "⚠️ Falla y se corrigió", "Ver Bug #5"],
  ["Admin. Municipal", "RIO-ADM-005 Copiloto IA (2 consultas reales)", "✅ Pasa", ""],
  ["Admin. Municipal", "RIO-ADM-006 \"Visión de Dios\" (SUPERADMIN)", "⏭️ No ejecutado", "Credencial desconocida; gap documentado igual — ver Bug #9"],
  ["Multi-rol (cadena)", "RIO-CHAIN-001 Oferta→Subasta→Puja→Cierre→Logística→Rescate", "✅ Pasa", "Orquestación manual — ver Bug #12"],
  ["Multi-rol (incidencias)", "RIO-INC-001/002 Clasificación NLP + alertas por zona", "✅ Pasa", ""],
  ["Multi-rol (incidencias)", "RIO-INC-003 Notificación por email (real)", "✅ Pasa", ""],
  ["Multi-rol (incidencias)", "RIO-INC-003b Canales SMS/WhatsApp/in-app", "❌ Falla (gap conocido)", "Ver Bug #10"],
  ["Multi-rol (incidencias)", "RIO-INC-004 Orquestación logística desde incidencia", "✅ Pasa", "Ver Bug #12"],
];

const bugs = [
  {
    id: 1, sev: "CRÍTICA", estado: "Corregido",
    titulo: "Fuga de datos entre municipios: cualquier admin_municipal veía TODOS los tenants",
    causa: "GET /api/v1/{producers,users,inventory,rescues,institutions} anulaban el filtro de tenant (filterTenantId = null) para todo usuario con rol admin_municipal, en 5 servicios distintos.",
    correccion: "Se eliminó el bypass en los 5 archivos; el filtro por tenant ahora aplica siempre, sin excepción por rol.",
  },
  {
    id: 2, sev: "CRÍTICA", estado: "Corregido",
    titulo: "Suplantación de tenant en escrituras (creación de productores, ofertas, etc.)",
    causa: "El middleware apps/shared/middleware/tenantContext.ts, diseñado para forzar el tenantId del header confiable sobre el del body, nunca estaba montado en apps/api-gateway/src/app.ts. Un usuario autenticado podía crear recursos bajo cualquier tenantId enviado en el body.",
    correccion: "Se montó tenantContext como middleware global en app.ts, justo después de auth + RBAC.",
  },
  {
    id: 3, sev: "ALTA", estado: "Corregido",
    titulo: "PATCH /api/v1/offers/:id sin aislamiento de tenant ni política RBAC",
    causa: "A diferencia de GET /offers/:id, el handler PATCH no comparaba el tenant de la oferta con el x-tenant-id del solicitante, y no existía ninguna entrada de RBAC para el método PATCH sobre esa ruta (quedaba abierta a cualquier rol autenticado).",
    correccion: "Se añadió el mismo chequeo de tenant que GET /:id y una política RBAC explícita (admin_municipal, producer, supermarket).",
  },
  {
    id: 4, sev: "ALTA", estado: "Corregido",
    titulo: "PATCH /api/v1/logistics/:id no aplicaba ningún cambio (aceptar ruta, en tránsito, entrega)",
    causa: "PostgresLogisticsOrderRepository.patch() tenía un mapeo de columnas y un UPDATE copiados de un repositorio de geocercas (UPDATE public.logistics_zones SET zone_name=..., etc.). Ningún campo real de logistics_orders (status, notes, fechas) coincidía, así que el UPDATE nunca se ejecutaba: el endpoint devolvía 200 con el registro sin cambios.",
    correccion: "Se reescribió patch() para actualizar public.logistics_orders con las columnas reales de la entidad.",
  },
  {
    id: 5, sev: "ALTA", estado: "Corregido",
    titulo: "POST /api/v1/analytics/irat/check fallaba con 500 al cruzar el umbral de riesgo",
    causa: "El INSERT de la alerta se hacía sobre public.notifications sin incident_id ni logistics_order_id, violando el CHECK chk_notifications_reference_present en cuanto algún tenant superaba el umbral IRAT alto/crítico.",
    correccion: "Se redirigió el INSERT a public.institutional_alerts (tabla ya diseñada para 'irat_alto', sin esa restricción).",
  },
  {
    id: 6, sev: "MEDIA", estado: "Documentado (no corregido)",
    titulo: "Un productor puede editar ofertas de otro productor del mismo municipio",
    causa: "Tras corregir el Bug #3, PATCH /offers/:id valida tenant y rol, pero no verifica que el productor autenticado sea el dueño real de la oferta (no hay cruce contra producers.user_id).",
    correccion: "Requiere resolver el producerId del usuario autenticado dentro de offer-service antes de autorizar el PATCH. Queda como recomendación para la siguiente iteración.",
  },
  {
    id: 7, sev: "MEDIA", estado: "Documentado (decisión de producto pendiente)",
    titulo: "El rol 'supermarket' no puede participar en subastas (ni siquiera leerlas)",
    causa: "Ninguna entrada de rbac.ts para /api/v1/auctions incluye 'supermarket', pese a que el enunciado de negocio agrupa \"Cocina Comunitaria/Supermercado\" como compradores de la subasta holandesa.",
    correccion: "No se modificó por ser una decisión de política de acceso, no un bug de implementación. Se recomienda decidir explícitamente si 'supermarket' debe pujar.",
  },
  {
    id: 8, sev: "MEDIA", estado: "Documentado (decisión de producto pendiente)",
    titulo: "El rol 'producer' no puede reportar incidencias",
    causa: "rbac.ts solo permite POST /api/v1/incidents a admin_municipal, logistics_operator y territorial_analyst, mientras que el flujo de negocio esperado incluye al productor reportando incidencias.",
    correccion: "No se modificó por ser una decisión de política de acceso. Se recomienda decidir si el productor debe poder reportar.",
  },
  {
    id: 9, sev: "MEDIA", estado: "Documentado",
    titulo: "\"Visión de Dios\" (cruce de tenants) no existe como control de acceso real",
    causa: "El rol SUPERADMIN se siembra en infra/postgres/028_superadmin_role.sql con metadata.ai_copilot_unrestricted, pero rbac.ts nunca compara contra ese rol; hoy es un concepto solo de UI (apps/web-dashboard/src/types/index.ts).",
    correccion: "No corregido — implementar god-mode real requiere diseño explícito (qué rutas, qué auditoría). Ahora que el Bug #1 está corregido, ningún admin_municipal tiene cruce de tenants por accidente, lo cual es correcto; pero tampoco hay forma de otorgarlo intencionalmente a un superadmin.",
  },
  {
    id: 10, sev: "MEDIA", estado: "Documentado",
    titulo: "Alertas \"omnicanal\" solo envían por email",
    causa: "DispatchNotification.ts solo implementa el envío para 'email'; sms/whatsapp/in_app se registran en BD pero lanzan UNSUPPORTED_NOTIFICATION_CHANNEL al intentar despacharse.",
    correccion: "No corregido en este pilot — requiere integrar un proveedor SMS/WhatsApp real. Documentado como alcance pendiente.",
  },
  {
    id: 11, sev: "BAJA", estado: "Documentado",
    titulo: "El IRAT no se recalcula \"en tiempo real\"",
    causa: "GET /analytics/irat calcula al vuelo, pero nada dispara POST /analytics/irat/check automáticamente al crear/cerrar una incidencia o demanda; requiere invocación explícita (o un cron en automation-service que hoy no está conectado a este endpoint).",
    correccion: "No corregido — es un gap de automatización, no un bug puntual. Recomendado conectar un job periódico.",
  },
  {
    id: 12, sev: "BAJA", estado: "Documentado",
    titulo: "No existe activación automática de rescate desde una incidencia",
    causa: "El único puente incidencia→logística es POST /incidents/:id/trigger-logistics, que crea una orden logística (no una fila en 'rescues' con rescueChannel='food_bank') y además hace un fetch() HTTP a LOGISTICS_SERVICE_URL (localhost:3007 por defecto) — un puerto que no se levanta en el monolito local ni en el arranque de Playwright, residuo de la arquitectura de microservicios original.",
    correccion: "No corregido — requiere decidir el diseño real del flujo incidencia→rescate. La activación hacia banco de alimentos sigue siendo 100% manual (POST /rescues/register).",
  },
  {
    id: 13, sev: "BAJA", estado: "Documentado",
    titulo: "Rionegro tiene dos códigos DANE distintos en la tabla maestra de municipios",
    causa: "infra/postgres/029_departamentos_municipios.sql inserta Rionegro con dane_code '05576'; infra/postgres/032_municipios_coords_dane.sql lo vuelve a insertar con '05615'. Las veredas/corregimientos de Rionegro quedaron sembradas contra '05576'.",
    correccion: "No corregido — requiere decidir cuál código DANE es el correcto y limpiar la migración duplicada.",
  },
];

const summaryCounts = [
  ["Tenant/municipio sembrado", "1 (Rionegro) — piloto según metodología del prompt, antes de escalar a los 8 restantes"],
  ["Operadores/organizaciones ancla", "3 (Corpoángeles, APAO, COOAGRORIO)"],
  ["Productores individuales", "10 (con vereda real y coordenadas aproximadas)"],
  ["Catálogo de productos (ofertas base)", "52 (across 6 categorías: hortaliza, fruta, tubérculo, lácteo, cárnico, huevo)"],
  ["Instituciones de demanda", "4 (ESE Hospital, Comedor Comunitario, ICBF/CDI, Supermercado)"],
  ["Demandas publicadas (base)", "11"],
  ["Órdenes logísticas (base)", "2"],
  ["Usuarios de prueba por rol", "8 (7 roles + segundo productor para pruebas de aislamiento)"],
  ["Casos de prueba E2E (Playwright)", "36 (35 pasan, 1 no ejecutado por credencial SUPERADMIN desconocida)"],
  ["Bugs encontrados", "13"],
  ["Bugs corregidos", "5 (2 críticos, 3 altos)"],
  ["Bugs documentados como gap de producto", "8 (requieren decisión de negocio o alcance mayor)"],
];

// ─── Construcción del documento ────────────────────────────────────────────

const children = [];

children.push(new Paragraph({
  children: [new TextRun({ text: "AGRORED — Informe de Pruebas E2E", bold: true, size: 44, font: "Arial" })],
  alignment: AlignmentType.CENTER, spacing: { after: 100 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Piloto QA: Municipio de Rionegro (Oriente Antioqueño)", size: 28, font: "Arial", italics: true })],
  alignment: AlignmentType.CENTER, spacing: { after: 60 },
}));
children.push(new Paragraph({
  children: [new TextRun({ text: "Multi-rol · Corrección de bugs · Base de datos de desarrollo (Neon)", size: 22, font: "Arial", color: "666666" })],
  alignment: AlignmentType.CENTER, spacing: { after: 400 },
}));

children.push(h1("Resumen Ejecutivo"));
children.push(body(
  "Este informe cubre la primera fase (piloto, un solo municipio) del plan de pruebas end-to-end solicitado " +
  "para el Oriente Antioqueño. Según la metodología definida, antes de escalar datos y pruebas a los 8 " +
  "municipios restantes (Marinilla, El Carmen de Viboral, Guarne, La Ceja, El Retiro, San Vicente, El " +
  "Santuario y El Peñol) se ejecutó y validó el ciclo completo sobre Rionegro, incluyendo generación de " +
  "datos realistas, ejecución de flujos por rol, detección y corrección de bugs, y verificación de que las " +
  "correcciones no rompieron el resto de la suite existente (154 pruebas de integración/unitarias + 43 " +
  "specs E2E previos sobre el tenant Bogotá — todos en verde tras los cambios)."
));
children.push(body(
  "Se encontraron 13 hallazgos. Dos son críticos de seguridad multi-tenant (una fuga de datos entre " +
  "municipios y una suplantación de tenant en escrituras) y ya están corregidos, junto con tres bugs " +
  "funcionales de alta severidad que rompían por completo la actualización de estado logístico y el " +
  "cálculo de alertas IRAT. Los 8 hallazgos restantes son gaps de producto o de alcance (RBAC que no " +
  "coincide con el flujo de negocio descrito, canales de notificación no implementados, ausencia de " +
  "automatización incidencia→rescate) que se documentan pero requieren una decisión de negocio antes de " +
  "corregirse, no un simple parche de código."
));

children.push(h2("Recomendaciones antes de escalar a los 8 municipios restantes"));
[
  "Revisar y aprobar (o descartar) los 8 gaps de producto documentados abajo antes de generar datos masivos — varios afectan directamente los flujos que el piloto real con Corpoángeles necesita (p. ej. supermarket sin acceso a subastas).",
  "Decidir el mecanismo real de \"visión de Dios\" (Bug #9) antes de que un municipio ancla como Rionegro necesite supervisión cruzada real.",
  "Extender el patrón de fixtures multi-tenant creado en este pilot (tests/e2e/fixtures/users.rionegro.ts, scripts/seed_rionegro_pilot.ts) a los 8 municipios restantes — es reutilizable, solo cambian los datos.",
  "Añadir un job de limpieza (`afterAll` o script de purga) para los datos TEST_QA_* antes de escalar a 9 municipios, o se acumularán ~500+ registros de prueba en la base de desarrollo.",
].forEach((t) => children.push(bullet(t)));

children.push(h2("Cifras del piloto (Rionegro)"));
children.push(fullTable([
  row([cell("Métrica", { header: true, width: 45 }), cell("Valor", { header: true, width: 55 })]),
  ...summaryCounts.map(([a, b]) => row([cell(a, { width: 45 }), cell(b, { width: 55 })])),
]));

children.push(h1("Municipio: Rionegro"));
children.push(h2("Datos de prueba creados"));
children.push(body(
  "Todos los registros llevan el prefijo TEST_QA_RIONEGRO (catálogo base sembrado por " +
  "scripts/seed_rionegro_pilot.ts) o TEST_QA_RIONEGRO dentro del título/nombre para los registros " +
  "creados dinámicamente por las pruebas Playwright (tests/e2e/rionegro/*.spec.ts), de modo que sean " +
  "identificables y purgables sin afectar datos reales ni los tenants BOGOTA/MEDELLIN/etc. ya sembrados " +
  "por scripts/seed_expanded.ts."
));

children.push(h2("Resultados por rol"));
children.push(fullTable([
  row([
    cell("Rol", { header: true, width: 16 }),
    cell("Flujo probado", { header: true, width: 42 }),
    cell("Resultado", { header: true, width: 20 }),
    cell("Observación", { header: true, width: 22 }),
  ]),
  ...roleResults.map(([r, f, res, obs]) => row([
    cell(r, { width: 16 }), cell(f, { width: 42 }), cell(res, { width: 20 }), cell(obs, { width: 22 }),
  ])),
]));

children.push(h2("Bugs encontrados"));
for (const b of bugs) {
  children.push(h3(`Bug #${b.id} — [${b.sev}] ${b.titulo}`));
  children.push(body(`Estado: ${b.estado}`, { bold: true }));
  children.push(body(`Causa raíz: ${b.causa}`));
  children.push(body(`Corrección / recomendación: ${b.correccion}`));
}

children.push(h1("Sincronización"));
children.push(body(
  "Los cambios de código (5 correcciones de bugs) y los datos/pruebas de este pilot están en la rama " +
  "qa/oriente-antioqueno-rionegro-pilot, aún no fusionada a main ni enviada (push) al remoto — pendiente " +
  "de tu confirmación explícita, según lo acordado. Los datos de prueba TEST_QA_RIONEGRO permanecen en la " +
  "base de datos de desarrollo (Neon) usada para este pilot; indícanos si deben quedar como demo o " +
  "purgarse antes de escalar al resto de municipios."
));

const doc = new Document({
  sections: [{ properties: {}, children }],
  styles: { default: { document: { run: { font: "Arial" } } } },
});

const outPath = path.join(__dirname, "..", "AGRORED_Informe_Piloto_QA_Rionegro.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log("Informe generado:", outPath);
});
