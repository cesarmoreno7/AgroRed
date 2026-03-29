import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { fetchActiveResources } from "../services/dashboard";
import { ActiveFleet } from "../components/ActiveFleet";
import type { CurrentPosition } from "../types";

export function FleetPage() {
  const { user } = useAuth();
  const [resources, setResources] = useState<CurrentPosition[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetchActiveResources(user?.tenantId);
    if (res.ok) setResources(Array.isArray(res.data) ? res.data : []);
    setLoading(false);
  }, [user?.tenantId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [load]);

  if (loading) {
    return <div style={{ color: "rgba(255,255,255,0.3)", padding: 40 }}>Cargando flota…</div>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 24 }}>Flota en tiempo real</h1>
      <ActiveFleet resources={resources} />

      {resources.length > 0 && (
        <div style={{
          marginTop: 20,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16,
          padding: 24,
          backdropFilter: "blur(10px)",
        }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>Resumen de flota</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { label: "Total activos", value: resources.length, color: "#4ade80" },
              { label: "En ruta", value: resources.filter(r => r.estado === "en_ruta").length, color: "#60a5fa" },
              { label: "Velocidad prom.", value: Math.round(resources.reduce((s, r) => s + (r.velocidad ?? 0), 0) / Math.max(resources.length, 1)), color: "#f59e0b", suffix: " km/h" },
            ].map((s) => (
              <div key={s.label} style={{ padding: "16px 18px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}{"suffix" in s ? s.suffix : ""}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
