import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { fetchSummary, fetchTerritorialOverview, fetchActiveResources } from "../services/dashboard";
import { KpiCard } from "../components/KpiCard";
import { OperationsRing } from "../components/OperationsRing";
import { TotalsTable } from "../components/TotalsTable";
import { ActiveFleet } from "../components/ActiveFleet";
import { TerritorialChart } from "../components/TerritorialChart";
import type { AnalyticsSummary, TerritorialOverviewItem, CurrentPosition } from "../types";

const glass: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 20,
};

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [territorial, setTerritorial] = useState<TerritorialOverviewItem[]>([]);
  const [fleet, setFleet] = useState<CurrentPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);

  const summaryTenantId = user?.tenantId;

  const load = useCallback(async () => {
    const [s, t, f] = await Promise.all([
      fetchSummary(summaryTenantId),
      fetchTerritorialOverview(),
      fetchActiveResources(user?.tenantId),
    ]);
    if (s.ok) setSummary(s.data);
    if (t.ok) setTerritorial(Array.isArray(t.data) ? t.data : []);
    if (f.ok) setFleet(Array.isArray(f.data) ? f.data : []);
    setUpdated(new Date());
    setLoading(false);
  }, [summaryTenantId, user?.tenantId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
        <div style={{ width: 48, height: 48, border: "3px solid rgba(255,255,255,0.06)", borderTop: "3px solid #4ade80", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Cargando tablero institucional…</div>
      </div>
    );
  }

  if (!summary && !loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ color: "#f87171", fontSize: 16, fontWeight: 600 }}>No se pudo cargar el tablero</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, maxWidth: 380, textAlign: "center" }}>
          El servicio de analítica no está disponible. Verifica que el analytics-service esté desplegado.
        </div>
        <button onClick={load} style={{ marginTop: 8, padding: "10px 24px", background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          ↺ Reintentar
        </button>
      </div>
    );
  }

  const iratRaw   = summary?.operations.iratScore ?? null;
  const iratValue = iratRaw !== null ? iratRaw.toFixed(1) : "—";
  const iratColor = iratRaw === null ? "#6b7280"
    : iratRaw >= 80 ? "#ef4444"
    : iratRaw >= 60 ? "#f59e0b"
    : iratRaw >= 40 ? "#facc15"
    : "#10b981";
  const iratLabel = iratRaw === null ? "Sin datos" : iratRaw >= 80 ? "Riesgo crítico" : iratRaw >= 60 ? "Riesgo alto" : iratRaw >= 40 ? "Riesgo medio" : "Riesgo bajo";

  const coberturaValue = summary?.operations.programCoverage ?? 0;

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", animation: "fadeIn 0.4s ease-out", display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(74,222,128,0.7)", marginBottom: 6 }}>
            AgroRed · Gobernanza Alimentaria
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", background: "linear-gradient(120deg, #4ade80 0%, #22d3ee 50%, #818cf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Tablero de Control Institucional
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
            {summary?.tenantName ?? "Vista del territorio"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {updated && (
            <div style={{ background: "rgba(74,222,128,0.08)", padding: "7px 14px", borderRadius: 24, fontSize: 12, color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 7, border: "1px solid rgba(74,222,128,0.15)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80", animation: "pulse 2s infinite", display: "block" }} />
              {updated.toLocaleTimeString()}
            </div>
          )}
          <button onClick={load} title="Actualizar" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "7px 14px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            ↺
          </button>
        </div>
      </div>

      {/* ── KPI estratégicos: IRAT + Cobertura ── */}
      {summary && (
        <div className="dashboard-feature-grid" style={{ display: "grid", gap: 16 }}>
          {/* IRAT */}
          <div style={{ ...glass, padding: 24, position: "relative", overflow: "hidden", borderColor: `${iratColor}22` }}>
            <div style={{ position: "absolute", top: -30, right: -20, fontSize: 110, opacity: 0.04, lineHeight: 1 }}>🚨</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>Índice IRAT</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${iratColor}18`, color: iratColor, border: `1px solid ${iratColor}33` }}>{iratLabel}</span>
            </div>
            <div style={{ fontSize: 44, fontWeight: 800, color: iratColor, letterSpacing: "-0.03em", lineHeight: 1 }}>
              {iratValue}<span style={{ fontSize: 18, color: "rgba(255,255,255,0.25)", marginLeft: 4 }}>/100</span>
            </div>
            <div style={{ marginTop: 14, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${iratRaw ?? 0}%`, height: "100%", background: `linear-gradient(to right, ${iratColor}88, ${iratColor})`, borderRadius: 3, transition: "width 0.8s ease" }} />
            </div>
          </div>
          {/* Cobertura */}
          <div style={{ ...glass, padding: 24, position: "relative", overflow: "hidden", borderColor: "rgba(96,165,250,0.15)" }}>
            <div style={{ position: "absolute", top: -30, right: -20, fontSize: 110, opacity: 0.04, lineHeight: 1 }}>🛡️</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>Cobertura Programas</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>Beneficiarios activos</span>
            </div>
            <div style={{ fontSize: 44, fontWeight: 800, color: "#60a5fa", letterSpacing: "-0.03em", lineHeight: 1 }}>{coberturaValue}<span style={{ fontSize: 18, color: "rgba(255,255,255,0.25)", marginLeft: 2 }}>%</span></div>
            <div style={{ marginTop: 14, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, coberturaValue)}%`, height: "100%", background: "linear-gradient(to right, #3b82f688, #60a5fa)", borderRadius: 3, transition: "width 0.8s ease" }} />
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Grid operativo ── */}
      {summary && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>Indicadores Operativos</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {/* Productores — tarjeta combinada */}
            <div style={{ ...glass, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -16, right: -10, fontSize: 60, opacity: 0.05 }}>🌾</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontWeight: 700 }}>Productores</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "#4ade80" }}>{summary.totals.producers}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>total</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", display: "inline-block" }} />
                <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>{summary.totals.producersActive} activos</span>
              </div>
            </div>
            <KpiCard value={fleet.length}                              label="Recursos en Ruta"        icon="🚚" color="#f472b6" />
            <KpiCard value={summary.operations.openIncidents}          label="Incidentes Abiertos"     icon="⚠️" color="#ef4444" />
            <KpiCard value={summary.operations.availableInventoryUnits} label="Inventario Disp. (kg)"  icon="📦" color="#22d3ee" />
            <KpiCard value={summary.operations.openDemands}            label="Demandas Abiertas"       icon="🍽️" color="#f59e0b" />
            <KpiCard value={summary.operations.scheduledRescues}       label="Rescates Programados"    icon="♻️" color="#a78bfa" />
            <KpiCard value={summary.totals.offers}                     label="Ofertas Publicadas"      icon="📋" color="#60a5fa" />
            <KpiCard value={summary.totals.auctions}                   label="Subastas Registradas"    icon="🏷️" color="#fb923c" />
            <KpiCard value={summary.operations.scheduledLogistics}     label="Logística Programada"    icon="🗂️" color="#34d399" />
            <KpiCard value={summary.totals.users}                      label="Usuarios del Sistema"    icon="👤" color="#818cf8" />
          </div>
        </div>
      )}

      {/* ── Trazabilidad de Entregas ── */}
      {summary && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>
            Trazabilidad de Entregas — Local y Nacional
          </div>
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(220px,1fr))" }}>
            {/* Total entregas */}
            <div style={{ ...glass, padding: "20px 22px", position: "relative", overflow: "hidden", borderColor: "rgba(167,139,250,0.2)" }}>
              <div style={{ position: "absolute", top: -16, right: -10, fontSize: 64, opacity: 0.05 }}>📬</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontWeight: 700 }}>Total Entregas</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: "#a78bfa", lineHeight: 1 }}>
                {(summary.totals.deliveries ?? 0).toLocaleString("es-CO")}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>
                  ✓ {(summary.totals.deliveriesReceived ?? 0)} recibidas
                </span>
                <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>
                  ⏳ {(summary.operations.pendingDeliveries ?? 0)} pendientes
                </span>
              </div>
              {(summary.totals.deliveries ?? 0) > 0 && (
                <div style={{ marginTop: 10, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    width: `${Math.round(((summary.totals.deliveriesReceived ?? 0) / (summary.totals.deliveries ?? 1)) * 100)}%`,
                    height: "100%", background: "linear-gradient(to right, #a78bfa88, #4ade80)",
                    borderRadius: 2, transition: "width 0.8s ease",
                  }} />
                </div>
              )}
            </div>

            {/* Kg entregados */}
            <div style={{ ...glass, padding: "20px 22px", position: "relative", overflow: "hidden", borderColor: "rgba(34,211,238,0.2)" }}>
              <div style={{ position: "absolute", top: -16, right: -10, fontSize: 64, opacity: 0.05 }}>⚖️</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontWeight: 700 }}>Volumen Entregado</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: "#22d3ee", lineHeight: 1 }}>
                {Number(summary.operations.deliveriesKgTotal ?? 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>
                unidades / kg acumulados
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>
                TRAZABILIDAD FÍSICA
              </div>
            </div>

            {/* Valor total */}
            <div style={{ ...glass, padding: "20px 22px", position: "relative", overflow: "hidden", borderColor: "rgba(74,222,128,0.2)" }}>
              <div style={{ position: "absolute", top: -16, right: -10, fontSize: 64, opacity: 0.05 }}>💰</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontWeight: 700 }}>Valor Transado</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#4ade80", lineHeight: 1 }}>
                {Number(summary.operations.deliveriesValueTotal ?? 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>
                en entregas con precio registrado
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.04em" }}>
                TRAZABILIDAD ECONÓMICA
              </div>
            </div>

            {/* Tasa de cumplimiento */}
            {(summary.totals.deliveries ?? 0) > 0 && (() => {
              const tasa = Math.round(((summary.totals.deliveriesReceived ?? 0) / (summary.totals.deliveries ?? 1)) * 100);
              const color = tasa >= 80 ? "#4ade80" : tasa >= 50 ? "#f59e0b" : "#f87171";
              return (
                <div style={{ ...glass, padding: "20px 22px", position: "relative", overflow: "hidden", borderColor: `${color}22` }}>
                  <div style={{ position: "absolute", top: -16, right: -10, fontSize: 64, opacity: 0.05 }}>📊</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontWeight: 700 }}>Tasa de Cumplimiento</div>
                  <div style={{ fontSize: 44, fontWeight: 800, color, lineHeight: 1 }}>
                    {tasa}<span style={{ fontSize: 18, color: "rgba(255,255,255,0.25)", marginLeft: 2 }}>%</span>
                  </div>
                  <div style={{ marginTop: 14, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${tasa}%`, height: "100%", background: `linear-gradient(to right, ${color}88, ${color})`, borderRadius: 3, transition: "width 0.8s ease" }} />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── Mid row: Balance operativo + Flota activa ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>
          Balance Operativo
        </div>
        <div className="dashboard-lower-grid" style={{ display: "grid", gap: 20, alignItems: "stretch" }}>
          {summary && <OperationsRing operations={summary.operations} />}
          <ActiveFleet resources={fleet} />
        </div>
      </div>

      {/* ── Bottom row: Visión territorial + Totales ── */}
      <div style={{ paddingBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 14 }}>
          Vista Territorial
        </div>
        <div className="dashboard-bottom-grid" style={{ display: "grid", gap: 20, alignItems: "stretch" }}>
          <TerritorialChart data={territorial} />
          {summary && <TotalsTable totals={summary.totals} />}
        </div>
      </div>

      <style>{`
        .dashboard-feature-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .dashboard-lower-grid   { grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); }
        .dashboard-bottom-grid  { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
        @media (max-width: 1024px) {
          .dashboard-lower-grid  { grid-template-columns: 1fr 1fr; }
          .dashboard-bottom-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 820px) {
          .dashboard-feature-grid,
          .dashboard-lower-grid,
          .dashboard-bottom-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 620px) {
          .dashboard-feature-grid > div { padding: 18px !important; }
        }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse   { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes spin    { to { transform:rotate(360deg) } }
      `}</style>
    </div>
  );
}
