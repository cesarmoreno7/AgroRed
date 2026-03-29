import { useEffect, useState, useCallback } from "react";
import { fetchTerritorialOverview } from "../services/dashboard";
import { TerritorialChart } from "../components/TerritorialChart";
import type { TerritorialOverviewItem } from "../types";

export function TerritorialPage() {
  const [data, setData] = useState<TerritorialOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetchTerritorialOverview();
    if (res.ok) setData(Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div style={{ color: "rgba(255,255,255,0.3)", padding: 40 }}>Cargando datos territoriales…</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 24 }}>Panorama territorial</h1>
      <TerritorialChart data={data} />

      {data.length > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16,
          padding: 24,
          marginTop: 20,
          backdropFilter: "blur(10px)",
        }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>Detalle por municipio</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Municipio", "Productores", "Ofertas", "Demandas", "Inventario", "Logística", "Incidentes", "Notificaciones"].map((h) => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "rgba(255,255,255,0.4)", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((t) => (
                  <tr key={t.tenantId} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "10px 12px", color: "#fff", fontWeight: 600 }}>{t.tenantName}</td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.6)" }}>{t.producers}</td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.6)" }}>{t.offers}</td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.6)" }}>{t.openDemands}</td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.6)" }}>{t.inventoryUnits}</td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.6)" }}>{t.scheduledLogistics}</td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.6)" }}>{t.openIncidents}</td>
                    <td style={{ padding: "10px 12px", color: "rgba(255,255,255,0.6)" }}>{t.pendingNotifications}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
