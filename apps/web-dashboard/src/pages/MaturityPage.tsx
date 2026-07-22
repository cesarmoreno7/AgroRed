import { useEffect, useState } from "react";
import { api } from "../services/api";

// ── Tipos ─────────────────────────────────────────────────────
interface ModuleMaturity {
  id: string;
  label: string;
  icon: string;
  category: "core" | "operaciones" | "inteligencia" | "infraestructura";
  dimensions: {
    funcional: number;    // 0-100: CRUD completo, UI, validaciones
    datos: number;        // 0-100: datos reales, integridad referencial
    integracion: number;  // 0-100: integrado en monolito, eventos, caché
    seguridad: number;    // 0-100: auth, roles, audit log
    operacional: number;  // 0-100: en uso, analítica, alertas
  };
  estado: "produccion" | "beta" | "desarrollo" | "planeado";
  recordCount?: number;
  notes: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  core:            "#4ade80",
  operaciones:     "#60a5fa",
  inteligencia:    "#a78bfa",
  infraestructura: "#f59e0b",
};

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  produccion:  { label: "Producción",  color: "#4ade80", bg: "rgba(74,222,128,0.12)"  },
  beta:        { label: "Beta",        color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  desarrollo:  { label: "Desarrollo",  color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  planeado:    { label: "Planeado",    color: "#6b7280", bg: "rgba(107,114,128,0.12)" },
};

// ── Definición estática de madurez por módulo ─────────────────
const MODULES: ModuleMaturity[] = [
  // ── CORE ─────────────────────────────────────────────────────
  {
    id: "users",
    label: "Gestión de Usuarios",
    icon: "👤",
    category: "core",
    dimensions: { funcional: 95, datos: 90, integracion: 95, seguridad: 100, operacional: 90 },
    estado: "produccion",
    notes: "JWT, reset de contraseña, roles RBAC, multitenant. Producción estable. " +
      "Jul-2026: matriz RBAC (17 casos) y suite de integración del gateway verificadas de punta a punta " +
      "tras reparar un bug de inicialización que las dejaba sin ejecutar realmente.",
  },
  {
    id: "producers",
    label: "Productores",
    icon: "🌾",
    category: "core",
    dimensions: { funcional: 90, datos: 85, integracion: 90, seguridad: 85, operacional: 80 },
    estado: "produccion",
    notes: "CRUD completo, estadísticas históricas, georreferenciación, filtros avanzados.",
  },
  {
    id: "institutions",
    label: "Instituciones",
    icon: "🏛️",
    category: "core",
    dimensions: { funcional: 92, datos: 85, integracion: 90, seguridad: 85, operacional: 78 },
    estado: "produccion",
    notes: "CRUD, historial de estados, importación CSV, filtros por municipio. " +
      "Jul-2026: corregida una regresión de paginación (límite por defecto) y ampliada la cobertura E2E.",
  },
  {
    id: "auth",
    label: "Autenticación & Auth",
    icon: "🔐",
    category: "core",
    dimensions: { funcional: 95, datos: 90, integracion: 95, seguridad: 100, operacional: 95 },
    estado: "produccion",
    notes: "JWT firmado, middleware de verificación, logout, sesión expirada con evento global. " +
      "Jul-2026: 9/9 pruebas del gateway y 17/17 de la matriz RBAC verificadas de punta a punta.",
  },
  // ── OPERACIONES ───────────────────────────────────────────────
  {
    id: "offers",
    label: "Ofertas de Productos",
    icon: "📦",
    category: "operaciones",
    dimensions: { funcional: 85, datos: 80, integracion: 85, seguridad: 80, operacional: 75 },
    estado: "produccion",
    notes: "Publicación, matching con demandas, eventos Redis, auditoría.",
  },
  {
    id: "rescues",
    label: "Rescates Alimentarios",
    icon: "♻️",
    category: "operaciones",
    dimensions: { funcional: 85, datos: 80, integracion: 85, seguridad: 80, operacional: 75 },
    estado: "produccion",
    notes: "Orígenes aliados, canales, geolocalización, eventos bus.",
  },
  {
    id: "demands",
    label: "Demandas",
    icon: "🍽️",
    category: "operaciones",
    dimensions: { funcional: 80, datos: 75, integracion: 80, seguridad: 75, operacional: 70 },
    estado: "produccion",
    notes: "Registro de necesidades institucionales con FK a institutions.",
  },
  {
    id: "deliveries",
    label: "Entregas de Productos",
    icon: "📬",
    category: "operaciones",
    dimensions: { funcional: 92, datos: 85, integracion: 85, seguridad: 82, operacional: 72 },
    estado: "produccion",
    notes: "CRUD maestro-detalle, trazabilidad física y económica, integrado en analytics. " +
      "Jul-2026: corregido un bug de contrato en el catálogo de productos y un bug de idempotencia en el " +
      "seed histórico (ON CONFLICT apuntaba a la columna equivocada); migraciones 030-032 aplicadas en Neon; " +
      "cobertura E2E completa (8/8 casos, incluyendo creación real de entregas).",
  },
  {
    id: "inventory",
    label: "Inventario",
    icon: "📊",
    category: "operaciones",
    dimensions: { funcional: 80, datos: 70, integracion: 80, seguridad: 75, operacional: 65 },
    estado: "produccion",
    notes: "Ítems, disponibilidad, reservas. Sin alertas automáticas de stock mínimo aún.",
  },
  {
    id: "auctions",
    label: "Subastas",
    icon: "🏷️",
    category: "operaciones",
    dimensions: { funcional: 85, datos: 70, integracion: 80, seguridad: 75, operacional: 60 },
    estado: "produccion",
    notes: "Pujas, cierre automático por scheduler, eventos bus.",
  },
  {
    id: "logistics",
    label: "Logística & Tracking",
    icon: "🚚",
    category: "operaciones",
    dimensions: { funcional: 90, datos: 82, integracion: 88, seguridad: 85, operacional: 75 },
    estado: "produccion",
    notes: "Órdenes, tracking en tiempo real, planificación de rutas con OSRM. " +
      "Jul-2026: corregido un bug crítico que hacía fallar GET /api/v1/logistics con error 500 " +
      "(columnas de un esquema anterior a una migración de renombrado); cobertura E2E nueva (6/6).",
  },
  {
    id: "catalog",
    label: "Catálogo de Productos",
    icon: "🥦",
    category: "operaciones",
    dimensions: { funcional: 85, datos: 90, integracion: 85, seguridad: 70, operacional: 75 },
    estado: "produccion",
    notes: "58 productos sembrados, categorías, unidades. Base de referencia para módulos.",
  },
  {
    id: "origins",
    label: "Orígenes Aliados",
    icon: "🏪",
    category: "operaciones",
    dimensions: { funcional: 80, datos: 70, integracion: 75, seguridad: 70, operacional: 60 },
    estado: "produccion",
    notes: "Fuentes de abastecimiento para rescates.",
  },
  {
    id: "incidents",
    label: "Incidencias Sociales",
    icon: "⚠️",
    category: "operaciones",
    dimensions: { funcional: 75, datos: 65, integracion: 75, seguridad: 70, operacional: 60 },
    estado: "produccion",
    notes: "Registro y auditoría de incidencias. Ingresa al IRAT.",
  },
  // ── INTELIGENCIA ──────────────────────────────────────────────
  {
    id: "analytics",
    label: "Analítica & Dashboard",
    icon: "📈",
    category: "inteligencia",
    dimensions: { funcional: 90, datos: 85, integracion: 90, seguridad: 80, operacional: 85 },
    estado: "produccion",
    notes: "IRAT, cobertura, resumen por tenant, vista territorial, mapa GIS. Caché Redis.",
  },
  {
    id: "irat",
    label: "Índice IRAT",
    icon: "🚨",
    category: "inteligencia",
    dimensions: { funcional: 90, datos: 78, integracion: 85, seguridad: 78, operacional: 78 },
    estado: "beta",
    notes: "Algoritmo compuesto de 5 dimensiones reales (cobertura, tendencia, diversidad, " +
      "incidencias, continuidad logística) — antes era un ratio de una sola dimensión pese a " +
      "documentarse como compuesto. Jul-2026: reescrito, conectado al barrido horario de " +
      "automation-service y verificado con build limpio.",
  },
  {
    id: "ml",
    label: "Apoyo a Decisión (ML)",
    icon: "🤖",
    category: "inteligencia",
    dimensions: { funcional: 80, datos: 70, integracion: 75, seguridad: 65, operacional: 58 },
    estado: "beta",
    notes: "Motor de heurísticas (no hay modelo entrenado — no se presenta como tal). Jul-2026: " +
      "se agregó una dimensión de tendencia real (30 días vs. los 30 anteriores) usando los 14 " +
      "meses de datos históricos ya sembrados, en vez de evaluar solo una foto del momento.",
  },
  {
    id: "ai_copilot",
    label: "Copiloto IA (Gemini)",
    icon: "✨",
    category: "inteligencia",
    dimensions: { funcional: 80, datos: 60, integracion: 75, seguridad: 78, operacional: 60 },
    estado: "beta",
    notes: "Chat conversacional con Gemini 1.5 Flash. Integrado en Node.js monolito. " +
      "Jul-2026: prueba de integración reescrita para reflejar el bridge real a Gemini (antes probaba un " +
      "bridge a un backend PHP que ya no existe) y RBAC verificado.",
  },
  {
    id: "alerts",
    label: "Alertas IRAT",
    icon: "🔔",
    category: "inteligencia",
    dimensions: { funcional: 88, datos: 78, integracion: 90, seguridad: 80, operacional: 80 },
    estado: "produccion",
    notes: "Umbrales configurables. Jul-2026: conectado el tramo que faltaba — las alertas de " +
      "severidad alta/crítica ahora encolan un correo real a los admin_municipal del tenant, y el " +
      "barrido horario de automation-service las despacha de verdad (antes quedaban solo como " +
      "registro pasivo en pantalla, sin avisar a nadie proactivamente). Jul-2026 (sesión Ley 2046): " +
      "se encontró y corrigió el bug real que explicaba por qué ese correo nunca salía — el INSERT en " +
      "notifications violaba siempre chk_notifications_reference_present (no pasaba incident_id/" +
      "logistics_order_id/offer_id) y quedaba silenciado por un catch vacío. Se agregó la columna " +
      "institutional_alert_id y se amplió el CHECK; verificado end-to-end contra Neon (alerta real → " +
      "notificación de email real insertada, dentro de una transacción revertida).",
  },
  {
    id: "ley2046",
    label: "Cumplimiento Ley 2046",
    icon: "⚖️",
    category: "inteligencia",
    dimensions: { funcional: 78, datos: 58, integracion: 82, seguridad: 78, operacional: 55 },
    estado: "beta",
    notes: "Nuevo (jul-2026): calcula por institución el % de compra directa a pequeños productores " +
      "sobre lo registrado en entregas_productos/entregas_detalle (mínimo legal 30%, Ley 2046 de 2020), " +
      "con estado cumple/riesgo/incumple, alerta automática (compra_local_insuficiente) integrada al " +
      "mismo barrido horario del IRAT, y exportación CSV/PDF pensada para Contraloría. Requirió agregar " +
      "producers.is_small_producer (default TRUE — sin ese campo no existía forma de calcular el " +
      "numerador). Limitación honesta: el % solo cubre lo que la institución registra dentro de " +
      "AgroRed, no la totalidad de su presupuesto de alimentos fuera del sistema — es una herramienta " +
      "de trazabilidad, no una fuente de verdad sobre gasto público externo. Puntaje de datos bajo " +
      "porque is_small_producer aún no se ha curado con criterio real por productor (todo en default).",
  },
  {
    id: "notifications",
    label: "Notificaciones",
    icon: "✉️",
    category: "inteligencia",
    dimensions: { funcional: 85, datos: 70, integracion: 80, seguridad: 80, operacional: 70 },
    estado: "produccion",
    notes: "Email via SMTP + BullMQ. Worker asíncrono con reintentos. " +
      "Jul-2026: cobertura E2E completa nueva (7/7), incluyendo verificación de RBAC por rol.",
  },
  // ── INFRAESTRUCTURA ───────────────────────────────────────────
  {
    id: "territorial",
    label: "Maestras Territoriales",
    icon: "🗾",
    category: "infraestructura",
    dimensions: { funcional: 90, datos: 95, integracion: 85, seguridad: 85, operacional: 70 },
    estado: "produccion",
    notes: "Departamentos, municipios, corregimientos, veredas. Datos DANE cargados. " +
      "Jul-2026: cobertura E2E completa nueva (8/8), incluyendo autenticación y validación de payloads.",
  },
  {
    id: "map",
    label: "Mapa Territorial (GIS)",
    icon: "🗺️",
    category: "infraestructura",
    dimensions: { funcional: 82, datos: 70, integracion: 78, seguridad: 70, operacional: 60 },
    estado: "beta",
    notes: "PostGIS, polígonos municipales, capas GeoJSON. Jul-2026: corregido un bug real en " +
      "PostgresMapRepository (casteaba geometría a texto WKB en vez de ST_AsGeoJSON, así que los " +
      "endpoints de jerarquía territorial devolvían siempre vacío). GIS queda en pausa por decisión " +
      "de producto — no se cargaron los polígonos GADM en Neon (el loader apunta a Postgres local, " +
      "no a producción). Retomar si el mapa territorial vuelve a priorizarse.",
  },
  {
    id: "fleet",
    label: "Flota en Tiempo Real",
    icon: "🚛",
    category: "infraestructura",
    dimensions: { funcional: 88, datos: 72, integracion: 85, seguridad: 68, operacional: 72 },
    estado: "beta",
    notes: "Posiciones GPS, geocercas logísticas. Jul-2026: agregado un simulador real que mueve " +
      "los recursos 'en_ruta' cada 10s (velocidad/rumbo reales del seed) y transmite por el mismo " +
      "canal SSE que consume el mapa en vivo — verificado moviéndose contra Neon. Sigue siendo " +
      "simulación, no GPS físico ni app móvil de conductores.",
  },
  {
    id: "automation",
    label: "Automatización",
    icon: "⚙️",
    category: "infraestructura",
    dimensions: { funcional: 85, datos: 65, integracion: 85, seguridad: 70, operacional: 68 },
    estado: "beta",
    notes: "BullMQ workers configurados. Jul-2026: el motor de ejecución de acciones " +
      "(ActionExecutionEngine) estaba desconectado — simulaba con un setTimeout y nunca se " +
      "invocaba desde ningún flujo real. Ahora despacha notificaciones pendientes de verdad y dejar " +
      "auditoría real (audit_log) para acciones que requieren decisión humana. También se corrigió " +
      "un bug que hacía fallar todo barrido programado (\"system\" no era un tenant real) — ahora " +
      "se ejecuta correctamente por cada municipio activo.",
  },
  {
    id: "multitenancy",
    label: "Multitenancy",
    icon: "🏢",
    category: "infraestructura",
    dimensions: { funcional: 80, datos: 85, integracion: 80, seguridad: 85, operacional: 70 },
    estado: "produccion",
    notes: "Todos los módulos filtran por tenant_id. Base para despliegue nacional. " +
      "Jul-2026: aislamiento por tenant reverificado en la matriz RBAC reparada del gateway.",
  },
];

const DIMS: { key: keyof ModuleMaturity["dimensions"]; label: string; color: string }[] = [
  { key: "funcional",    label: "Funcional",    color: "#4ade80" },
  { key: "datos",        label: "Datos",        color: "#22d3ee" },
  { key: "integracion",  label: "Integración",  color: "#a78bfa" },
  { key: "seguridad",    label: "Seguridad",    color: "#f87171" },
  { key: "operacional",  label: "Operacional",  color: "#f59e0b" },
];

function maturityScore(m: ModuleMaturity): number {
  const vals = Object.values(m.dimensions);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function scoreColor(s: number): string {
  return s >= 85 ? "#4ade80" : s >= 70 ? "#a3e635" : s >= 55 ? "#f59e0b" : s >= 40 ? "#fb923c" : "#f87171";
}

// ── Radar SVG mini ────────────────────────────────────────────
function MiniRadar({ dims, size = 72 }: { dims: ModuleMaturity["dimensions"]; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size * 0.4;
  const keys = Object.keys(dims) as (keyof typeof dims)[];
  const n = keys.length;
  const points = keys.map((k, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const v = dims[k] / 100;
    return { x: cx + r * v * Math.cos(angle), y: cy + r * v * Math.sin(angle) };
  });
  const gridPts = keys.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  const poly = points.map(p => `${p.x},${p.y}`).join(" ");
  const grid = gridPts.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={grid} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.8} />
      <polygon points={poly} fill="rgba(74,222,128,0.18)" stroke="#4ade80" strokeWidth={1.2} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill="#4ade80" />
      ))}
    </svg>
  );
}

