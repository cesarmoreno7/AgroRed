import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { fetchProducerStats } from "../services/producers";
import type { ProducerMapProperties, ProducerStatsResponse } from "../services/producers";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:               { label: "Activo",               color: "#4ade80" },
  pending_verification: { label: "Pend. verificación",   color: "#facc15" },
  inactive:             { label: "Inactivo",              color: "#6b7280" },
};

interface Props {
  producer: ProducerMapProperties;
  onClose: () => void;
}

export function ProducerDetailPanel({ producer, onClose }: Props) {
  const [stats, setStats] = useState<ProducerStatsResponse["stats"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setStats(null);
    fetchProducerStats(producer.id).then(res => {
      if (res.ok) {
        setStats(res.data.stats);
      } else {
        setError(res.message ?? "Error al cargar estadísticas.");
      }
      setLoading(false);
    });
  }, [producer.id]);

  const statusMeta = STATUS_LABEL[producer.status] ?? { label: producer.status, color: "#6b7280" };

  return (
    <div style={{
      background: "rgba(15,23,42,0.95)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 16,
      padding: 24,
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      gap: 20,
      minWidth: 320,
      maxWidth: 400,
      overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{producer.nombre}</h2>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
            {producer.tipo} · {producer.municipio ?? producer.comuna ?? "—"}
          </div>
          <span style={{
            display: "inline-block",
            marginTop: 8,
            padding: "2px 10px",
            borderRadius: 999,
            background: statusMeta.color + "22",
            color: statusMeta.color,
            fontSize: 12,
            fontWeight: 600,
          }}>
            {statusMeta.label}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "none",
            borderRadius: 8,
            color: "#94a3b8",
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: "4px 10px",
          }}
          aria-label="Cerrar panel"
        >
          ×
        </button>
      </div>

      {/* Contact */}
      <div style={{ fontSize: 13, color: "#cbd5e1" }}>
        <div>{producer.contactName} · {producer.contactPhone}</div>
        {producer.productCategories.length > 0 && (
          <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {producer.productCategories.map(cat => (
              <span key={cat} style={{
                background: "rgba(99,102,241,0.2)",
                color: "#a5b4fc",
                padding: "1px 8px",
                borderRadius: 999,
                fontSize: 11,
              }}>{cat}</span>
            ))}
          </div>
        )}
      </div>

      {/* KPI grid */}
      {loading && (
        <div style={{ color: "#64748b", textAlign: "center", padding: 16 }}>Cargando estadísticas…</div>
      )}
      {error && (
        <div style={{ color: "#f87171", fontSize: 13 }}>{error}</div>
      )}
      {stats && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Ofertas totales",   value: stats.totalOffers },
              { label: "Ofertas activas",   value: stats.activeOffers },
              { label: "Rescates",          value: stats.totalRescues },
              { label: "Kg rescatados",     value: stats.totalKgRescued.toLocaleString("es-CO") },
            ].map(kpi => (
              <div key={kpi.label} style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                padding: "10px 14px",
              }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{kpi.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0" }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Historical production chart */}
          {stats.historicalProduction.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10, fontWeight: 600 }}>
                Producción histórica (ton)
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={stats.historicalProduction}
                  margin={{ top: 4, right: 8, left: -20, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="temporada"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#94a3b8" }}
                    itemStyle={{ color: "#4ade80" }}
                    formatter={(v: number) => [`${v} ton`, "Toneladas"]}
                  />
                  <Bar dataKey="toneladas" fill="#4ade80" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {stats.lastActivityAt && (
            <div style={{ fontSize: 11, color: "#475569", textAlign: "right" }}>
              Última actividad: {new Date(stats.lastActivityAt).toLocaleDateString("es-CO")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
