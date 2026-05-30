import { useEffect, useState, useCallback } from "react";
import { fetchIrat, fetchAlerts, generateAlerts, acknowledgeAlert } from "../services/alerts";
import { useAuth } from "../hooks/useAuth";

/* ── Colores por severidad ─────────────────────────────────────── */
const SEV_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high:     "#f59e0b",
  medium:   "#60a5fa",
  low:      "#94a3b8",
};
const SEV_LABEL: Record<string, string> = {
  critical: "Crítica",
  high:     "Alta",
  medium:   "Media",
  low:      "Baja",
};

const TYPE_ICON: Record<string, string> = {
  irat_alto:         "🔴",
  desabastecimiento: "📦",
  exceso_sin_destino:"📤",
  baja_cobertura:    "👥",
};

/* ── IRAT gauge ────────────────────────────────────────────────── */
function IratGauge({ score, name }: { score: number; name: string }) {
  const color = score >= 80 ? "#ef4444" : score >= 60 ? "#f59e0b" : score >= 40 ? "#facc15" : "#4ade80";
  const pct   = Math.min(100, Math.max(0, score));
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${color}22`, borderRadius: 12, padding: "14px 18px", minWidth: 150 }}>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>
        {name}
      </div>
      {/* Bar */}
      <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, marginBottom: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width .5s" }} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{score.toFixed(1)}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>/ 100</div>
    </div>
  );
}

/* ── Página principal ──────────────────────────────────────────── */
export function AlertsPage() {
  const { user } = useAuth();
  const [iratScores, setIratScores] = useState<any[]>([]);
  const [alerts, setAlerts]         = useState<any[]>([]);
  const [loadingIrat, setLoadingIrat]   = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [ackMap, setAckMap]         = useState<Record<string, boolean>>({});
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterAck, setFilterAck]           = useState<"all" | "pending" | "acknowledged">("pending");

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

  useEffect(() => {
    loadIrat();
    loadAlerts();
  }, [loadIrat, loadAlerts]);

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

  /* Filtros */
  const filtered = alerts.filter(a => {
    if (filterSeverity !== "all" && a.severity !== filterSeverity) return false;
    if (filterAck === "pending"      && a.isAcknowledged) return false;
    if (filterAck === "acknowledged" && !a.isAcknowledged) return false;
    return true;
  });

  /* Estadísticas rápidas */
  const pendingCount   = alerts.filter(a => !a.isAcknowledged).length;
  const criticalCount  = alerts.filter(a => a.severity === "critical" && !a.isAcknowledged).length;
  const myTenantScore  = iratScores.find(s => s.tenantId === user?.tenantId)?.iratScore ?? null;

  const inp: React.CSSProperties = {
    padding: "8px 12px", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
    color: "#fff", fontSize: 12, outline: "none",
  };

  return (
    <div style={{ color: "#fff", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#ef4444,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Alertas de Riesgo Alimentario
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {pendingCount} alertas pendientes · {criticalCount > 0 ? <span style={{ color: "#ef4444" }}>{criticalCount} críticas</span> : "sin críticas"}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{ background: generating ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#ef4444,#f59e0b)", color: generating ? "rgba(255,255,255,0.4)" : "#fff", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: generating ? "not-allowed" : "pointer", fontSize: 14 }}>
          {generating ? "Generando…" : "⚡ Generar alertas"}
        </button>
      </div>

      {/* ── IRAT scores ────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".06em" }}>
          Índice IRAT por municipio
        </div>
        {loadingIrat ? (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Calculando IRAT…</div>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {iratScores.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sin datos IRAT disponibles.</div>
            )}
            {iratScores.map((s: any) => (
              <IratGauge key={s.tenantId} score={s.iratScore} name={s.tenantCode ?? s.tenantName} />
            ))}
          </div>
        )}
        {myTenantScore !== null && (
          <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
            Tu municipio: IRAT = {myTenantScore.toFixed(1)} · {myTenantScore >= 80 ? "⚠️ Riesgo crítico" : myTenantScore >= 60 ? "🟡 Riesgo alto" : myTenantScore >= 40 ? "🟠 Riesgo medio" : "🟢 Riesgo bajo"}
          </div>
        )}
      </div>

      {/* ── Filtros ─────────────────────────────────────────────── */}
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

      {/* ── Lista de alertas ────────────────────────────────────── */}
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
              <div
                key={alert.id}
                style={{
                  background: isAck ? "rgba(255,255,255,0.015)" : `${color}08`,
                  border: `1px solid ${isAck ? "rgba(255,255,255,0.07)" : color + "33"}`,
                  borderRadius: 14, padding: "16px 20px",
                  display: "flex", gap: 16, alignItems: "flex-start",
                  opacity: isAck ? 0.6 : 1, transition: "opacity .2s",
                }}>

                {/* Icono + severidad */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 24 }}>{icon}</span>
                  <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${color}20`, color, border: `1px solid ${color}33` }}>
                    {SEV_LABEL[alert.severity] ?? alert.severity}
                  </span>
                </div>

                {/* Contenido */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: isAck ? "rgba(255,255,255,0.4)" : "#fff", marginBottom: 4 }}>
                    {alert.title}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
                    {alert.description}
                  </div>
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
                      ✓ Reconocida por {alert.acknowledgedBy}
                      {alert.acknowledgedAt && ` · ${new Date(alert.acknowledgedAt).toLocaleDateString("es-CO")}`}
                    </div>
                  )}
                </div>

                {/* Acción */}
                {!isAck && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
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
