import { useEffect, useState, useCallback } from "react";
import {
  fetchIrat, fetchAlerts, generateAlerts, acknowledgeAlert,
  fetchLey2046, generateLey2046Alerts, downloadLey2046Report,
} from "../services/alerts";
import { useAuth } from "../hooks/useAuth";

/* ── Constantes IRAT ────────────────────────────────────────────── */
const IRAT_LEVELS = [
  { min: 0,  max: 20,  label: "Muy Bajo",  color: "#10b981", bg: "rgba(16,185,129,0.08)" },
  { min: 21, max: 40,  label: "Bajo",      color: "#4ade80", bg: "rgba(74,222,128,0.08)" },
  { min: 41, max: 60,  label: "Medio",     color: "#facc15", bg: "rgba(250,204,21,0.08)" },
  { min: 61, max: 80,  label: "Alto",      color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  { min: 81, max: 100, label: "Muy Alto",  color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
];

function getIratLevel(score: number) {
  return IRAT_LEVELS.find(l => score >= l.min && score <= l.max) ?? IRAT_LEVELS[4]!;
}

const DIMENSIONS = [
  { key: "disponibilidad", label: "Disponibilidad Alimentaria",    icon: "🌾",
    desc: "Oferta agrícola local, diversidad de productos, abastecimiento de mercados.",
    tooltip: "Producción agropecuaria + variedad de oferta disponible" },
  { key: "acceso",         label: "Acceso a los Alimentos",        icon: "💰",
    desc: "Nivel de demanda cubierta, distancia a centros de abastecimiento, poder adquisitivo.",
    tooltip: "Demandas abiertas, precios y cobertura programas" },
  { key: "consumo",        label: "Consumo y Utilización Biológica",icon: "🥗",
    desc: "Estado nutricional, beneficiarios activos, calidad de los alimentos rescatados.",
    tooltip: "Beneficiarios cubiertos, rescates completados" },
  { key: "estabilidad",    label: "Estabilidad Alimentaria",       icon: "⚡",
    desc: "Incidentes activos, riesgos climáticos, variabilidad de precios.",
    tooltip: "Incidentes críticos y logística activa" },
  { key: "institucional",  label: "Capacidad Institucional",       icon: "🏛️",
    desc: "Programas alimentarios activos, cobertura territorial, respuesta ante emergencias.",
    tooltip: "Programas activos y cobertura de beneficiarios" },
];

function computeDimensions(s: any): Record<string, number> {
  const offerRatio   = Math.min(100, (s.totalOffers ?? 0) * 5 + (s.totalOfferQuantity ?? 0) / 100);
  const demandGap    = Math.min(100, (s.openDemands ?? 0) * 8 + (s.totalDemandQuantity ?? 0) / 80);
  const rescueScore  = Math.min(100, (s.scheduledRescues ?? 0) * 6 + (s.totalRescuedQuantity ?? 0) / 50);
  const incidentScore= Math.min(100, (s.openIncidents ?? 0) * 5 + (s.criticalIncidents ?? 0) * 15);
  const coverage     = Math.min(100, (s.programCoverage ?? 0));

  return {
    disponibilidad: Math.round(Math.max(0, 100 - offerRatio)),
    acceso:         Math.round(Math.min(100, demandGap * 0.7 + (100 - coverage) * 0.3)),
    consumo:        Math.round(Math.max(0, 100 - rescueScore * 0.6 - (s.totalBeneficiaries ?? 0) * 0.02)),
    estabilidad:    Math.round(Math.min(100, incidentScore)),
    institucional:  Math.round(Math.max(0, 100 - coverage * 0.6 - (s.activePrograms ?? 0) * 3)),
  };
}

/* ── Colores por severidad ─────────────────────────────────────── */
const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444", high: "#f59e0b", medium: "#60a5fa", low: "#94a3b8",
};
const SEV_LABEL: Record<string, string> = {
  critical: "Crítica", high: "Alta", medium: "Media", low: "Baja",
};
const TYPE_ICON: Record<string, string> = {
  irat_alto:         "🔴", desabastecimiento: "📦",
  exceso_sin_destino:"📤", baja_cobertura:    "👥",
  compra_local_insuficiente: "⚖️",
};

/* ── Ley 2046/2020 — Cumplimiento de compra local ─────────────────── */
const LEY2046_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  cumple:    { label: "Cumple",     color: "#4ade80", bg: "rgba(74,222,128,0.1)" },
  riesgo:    { label: "En riesgo",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  incumple:  { label: "Incumple",   color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  sin_datos: { label: "Sin datos",  color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
};

const INSTITUTION_TYPE_ICON: Record<string, string> = {
  educational: "🏫", hospital: "🏥", prison: "⛓️", community_canteen: "🍲",
  airport: "✈️", military: "🪖", elderly_home: "🧓", shelter: "🏠", other: "🏛️",
};

function formatCOP(value: number): string {
  return "$" + Math.round(value).toLocaleString("es-CO");
}

function Ley2046Panel({ tenantId }: { tenantId?: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchLey2046(tenantId);
    if (r.ok) setRows(Array.isArray(r.data) ? r.data : []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (!tenantId) return;
    setGenerating(true);
    setFeedback(null);
    const r = await generateLey2046Alerts(tenantId);
    setGenerating(false);
    if (r.ok) {
      setFeedback(`${r.data.generated} alerta(s) de cumplimiento generada(s).`);
      load();
    } else {
      setFeedback("No fue posible verificar el cumplimiento.");
    }
  };

  const handleExport = async (format: "csv" | "pdf") => {
    if (!tenantId) return;
    setExporting(format);
    const ok = await downloadLey2046Report(tenantId, format);
    setExporting(null);
    if (!ok) setFeedback("No fue posible descargar el reporte.");
  };

  const withData = rows.filter(r => r.status !== "sin_datos");
  const incumple = rows.filter(r => r.status === "incumple").length;
  const riesgo   = rows.filter(r => r.status === "riesgo").length;
  const cumple   = rows.filter(r => r.status === "cumple").length;
  const avgPct   = withData.length > 0
    ? Math.round(withData.reduce((s, r) => s + r.compliancePct, 0) / withData.length)
    : 0;

  const sorted = [...rows].sort((a, b) => a.compliancePct - b.compliancePct);

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>
            ⚖️ Cumplimiento Ley 2046 de 2020 — Compra Local a Pequeños Productores
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            Mínimo legal: 30% del valor de compra pública directo a pequeños productores del territorio.
            Calculado sobre las entregas rastreadas en AgroRed (año en curso).
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handleGenerate} disabled={generating || !tenantId}
            style={{ background: "linear-gradient(135deg,#f59e0b,#ef4444)", color: "#fff", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, cursor: generating ? "not-allowed" : "pointer", fontSize: 12, opacity: generating ? 0.6 : 1 }}>
            {generating ? "Verificando…" : "🔄 Verificar cumplimiento"}
          </button>
          <button onClick={() => handleExport("csv")} disabled={exporting !== null || !tenantId}
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            {exporting === "csv" ? "…" : "⬇️ CSV"}
          </button>
          <button onClick={() => handleExport("pdf")} disabled={exporting !== null || !tenantId}
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            {exporting === "pdf" ? "…" : "⬇️ PDF (Contraloría)"}
          </button>
        </div>
      </div>

      {feedback && (
        <div style={{ fontSize: 12, color: "#f59e0b", marginBottom: 12 }}>{feedback}</div>
      )}

      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Calculando cumplimiento…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: 16, textAlign: "center" }}>
          Sin instituciones registradas para este municipio.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", marginBottom: 16 }}>
            <div style={{ padding: "10px 14px", background: "rgba(74,222,128,0.08)", borderRadius: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#4ade80" }}>{cumple}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Cumplen</div>
            </div>
            <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.08)", borderRadius: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b" }}>{riesgo}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>En riesgo</div>
            </div>
            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", borderRadius: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#ef4444" }}>{incumple}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Incumplen</div>
            </div>
            <div style={{ padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{avgPct}%</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Promedio compra local</div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "rgba(255,255,255,0.4)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <th style={{ padding: "6px 10px" }}>Institución</th>
                  <th style={{ padding: "6px 10px" }}>Municipio</th>
                  <th style={{ padding: "6px 10px" }}>Valor rastreado</th>
                  <th style={{ padding: "6px 10px" }}>% compra local</th>
                  <th style={{ padding: "6px 10px" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(r => {
                  const st = LEY2046_STATUS[r.status] ?? LEY2046_STATUS.sin_datos!;
                  return (
                    <tr key={r.institutionId} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px 10px", color: "#fff" }}>
                        {INSTITUTION_TYPE_ICON[r.institutionType] ?? "🏛️"} {r.institutionName}
                      </td>
                      <td style={{ padding: "8px 10px", color: "rgba(255,255,255,0.5)" }}>{r.municipalityName}</td>
                      <td style={{ padding: "8px 10px", color: "rgba(255,255,255,0.5)" }}>{formatCOP(r.totalValue)}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: st.color }}>
                        {r.status === "sin_datos" ? "—" : `${r.compliancePct}%`}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ── IRAT Card completa ────────────────────────────────────────── */
function IratCard({ s }: { s: any }) {
  const level   = getIratLevel(s.iratScore);
  const dims    = computeDimensions(s);
  const [open, setOpen] = useState(false);

  return (
    <div style={{ background: level.bg, border: `1px solid ${level.color}33`, borderRadius: 16, padding: "16px 20px", minWidth: 260, cursor: "pointer" }}
      onClick={() => setOpen(v => !v)}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{s.tenantName ?? s.tenantCode}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Código: {s.tenantCode}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: level.color, lineHeight: 1 }}>{s.iratScore.toFixed(1)}</div>
          <div style={{ fontSize: 10, color: level.color, fontWeight: 700 }}>{level.label}</div>
        </div>
      </div>
      {/* Score bar */}
      <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, marginBottom: 10, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, s.iratScore)}%`, height: "100%", background: level.color, borderRadius: 3, transition: "width .5s" }} />
      </div>
      {/* Quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, fontSize: 11 }}>
        <div style={{ color: "rgba(255,255,255,0.5)" }}>🌾 {s.totalOffers} ofertas</div>
        <div style={{ color: "rgba(255,255,255,0.5)" }}>🍽️ {s.openDemands} demandas</div>
        <div style={{ color: "rgba(255,255,255,0.5)" }}>👥 {s.totalBeneficiaries}</div>
        <div style={{ color: "rgba(255,255,255,0.5)" }}>♻️ {s.scheduledRescues} rescates</div>
        <div style={{ color: s.criticalIncidents > 0 ? "#f87171" : "rgba(255,255,255,0.5)" }}>⚠️ {s.openIncidents} incidentes</div>
        <div style={{ color: "rgba(255,255,255,0.5)" }}>📋 {s.activePrograms} programas</div>
      </div>

      {/* Expandable dimensions */}
      {open && (
        <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>Desglose por Dimensión IRAT</div>
          {DIMENSIONS.map(d => {
            const val = dims[d.key] ?? 0;
            const lv = getIratLevel(val);
            return (
              <div key={d.key} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{d.icon} {d.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: lv.color }}>{val} — {lv.label}</span>
                </div>
                <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${val}%`, height: "100%", background: lv.color, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>{d.desc}</div>
              </div>
            );
          })}
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 8, padding: "6px 8px", background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
            ℹ️ Scores aproximados calculados desde indicadores operacionales del sistema. Ver metodología completa en el módulo de Analítica.
          </div>
        </div>
      )}
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 8, textAlign: "center" }}>
        {open ? "▲ Ocultar desglose" : "▼ Ver desglose por dimensión"}
      </div>
    </div>
  );
}

