import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { fetchSummary, fetchTerritorialOverview, fetchActiveResources } from "../services/dashboard";
import { KpiCard } from "../components/KpiCard";
import { OperationsRing } from "../components/OperationsRing";
import { TotalsTable } from "../components/TotalsTable";
import { ActiveFleet } from "../components/ActiveFleet";
import { TerritorialChart } from "../components/TerritorialChart";
import type { AnalyticsSummary, TerritorialOverviewItem, CurrentPosition } from "../types";

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [territorial, setTerritorial] = useState<TerritorialOverviewItem[]>([]);
  const [fleet, setFleet] = useState<CurrentPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);

  // admin_municipal sees global data; others see their tenant
  const summaryTenantId = user?.role === "admin_municipal" ? undefined : user?.tenantId;

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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12 }}>
        <div style={{ fontSize: 32 }}>⏳</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Cargando tablero institucional…</div>
        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>Consultando base de datos…</div>
      </div>
    );
  }

  if (!summary && !loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 16 }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ color: "#f87171", fontSize: 16, fontWeight: 600 }}>No se pudo cargar el tablero</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, maxWidth: 380, textAlign: "center" }}>
          El servicio de analítica no está disponible en este momento. Verifica que el analytics-service esté desplegado correctamente.
        </div>
        <button
          onClick={load}
          style={{ marginTop: 8, padding: "10px 24px", background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          ↺ Reintentar
        </button>
      </div>
    );
  }

  // IRAT real desde v_irat_municipal (escala 0–100)
  const iratRaw    = summary?.operations.iratScore ?? null;
  const iratValue  = iratRaw !== null ? iratRaw.toFixed(1) : "—";
  const iratColor  = iratRaw === null ? "#6b7280"
                   : iratRaw >= 80 ? "#ef4444"
                   : iratRaw >= 60 ? "#f59e0b"
                   : iratRaw >= 40 ? "#facc15"
                   : "#10b981";

  // Cobertura real: % beneficiarios cubiertos por programas activos
  const coberturaValue = summary?.operations.programCoverage ?? 0;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", animation: "fadeIn 0.5s ease-out" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", background: "linear-gradient(to right, #4ade80, #3b82f6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Tablero de Control Institucional
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
            {user?.role === "admin_municipal" ? "Vista global · Todos los municipios" : (summary?.tenantName ?? "Vista global")} · Gobernanza Alimentaria Activa
          </p>
        </div>
        {updated && (
          <div style={{ background: "rgba(255,255,255,0.05)", padding: "6px 12px", borderRadius: 20, fontSize: 12, color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 6, backdropFilter: "blur(4px)" }}>
            <span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80" }} />
            Actualizado {updated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Strategic KPI Grid */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, marginBottom: 32 }}>
          {/* IRAT real desde v_irat_municipal */}
          <div style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)", borderRadius: 16, padding: 20, border: `1px solid ${iratColor}22`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -20, right: -20, fontSize: 80, opacity: 0.05 }}>🚨</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Índice IRAT</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: iratColor }}>
              {iratValue} <span style={{ fontSize: 16, color: "rgba(255,255,255,0.3)" }}>/ 100</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
              {iratRaw === null ? "Sin datos" : iratRaw >= 80 ? "Riesgo crítico" : iratRaw >= 60 ? "Riesgo alto" : iratRaw >= 40 ? "Riesgo medio" : "Riesgo bajo"}
            </div>
            {/* Bar */}
            <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
              <div style={{ width: `${iratRaw ?? 0}%`, height: "100%", background: iratColor, borderRadius: 2, transition: "width .5s" }} />
            </div>
          </div>

          {/* Cobertura real desde programas */}
          <div style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)", borderRadius: 16, padding: 20, border: "1px solid rgba(96,165,250,0.15)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -20, right: -20, fontSize: 80, opacity: 0.05 }}>🛡️</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Cobertura Programas</div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#60a5fa" }}>{coberturaValue}%</div>
            <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, coberturaValue)}%`, height: "100%", background: "#60a5fa", borderRadius: 2, transition: "width .5s" }} />
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>Beneficiarios en programas activos</div>
          </div>

          <KpiCard value={fleet.length} label="Recursos en Ruta" icon="🚚" color="#f472b6" />
          <KpiCard value={summary.operations.openIncidents} label="Incidentes Abiertos" icon="⚠️" color="#ef4444" />
          <KpiCard value={summary.operations.availableInventoryUnits} label="Inventario Disponible (kg)" icon="📦" color="#22d3ee" />
          <KpiCard value={summary.operations.openDemands} label="Demandas Abiertas" icon="🍽️" color="#f59e0b" />
          <KpiCard value={summary.operations.scheduledRescues} label="Rescates Programados" icon="♻️" color="#a78bfa" />
          <KpiCard value={summary.totals.producersActive} label="Productores Activos" icon="🌾" color="#4ade80" />
          <KpiCard value={summary.totals.offers} label="Ofertas Publicadas" icon="📋" color="#60a5fa" />
          <KpiCard value={summary.totals.auctions} label="Subastas Registradas" icon="🏷️" color="#fb923c" />
          <KpiCard value={summary.operations.scheduledLogistics} label="Logística Programada" icon="🗂️" color="#34d399" />
          <KpiCard value={summary.totals.users} label="Usuarios del Sistema" icon="👤" color="#818cf8" />
        </div>
      )}

      {/* Mid row: Operations ring + Fleet */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
        {summary && <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
           <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#fff" }}>Balance Operativo</h3>
           <OperationsRing operations={summary.operations} />
        </div>}
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
           <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#fff" }}>Seguimiento Logístico</h3>
           <ActiveFleet resources={fleet} />
        </div>
      </div>

      {/* Bottom row: Territorial chart + Totals table */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 40 }}>
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
           <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#fff" }}>Visión Territorial</h3>
           <TerritorialChart data={territorial} />
        </div>
        {summary && <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.05)" }}>
           <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#fff" }}>Totales del Sistema</h3>
           <TotalsTable totals={summary.totals} />
        </div>}
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