// ── Barra de dimensión ────────────────────────────────────────
function DimBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

// ── Tarjeta de módulo ─────────────────────────────────────────
function ModuleCard({ module, onClick, selected }: {
  module: ModuleMaturity; onClick: () => void; selected: boolean;
}) {
  const score = maturityScore(module);
  const sColor = scoreColor(score);
  const est = ESTADO_CONFIG[module.estado];
  const catColor = CATEGORY_COLORS[module.category];

  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${selected ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 14, padding: "16px 18px", cursor: "pointer",
        transition: "all 0.2s",
        boxShadow: selected ? "0 0 0 1px rgba(74,222,128,0.2)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{module.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{module.label}</div>
            <div style={{ fontSize: 10, color: catColor, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 1 }}>
              {module.category}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: sColor, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>/ 100</div>
        </div>
      </div>

      {/* Mini radar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <MiniRadar dims={module.dimensions} size={68} />
        <div style={{ flex: 1 }}>
          {DIMS.map(d => (
            <DimBar key={d.key} label={d.label} value={module.dimensions[d.key]} color={d.color} />
          ))}
        </div>
      </div>

      {/* Estado badge */}
      <div style={{ marginTop: 10 }}>
        {est && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12,
            background: est.bg, color: est.color,
            border: `1px solid ${est.color}33`,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>{est.label}</span>
        )}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export function MaturityPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Carga de conteos reales de BD para enriquecer el mapa
  useEffect(() => {
    const endpoints: { id: string; path: string }[] = [
      { id: "users",       path: "/api/v1/users?limit=1" },
      { id: "producers",   path: "/api/v1/producers?limit=1" },
      { id: "institutions",path: "/api/v1/institutions?limit=1" },
      { id: "offers",      path: "/api/v1/offers?limit=1" },
      { id: "rescues",     path: "/api/v1/rescues?limit=1" },
      { id: "demands",     path: "/api/v1/demands?limit=1" },
      { id: "deliveries",  path: "/api/v1/entregas?limit=1" },
    ];
    endpoints.forEach(({ id, path }) => {
      api<any>(path).then(r => {
        if (r.ok) {
          const total = r.data?.meta?.total ?? r.data?.total
            ?? (Array.isArray(r.data) ? r.data.length : undefined);
          if (total !== undefined) {
            setCounts(prev => ({ ...prev, [id]: Number(total) }));
          }
        }
      });
    });
  }, []);

  const filtered = MODULES.filter(m =>
    categoryFilter === "all" || m.category === categoryFilter
  );

  const selectedModule = MODULES.find(m => m.id === selected);

  // Métricas globales
  const globalScore = Math.round(MODULES.reduce((a, m) => a + maturityScore(m), 0) / MODULES.length);
  const globalColor = scoreColor(globalScore);
  const byEstado = {
    produccion: MODULES.filter(m => m.estado === "produccion").length,
    beta:       MODULES.filter(m => m.estado === "beta").length,
    desarrollo: MODULES.filter(m => m.estado === "desarrollo").length,
    planeado:   MODULES.filter(m => m.estado === "planeado").length,
  };

  const dimAverages = DIMS.map(d => ({
    ...d,
    avg: Math.round(MODULES.reduce((a, m) => a + m.dimensions[d.key], 0) / MODULES.length),
  }));

  const glass: React.CSSProperties = {
    background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16,
  };

  return (
    <div style={{ color: "#fff", maxWidth: 1300, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(74,222,128,0.7)", marginBottom: 6 }}>
          AgroRed · Evaluación Técnica
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em",
          background: "linear-gradient(120deg,#4ade80 0%,#22d3ee 50%,#a78bfa 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Mapa de Madurez Global del Proyecto
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)", maxWidth: 640 }}>
          Evaluación multidimensional de {MODULES.length} módulos en 5 ejes: Funcional, Datos, Integración, Seguridad y Operacional.
          Última actualización: julio 2026.
        </p>
      </div>

      {/* ── KPIs globales ── */}
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", marginBottom: 28 }}>
        {/* Score global */}
        <div style={{ ...glass, padding: "20px 22px", gridColumn: "span 2", background: `linear-gradient(135deg, ${globalColor}0a, rgba(255,255,255,0.02))`, borderColor: `${globalColor}22` }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 700 }}>
            Madurez Global del Proyecto
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: globalColor, lineHeight: 1, letterSpacing: "-0.03em" }}>
              {globalScore}
            </div>
            <div style={{ paddingBottom: 6 }}>
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.3)" }}>/ 100</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: globalColor, marginTop: 2 }}>
                {globalScore >= 80 ? "Maduro" : globalScore >= 65 ? "En consolidación" : globalScore >= 50 ? "En desarrollo" : "Inicial"}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${globalScore}%`, height: "100%",
              background: `linear-gradient(to right, ${globalColor}66, ${globalColor})`,
              borderRadius: 3, transition: "width 1s ease" }} />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
            {MODULES.length} módulos evaluados · Monolito TypeScript + PostgreSQL en Neon · React frontend
          </div>
        </div>

        {/* Por estado */}
        {(["produccion", "beta", "desarrollo", "planeado"] as const).map((key, ki) => {
          const icons = ["✅", "🧪", "🔧", "📋"];
          const icon = icons[ki];
          const est = ESTADO_CONFIG[key]!;
          return (
            <div key={key} style={{ ...glass, padding: "16px 18px", borderColor: `${est.color}22` }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                {icon} {est.label}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: est.color }}>
                {byEstado[key]}
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>módulos</div>
            </div>
          );
        })}
      </div>

      {/* ── Promedios por dimensión ── */}
      <div style={{ ...glass, padding: "20px 24px", marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>
          Promedio por Dimensión — todos los módulos
        </div>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))" }}>
          {dimAverages.map(d => (
            <div key={d.key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>{d.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: d.color }}>{d.avg}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${d.avg}%`, height: "100%", background: `linear-gradient(to right, ${d.color}66, ${d.color})`, borderRadius: 3, transition: "width 0.8s" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filtros de categoría ── */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[{ key: "all", label: "Todos", color: "#fff" },
          { key: "core",            label: "Core",            color: CATEGORY_COLORS.core },
          { key: "operaciones",     label: "Operaciones",     color: CATEGORY_COLORS.operaciones },
          { key: "inteligencia",    label: "Inteligencia",    color: CATEGORY_COLORS.inteligencia },
          { key: "infraestructura", label: "Infraestructura", color: CATEGORY_COLORS.infraestructura },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setCategoryFilter(f.key)}
            style={{
              padding: "6px 16px", borderRadius: 20, border: `1px solid ${f.color}44`,
              background: categoryFilter === f.key ? `${f.color}18` : "rgba(255,255,255,0.03)",
              color: categoryFilter === f.key ? f.color : "rgba(255,255,255,0.4)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            }}
          >{f.label} {f.key !== "all" && `(${MODULES.filter(m => m.category === f.key).length})`}</button>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center" }}>
          Clic en un módulo para ver detalles
        </div>
      </div>

      {/* ── Grid de módulos + panel de detalle ── */}
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: selectedModule ? "minmax(0,1.6fr) minmax(320px,1fr)" : "1fr" }}>
        {/* Grid de tarjetas */}
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", alignContent: "start" }}>
          {filtered.map(m => (
            <ModuleCard
              key={m.id}
              module={m}
              selected={selected === m.id}
              onClick={() => setSelected(selected === m.id ? null : m.id)}
            />
          ))}
        </div>

        {/* Panel de detalle lateral */}
        {selectedModule && (
          <div style={{ ...glass, padding: "22px 24px", position: "sticky", top: 20, alignSelf: "start", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 26 }}>{selectedModule.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedModule.label}</div>
                  <div style={{ fontSize: 10, color: CATEGORY_COLORS[selectedModule.category], textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {selectedModule.category}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelected(null)}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.4)", borderRadius: 8, padding: "4px 10px",
                  cursor: "pointer", fontSize: 14 }}>×</button>
            </div>

            {/* Score grande */}
            <div style={{ textAlign: "center", marginBottom: 20, padding: "16px 0",
              background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 60, fontWeight: 900, color: scoreColor(maturityScore(selectedModule)), lineHeight: 1 }}>
                {maturityScore(selectedModule)}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Madurez global</div>
              <div style={{ marginTop: 8 }}>
                {(() => {
                  const detEst = ESTADO_CONFIG[selectedModule.estado];
                  return detEst ? (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 12,
                      background: detEst.bg, color: detEst.color,
                      border: `1px solid ${detEst.color}33`,
                    }}>{detEst.label}</span>
                  ) : null;
                })()}
              </div>
            </div>

            {/* Radar grande */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <MiniRadar dims={selectedModule.dimensions} size={140} />
            </div>

            {/* Barras de dimensiones */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.35)", marginBottom: 12 }}>Dimensiones</div>
              {DIMS.map(d => (
                <div key={d.key} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{d.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: d.color }}>
                      {selectedModule.dimensions[d.key]}
                    </span>
                  </div>
                  <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${selectedModule.dimensions[d.key]}%`, height: "100%",
                      background: `linear-gradient(to right,${d.color}66,${d.color})`,
                      borderRadius: 3, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Datos reales de BD si disponibles */}
            {(() => {
              const liveCount = counts[selectedModule.id];
              return liveCount !== undefined ? (
                <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(74,222,128,0.06)",
                  border: "1px solid rgba(74,222,128,0.15)", borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: "rgba(74,222,128,0.7)", textTransform: "uppercase",
                    letterSpacing: "0.08em", marginBottom: 4 }}>Registros en BD (live)</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#4ade80" }}>
                    {liveCount.toLocaleString("es-CO")}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Notas */}
            <div style={{ padding: "12px 14px", background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textTransform: "uppercase",
                letterSpacing: "0.08em", marginBottom: 6 }}>Estado y observaciones</div>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
                {selectedModule.notes}
              </p>
            </div>

            {/* Recomendaciones por score */}
            {maturityScore(selectedModule) < 75 && (
              <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: "#f59e0b", textTransform: "uppercase",
                  letterSpacing: "0.08em", marginBottom: 6 }}>⚡ Áreas de mejora prioritaria</div>
                {DIMS.filter(d => selectedModule.dimensions[d.key] < 70).map(d => (
                  <div key={d.key} style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 3 }}>
                    • {d.label}: {selectedModule.dimensions[d.key]}/100
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Hoja de ruta ── */}
      <div style={{ ...glass, padding: "22px 24px", marginTop: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.4)", marginBottom: 18 }}>Hoja de Ruta para Madurez ≥85 / Producción Nacional</div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
          {[
            { icon: "🗺️", title: "Confirmar carga GIS en Neon", desc: "En pausa por decisión de producto (jul-2026): GIS no es prioridad por ahora. El loader actual apunta a Postgres local, no a Neon — retomar esto si el mapa territorial vuelve a priorizarse.", prioridad: "En pausa" },
            { icon: "🚛", title: "GPS real en flota", desc: "Integrar dispositivos GPS reales o app móvil para tracking en tiempo real (hoy la flota se mueve por simulador, no por GPS físico).", prioridad: "Media" },
            { icon: "📬", title: "Trazabilidad entregas", desc: "Aumentar cobertura operacional del módulo de entregas con uso diario por municipio.", prioridad: "Alta" },
            { icon: "⚙️", title: "Automatizar acciones de negocio", desc: "Hoy solo el despacho de notificaciones se ejecuta de verdad; acciones como programar logística o rebalancear inventario aún requieren decisión humana (quedan auditadas, no ejecutadas).", prioridad: "Media" },
            { icon: "📊", title: "Estacionalidad en ML", desc: "Extender la dimensión de tendencia (30d vs. 30d previos) a patrones estacionales usando los 14 meses de histórico ya sembrados.", prioridad: "Media" },
            { icon: "📱", title: "App móvil productores", desc: "Habilitar app móvil para registro de entregas y ofertas desde campo.", prioridad: "Alta" },
            { icon: "⚖️", title: "Curar clasificación de pequeño productor", desc: "producers.is_small_producer quedó en TRUE por defecto para todos; falta un criterio auditable real (UAF, volumen, registro ante la entidad territorial) para que el % de cumplimiento Ley 2046 sea defendible ante Contraloría, no solo una cifra por defecto.", prioridad: "Alta" },
          ].map(item => {
            const pColor = item.prioridad === "Alta" ? "#f87171" : item.prioridad === "Media" ? "#f59e0b" : "#6b7280";
            return (
              <div key={item.title} style={{ padding: "14px 16px", background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{item.title}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
                    background: `${pColor}15`, color: pColor, border: `1px solid ${pColor}30` }}>
                    {item.prioridad}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
    </div>
  );
}