/* ── Referencia metodología ────────────────────────────────────── */
function IratReference() {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 12 }}>📘 Metodología IRAT — Índice de Riesgo Alimentario Territorial</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10, marginBottom: 16 }}>
        {DIMENSIONS.map(d => (
          <div key={d.key} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{d.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{d.label}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{d.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>Clasificación de Niveles de Riesgo</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {IRAT_LEVELS.map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: l.bg, border: `1px solid ${l.color}33` }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: l.color }}>{l.min}–{l.max}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Página principal ──────────────────────────────────────────── */
export function AlertsPage() {
  const { user } = useAuth();
  const [iratScores, setIratScores]     = useState<any[]>([]);
  const [alerts, setAlerts]             = useState<any[]>([]);
  const [loadingIrat, setLoadingIrat]   = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [generating, setGenerating]     = useState(false);
  const [ackMap, setAckMap]             = useState<Record<string, boolean>>({});
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterAck, setFilterAck]           = useState<"all" | "pending" | "acknowledged">("pending");
  const [showRef, setShowRef]               = useState(false);

  const loadIrat = useCallback(async () => {
    setLoadingIrat(true);
    const r = await fetchIrat();
    if (r.ok) setIratScores(Array.isArray(r.data) ? r.data : []);
    setLoadingIrat(false);
  }, []);

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    const r = await fetchAlerts(1, 100);
    if (r.ok) setAlerts(Array.isArray(r.data) ? r.data : []);
    setLoadingAlerts(false);
  }, []);

  useEffect(() => { loadIrat(); loadAlerts(); }, [loadIrat, loadAlerts]);

  const handleGenerate = async () => {
    if (!user?.tenantId) return;
    setGenerating(true);
    const r = await generateAlerts(user.tenantId);
    setGenerating(false);
    if (r.ok) loadAlerts();
  };

  const handleAcknowledge = async (alertId: string) => {
    if (!user?.email) return;
    setAckMap(m => ({ ...m, [alertId]: true }));
    await acknowledgeAlert(alertId, user.email);
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, isAcknowledged: true, acknowledgedBy: user.email } : a));
  };

  const filtered = alerts.filter(a => {
    if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
    if (filterAck === "pending"      && a.isAcknowledged) return false;
    if (filterAck === "acknowledged" && !a.isAcknowledged) return false;
    return true;
  });

  const pendingCount   = alerts.filter(a => !a.isAcknowledged).length;
  const criticalCount  = alerts.filter(a => a.severity === "critical" && !a.isAcknowledged).length;
  const myTenantScore  = iratScores.find(s => s.tenantId === user?.tenantId) ?? null;

  const inp: React.CSSProperties = {
    padding: "8px 12px", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
    color: "#fff", fontSize: 12, outline: "none",
  };

  return (
    <div style={{ color: "#fff", maxWidth: 1300, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#ef4444,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Alertas y Riesgo Alimentario (IRAT)
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {pendingCount} alertas pendientes
            {criticalCount > 0 ? <> · <span style={{ color: "#ef4444", fontWeight: 700 }}>{criticalCount} críticas</span></> : " · sin alertas críticas"}
            {" · "}{iratScores.length} municipios monitoreados
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowRef(v => !v)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
            📘 {showRef ? "Ocultar" : "Metodología"} IRAT
          </button>
          <button onClick={handleGenerate} disabled={generating}
            style={{ background: generating ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#ef4444,#f59e0b)", color: generating ? "rgba(255,255,255,0.4)" : "#fff", border: "none", borderRadius: 12, padding: "10px 22px", fontWeight: 700, cursor: generating ? "not-allowed" : "pointer", fontSize: 14 }}>
            {generating ? "Generando…" : "⚡ Generar alertas"}
          </button>
        </div>
      </div>

      {/* ── Referencia IRAT ────────────────────────────────── */}
      {showRef && <IratReference />}

      {/* ── Panel mi municipio ─────────────────────────────── */}
      {myTenantScore && (
        <div style={{ padding: "16px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>MI MUNICIPIO:</div>
          {(() => {
            const lv = getIratLevel(myTenantScore.iratScore);
            return (
              <>
                <span style={{ fontSize: 22, fontWeight: 800, color: lv.color }}>{myTenantScore.iratScore.toFixed(1)}</span>
                <span style={{ padding: "4px 14px", borderRadius: 20, background: lv.bg, color: lv.color, fontWeight: 700, fontSize: 12 }}>{lv.label}</span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{myTenantScore.tenantName} · {myTenantScore.activePrograms} programas · {myTenantScore.totalBeneficiaries} beneficiarios</span>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Cumplimiento Ley 2046 (compra local) ────────────── */}
      <Ley2046Panel tenantId={user?.tenantId} />

      {/* ── IRAT por municipio ──────────────────────────────── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".06em" }}>
          Índice IRAT por Municipio — Haz clic para ver desglose por dimensión
        </div>
        {loadingIrat ? (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Calculando IRAT…</div>
        ) : iratScores.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, padding: "20px", textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: 12 }}>
            Sin datos IRAT disponibles. Verifica que el analytics-service esté activo y haya datos en la BD.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {iratScores.map((s: any) => <IratCard key={s.tenantId} s={s} />)}
          </div>
        )}
      </div>

      {/* ── Filtros de alertas ─────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} style={inp}>
          <option value="all">Todas las severidades</option>
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, overflow: "hidden" }}>
          {(["pending", "all", "acknowledged"] as const).map(v => (
            <button key={v} onClick={() => setFilterAck(v)} style={{ padding: "8px 14px", background: filterAck === v ? "rgba(239,68,68,0.15)" : "transparent", color: filterAck === v ? "#ef4444" : "rgba(255,255,255,0.4)", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              {v === "pending" ? "Pendientes" : v === "acknowledged" ? "Reconocidas" : "Todas"}
            </button>
          ))}
        </div>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{filtered.length} alertas</span>
      </div>

      {/* ── Lista de alertas ───────────────────────────────── */}
      {loadingAlerts ? (
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Cargando alertas…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 14, background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
          {filterAck === "pending" ? "No hay alertas pendientes. ¡Sistema en buen estado!" : "No hay alertas que coincidan con los filtros."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((alert: any) => {
            const color  = SEV_COLOR[alert.severity]  ?? "#94a3b8";
            const icon   = TYPE_ICON[alert.alertType] ?? "⚠️";
            const isAck  = alert.isAcknowledged || ackMap[alert.id];
            return (
              <div key={alert.id} style={{ background: isAck ? "rgba(255,255,255,0.015)" : `${color}08`, border: `1px solid ${isAck ? "rgba(255,255,255,0.07)" : color + "33"}`, borderRadius: 14, padding: "16px 20px", display: "flex", gap: 16, alignItems: "flex-start", opacity: isAck ? 0.6 : 1, transition: "opacity .2s" }}>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 24 }}>{icon}</span>
                  <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${color}20`, color, border: `1px solid ${color}33` }}>
                    {SEV_LABEL[alert.severity] ?? alert.severity}
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: isAck ? "rgba(255,255,255,0.4)" : "#fff", marginBottom: 4 }}>{alert.title}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>{alert.description}</div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                    {alert.indicatorName && (
                      <span>📊 {alert.indicatorName}: <strong style={{ color: "rgba(255,255,255,0.6)" }}>{alert.indicatorValue?.toFixed(1)}</strong> (umbral {alert.thresholdValue})</span>
                    )}
                    {alert.zoneName && <span>📍 {alert.zoneName}</span>}
                    <span>🕐 {new Date(alert.createdAt).toLocaleDateString("es-CO")} {new Date(alert.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
                    {alert.autoGenerated && <span style={{ color: "#60a5fa" }}>🤖 Auto-generada</span>}
                  </div>
                  {isAck && alert.acknowledgedBy && (
                    <div style={{ marginTop: 6, fontSize: 11, color: "#4ade80" }}>
                      ✓ Reconocida por {alert.acknowledgedBy}{alert.acknowledgedAt && ` · ${new Date(alert.acknowledgedAt).toLocaleDateString("es-CO")}`}
                    </div>
                  )}
                </div>

                {!isAck && (
                  <button onClick={() => handleAcknowledge(alert.id)}
                    style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontSize: 12, fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap" }}>
                    ✓ Reconocer
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
