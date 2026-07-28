"use strict";
/**
 * generate_oriente_antioqueno_report.cjs
 * Informe final QA E2E — los 9 municipios del Oriente Antioqueño (piloto Rionegro +
 * escalado a los 8 restantes). Ejecutar: node scripts/generate_oriente_antioqueno_report.cjs
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
} = require("docx");
const fs = require("fs");
const path = require("path");

function h1(text) { return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }); }
function h2(text) { return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 140 } }); }
function h3(text) { return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 100 } }); }
function body(text, opts = {}) { return new Paragraph({ children: [new TextRun({ text, size: 22, font: "Arial", ...opts })], spacing: { before: 80, after: 80 } }); }
function bullet(text) { return new Paragraph({ children: [new TextRun({ text, size: 22, font: "Arial" })], bullet: { level: 0 }, spacing: { before: 40, after: 40 } }); }
function cell(text, opts = {}) {
  return new TableCell({
    width: { size: opts.width ?? 20, type: WidthType.PERCENTAGE },
    shading: opts.header ? { type: ShadingType.SOLID, color: "2F5233", fill: "2F5233" } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, size: 20, font: "Arial", bold: !!opts.header, color: opts.header ? "FFFFFF" : undefined })] })],
  });
}
function row(cells) { return new TableRow({ children: cells }); }
function fullTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" }, bottom: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" }, right: { style: BorderStyle.SINGLE, size: 2, color: "AAAAAA" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
    },
    rows,
  });
}

const municipiosScaleOut = [
  ["MARINILLA", "Marinilla", "10 (2 org. ancla + 8 individuales)", "40", "4", "8", "2", "1", "8"],
  ["ELCARMEN", "El Carmen de Viboral", "10", "40", "4", "8", "2", "1", "8"],
  ["GUARNE", "Guarne", "10", "40", "4", "8", "2", "1", "8"],
  ["LACEJA", "La Ceja", "10", "40", "4", "8", "2", "1", "8"],
  ["ELRETIRO", "El Retiro", "10", "40", "4", "8", "2", "1", "8"],
  ["SANVICENTE", "San Vicente Ferrer", "10", "40", "4", "8", "2", "1", "8"],
  ["SANTUARIO", "El Santuario", "10", "40", "4", "8", "2", "1", "8"],
  ["PENOL", "El Peñol", "10", "40", "4", "8", "2", "1", "8"],
];

const scaleOutFlows = [
  "001 | Login de los 8 usuarios de prueba (7 roles + segundo productor) con tenantId correcto",
  "002 | Aislamiento multi-tenant: el admin del municipio no ve productores de otros municipios",
  "003 | Productor publica oferta con geolocalización",
  "004 | Subasta ascendente completa: publicar → pujar (cocina) → cerrar con ganador",
  "005 | Logística: registrar orden y avanzar scheduled → in_transit → delivered",
  "006 | Cocina Comunitaria: publicar demanda + emparejamiento automático con nueva oferta",
  "007 | Analista Territorial: lectura permitida, escritura bloqueada (403)",
  "008 | Incidencia: clasificación NLP + registro + verificar que IRAT no falle (POST /irat/check)",
];

const bugs = [
  { id: 1, sev: "CRÍTICA", estado: "Corregido", titulo: "Fuga de datos entre municipios: cualquier admin_municipal veía TODOS los tenants",
    causa: "GET /api/v1/{producers,users,inventory,rescues,institutions} anulaban el filtro de tenant (filterTenantId = null) para todo usuario con rol admin_municipal, en 5 servicios distintos.",
    correccion: "Se eliminó el bypass en los 5 archivos; el filtro por tenant ahora aplica siempre, sin excepción por rol. Verificado en los 9 municipios (OA-*-002 y RIO-ADM-002)." },
  { id: 2, sev: "CRÍTICA", estado: "Corregido", titulo: "Suplantación de tenant en escrituras (creación de productores, ofertas, etc.)",
    causa: "El middleware apps/shared/middleware/tenantContext.ts nunca estaba montado en apps/api-gateway/src/app.ts. Un usuario autenticado podía crear recursos bajo cualquier tenantId enviado en el body.",
    correccion: "Se montó tenantContext como middleware global en app.ts, justo después de auth + RBAC. Corrección global, aplica a los 9 municipios por igual." },
  { id: 3, sev: "ALTA", estado: "Corregido", titulo: "PATCH /api/v1/offers/:id sin aislamiento de tenant ni política RBAC",
    causa: "El handler PATCH no comparaba el tenant de la oferta contra el x-tenant-id del solicitante, y no existía política RBAC para ese método.",
    correccion: "Se añadió el mismo chequeo de tenant que GET /:id y una política RBAC explícita." },
  { id: 4, sev: "ALTA", estado: "Corregido", titulo: "PATCH /api/v1/logistics/:id no aplicaba ningún cambio (aceptar ruta, en tránsito, entrega)",
    causa: "PostgresLogisticsOrderRepository.patch() apuntaba por error a la tabla public.logistics_zones con columnas de geocercas; el UPDATE real nunca se ejecutaba.",
    correccion: "Se reescribió patch() para actualizar public.logistics_orders con las columnas reales. Verificado en los 9 municipios (OA-*-005 y RIO-LOG-002/003)." },
  { id: 5, sev: "ALTA", estado: "Corregido", titulo: "POST /api/v1/analytics/irat/check fallaba con 500 al cruzar el umbral de riesgo",
    causa: "El INSERT de la alerta se hacía sobre public.notifications sin incident_id ni logistics_order_id, violando un CHECK constraint.",
    correccion: "Se redirigió el INSERT a public.institutional_alerts. Verificado en los 9 municipios (OA-*-008 y RIO-ADM-004)." },
  { id: 6, sev: "MEDIA", estado: "Documentado (no corregido)", titulo: "Un productor puede editar ofertas de otro productor del mismo municipio",
    causa: "PATCH /offers/:id valida tenant y rol, pero no verifica que el productor autenticado sea el dueño real de la oferta.",
    correccion: "Requiere resolver el producerId del usuario autenticado dentro de offer-service. Recomendación para la siguiente iteración." },
  { id: 7, sev: "MEDIA", estado: "Documentado (decisión de producto pendiente)", titulo: "El rol 'supermarket' no puede participar en subastas (ni siquiera leerlas)",
    causa: "Ninguna entrada de rbac.ts para /api/v1/auctions incluye 'supermarket', pese a que el negocio agrupa \"Cocina Comunitaria/Supermercado\" como compradores de la holandesa.",
    correccion: "No se modificó por ser una decisión de política de acceso. Recomendado decidir explícitamente." },
  { id: 8, sev: "MEDIA", estado: "Documentado (decisión de producto pendiente)", titulo: "El rol 'producer' no puede reportar incidencias",
    causa: "rbac.ts solo permite POST /api/v1/incidents a admin_municipal, logistics_operator y territorial_analyst.",
    correccion: "No se modificó por ser una decisión de política de acceso." },
  { id: 9, sev: "MEDIA", estado: "Documentado", titulo: "\"Visión de Dios\" (cruce de tenants) no existe como control de acceso real",
    causa: "El rol SUPERADMIN se siembra en la BD pero rbac.ts nunca lo referencia; hoy es solo un concepto de UI.",
    correccion: "No corregido — requiere diseño explícito (qué rutas, qué auditoría)." },
  { id: 10, sev: "MEDIA", estado: "Documentado", titulo: "Alertas \"omnicanal\" solo envían por email",
    causa: "DispatchNotification.ts solo implementa el envío para 'email'; sms/whatsapp/in_app se registran pero no se despachan.",
    correccion: "No corregido — requiere integrar un proveedor SMS/WhatsApp real." },
  { id: 11, sev: "BAJA", estado: "Documentado", titulo: "El IRAT no se recalcula \"en tiempo real\"",
    causa: "Nada dispara POST /analytics/irat/check automáticamente al crear/cerrar una incidencia o demanda.",
    correccion: "No corregido — recomendado conectar un job periódico en automation-service." },
  { id: 12, sev: "BAJA", estado: "Documentado", titulo: "No existe activación automática de rescate desde una incidencia",
    causa: "El único puente incidencia→logística (trigger-logistics) crea una orden logística, no una fila 'rescues', y depende de LOGISTICS_SERVICE_URL:3007 (no se levanta en el monolito local).",
    correccion: "No corregido — la activación hacia banco de alimentos sigue siendo 100% manual." },
  { id: 13, sev: "BAJA", estado: "Documentado", titulo: "Rionegro tiene dos códigos DANE distintos en la tabla maestra de municipios",
    causa: "Dos migraciones distintas (029 y 032) insertan Rionegro con dane_code '05576' y '05615' respectivamente.",
    correccion: "No corregido — requiere decidir cuál código DANE es el correcto." },
];

const children = [];
children.push(new Paragraph({ children: [new TextRun({ text: "AGRORED — Informe de Pruebas E2E", bold: true, size: 44, font: "Arial" })], alignment: AlignmentType.CENTER, spacing: { after: 100 } }));
children.push(new Paragraph({ children: [new TextRun({ text: "Oriente Antioqueño — 9 municipios (piloto Rionegro + escalado)", size: 28, font: "Arial", italics: true })], alignment: AlignmentType.CENTER, spacing: { after: 60 } }));
children.push(new Paragraph({ children: [new TextRun({ text: "Multi-operador · Multi-rol · Corrección de bugs · Base de datos de desarrollo (Neon)", size: 22, font: "Arial", color: "666666" })], alignment: AlignmentType.CENTER, spacing: { after: 400 } }));

children.push(h1("Resumen Ejecutivo"));
children.push(body(
  "Este informe cubre el ciclo completo de pruebas E2E multi-rol solicitado para el Oriente Antioqueño: " +
  "primero un piloto profundo en Rionegro (36 casos de prueba, exploración exhaustiva por rol, ver detalle " +
  "en AGRORED_Informe_Piloto_QA_Rionegro.docx) y luego el escalado a los 8 municipios restantes (Marinilla, " +
  "El Carmen de Viboral, Guarne, La Ceja, El Retiro, San Vicente Ferrer, El Santuario y El Peñol) con datos " +
  "de prueba realistas y un set representativo de 8 pruebas por municipio (64 casos adicionales) que " +
  "confirma que las correcciones del piloto se sostienen de forma uniforme en toda la región."
));
children.push(body(
  "Total: 9 municipios cubiertos, 100 casos de prueba E2E (35/36 del piloto + 64/64 del escalado — 99/100, " +
  "el único caso no ejecutado depende de una credencial SUPERADMIN desconocida), 13 hallazgos (5 bugs reales " +
  "corregidos — 2 críticos de seguridad multi-tenant y 3 altos de funcionalidad rota — y 8 documentados como " +
  "gaps de producto que requieren una decisión de negocio, no un parche de código). El módulo con mayor " +
  "incidencia de errores fue el de aislamiento multi-tenant (2 de los 5 bugs corregidos), seguido de " +
  "logística (actualización de estado) e inteligencia/IRAT."
));

children.push(h2("Recomendaciones antes del piloto real con Corpoángeles"));
[
  "Decidir los 8 gaps de producto documentados (especialmente #6 ownership de oferta, #7 supermarket en subastas y #8 producer reportando incidencias) — afectan directamente los flujos reales que Corpoángeles va a usar.",
  "Fusionar la rama qa/oriente-antioqueno-rionegro-pilot a main una vez revisada, para que los 5 fixes lleguen a producción.",
  "Decidir el mecanismo real de god-mode/\"visión de Dios\" (#9) antes de que un usuario necesite supervisión cruzada real entre los 9 municipios.",
  "Los datos TEST_QA_* (prefijo por municipio) quedan en la base de desarrollo como demo; purgar antes de cualquier migración a producción real.",
  "Extender el patrón de datos (scripts/seed_oriente_antioqueno_pilot.ts) con datos verificados contra cartografía DANE oficial antes de un piloto real — los nombres de vereda usados aquí son plausibles pero no verificados.",
].forEach((t) => children.push(bullet(t)));

children.push(h2("Cobertura total"));
children.push(fullTable([
  row([cell("Métrica", { header: true, width: 45 }), cell("Valor", { header: true, width: 55 })]),
  ...[
    ["Municipios cubiertos", "9 de 9 (Rionegro piloto + 8 escalados)"],
    ["Total tenants/municipios sembrados", "9"],
    ["Total productores (10 municipios × ~11-13)", "93 (13 Rionegro + 80 en los 8 restantes)"],
    ["Total ofertas de catálogo", "372 (52 Rionegro + 320 en los 8 restantes)"],
    ["Total instituciones de demanda", "36 (4 por municipio)"],
    ["Total demandas base", "75 (11 Rionegro + 64 en los 8 restantes)"],
    ["Total órdenes logísticas base", "18 (2 por municipio)"],
    ["Total usuarios de prueba", "80 (8 por municipio, incluye segundo productor)"],
    ["Total casos de prueba E2E", "100 (36 piloto + 64 escalado)"],
    ["Casos que pasan", "99 (35 piloto + 64 escalado) — 1 no ejecutado (SUPERADMIN)"],
    ["Bugs encontrados", "13"],
    ["Bugs corregidos", "5 (2 críticos, 3 altos) — verificados en los 9 municipios"],
    ["Bugs documentados como gap de producto", "8"],
  ].map(([a, b]) => row([cell(a, { width: 45 }), cell(b, { width: 55 })])),
]));

children.push(h1("Rionegro (piloto)"));
children.push(body("Cobertura profunda: 3 organizaciones ancla, 10 productores individuales, 52 ofertas, 4 instituciones, 11 demandas, 2 órdenes logísticas, 36 casos de prueba E2E (35 pasan). Ver el detalle completo — tabla por rol y los 13 hallazgos con causa raíz — en AGRORED_Informe_Piloto_QA_Rionegro.docx, el documento fuente de este resumen."));

children.push(h1("Los 8 municipios restantes (escalado)"));
children.push(body(
  "Sembrados con el mismo patrón de datos que Rionegro (organizaciones ancla, productores individuales con " +
  "vereda, catálogo diversificado en 6 categorías, instituciones de demanda tipo ESE/comedor/ICBF/supermercado, " +
  "logística e incidente de contexto), vía scripts/seed_oriente_antioqueno_pilot.ts. Cada uno recibió el " +
  "mismo set de 8 pruebas representativas (login multi-rol, aislamiento multi-tenant, oferta, subasta " +
  "ascendente completa, ciclo logístico, emparejamiento oferta-demanda, RBAC de analista, incidencia+IRAT)."
));
children.push(fullTable([
  row([
    cell("Municipio", { header: true, width: 20 }), cell("Productores", { header: true, width: 13 }),
    cell("Ofertas", { header: true, width: 10 }), cell("Instituciones", { header: true, width: 13 }),
    cell("Demandas", { header: true, width: 11 }), cell("Log.", { header: true, width: 8 }),
    cell("Incid.", { header: true, width: 9 }), cell("Usuarios", { header: true, width: 10 }),
    cell("Resultado E2E", { header: true, width: 16 }),
  ]),
  ...municipiosScaleOut.map(([code, name, prod, off, inst, dem, log, inc, usr]) => row([
    cell(name, { width: 20 }), cell(prod, { width: 13 }), cell(off, { width: 10 }), cell(inst, { width: 13 }),
    cell(dem, { width: 11 }), cell(log, { width: 8 }), cell(inc, { width: 9 }), cell(usr, { width: 10 }),
    cell("✅ 8/8 pasan", { width: 16 }),
  ])),
]));

children.push(h2("Flujos probados por municipio (idénticos en los 8)"));
scaleOutFlows.forEach((f) => children.push(bullet(f)));
children.push(body(
  "Ningún hallazgo nuevo surgió en el escalado: los 5 bugs corregidos en el piloto de Rionegro son de código " +
  "(no dependen del tenant), así que su corrección se sostiene uniformemente en los 8 municipios adicionales, " +
  "confirmado por los 64/64 casos en verde."
));

children.push(h1("Los 13 hallazgos (aplican a los 9 municipios por igual)"));
for (const b of bugs) {
  children.push(h3(`Bug #${b.id} — [${b.sev}] ${b.titulo}`));
  children.push(body(`Estado: ${b.estado}`, { bold: true }));
  children.push(body(`Causa raíz: ${b.causa}`));
  children.push(body(`Corrección / recomendación: ${b.correccion}`));
}

children.push(h1("Sincronización"));
children.push(body(
  "Todo el trabajo (5 correcciones de bugs + datos y pruebas de los 9 municipios) está en la rama " +
  "qa/oriente-antioqueno-rionegro-pilot, pusheada a origin — pendiente de tu revisión y fusión a main. " +
  "Los datos TEST_QA_* permanecen en la base de datos de desarrollo (Neon) como demo, según lo acordado."
));

const doc = new Document({ sections: [{ properties: {}, children }], styles: { default: { document: { run: { font: "Arial" } } } } });
const outPath = path.join(__dirname, "..", "AGRORED_Informe_QA_Oriente_Antioqueno_Completo.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(outPath, buf);
  console.log("Informe generado:", outPath);
});
