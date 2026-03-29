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

  const load = useCallback(async () => {
    const [s, t, f] = await Promise.all([
      fetchSummary(user?.tenantId),
      fetchTerritorialOverview(),
      fetchActiveResources(user?.tenantId),
    ]);
    if (s.ok) setSummary(s.data);
    if (t.ok) setTerritorial(Array.isArray(t.data) ? t.data : []);
    if (f.ok) setFleet(Array.isArray(f.data) ? f.data : []);
    setUpdated(new Date());
    setLoading(false);
  }, [user?.tenantId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Cargando datos…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
            Panel operativo
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            {summary?.tenantName ?? "Vista global"} · Hola, {user?.fullName}
          </p>
        </div>
        {updated && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
            Actualizado {updated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* KPI Grid */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
          <KpiCard value={summary.totals.producers} label="Productores" icon="🌾" color="#4ade80" />
          <KpiCard value={summary.totals.offers} label="Ofertas" icon="📦" color="#60a5fa" />
          <KpiCard value={summary.operations.openDemands} label="Demandas abiertas" icon="🍽️" color="#f59e0b" />
          <KpiCard value={summary.operations.scheduledRescues} label="Rescates prog." icon="♻️" color="#a78bfa" />
          <KpiCard value={summary.operations.availableInventoryUnits} label="Inv. disponible" icon="📊" color="#22d3ee" />
          <KpiCard value={fleet.length} label="En ruta" icon="🚚" color="#f472b6" />
          <KpiCard value={summary.operations.openIncidents} label="Incidentes" icon="⚠️" color="#f87171" />
          <KpiCard value={summary.operations.scheduledLogistics} label="Logística prog." icon="📍" color="#fb923c" />
        </div>
      )}

      {/* Mid row: Operations ring + Fleet */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        {summary && <OperationsRing operations={summary.operations} />}
        <ActiveFleet resources={fleet} />
      </div>

      {/* Bottom row: Territorial chart + Totals table */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 40 }}>
        <TerritorialChart data={territorial} />
        {summary && <TotalsTable totals={summary.totals} />}
      </div>
    </div>
  );
}
