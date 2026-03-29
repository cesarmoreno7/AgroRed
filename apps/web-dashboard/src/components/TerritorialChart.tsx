import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { CSSProperties } from "react";
import type { TerritorialOverviewItem } from "../types";

interface Props {
  data: TerritorialOverviewItem[];
}

const COLORS = ["#4ade80", "#60a5fa", "#f59e0b", "#f87171", "#a78bfa", "#34d399", "#fb923c", "#e879f9"];

export function TerritorialChart({ data }: Props) {
  const panel: CSSProperties = {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 24,
    backdropFilter: "blur(10px)",
  };

  const chartData = data.map((d) => ({
    name: d.tenantName.length > 14 ? d.tenantName.slice(0, 13) + "…" : d.tenantName,
    fullName: d.tenantName,
    productores: d.producers,
    ofertas: d.offers,
    demandas: d.openDemands,
    inventario: d.inventoryUnits,
  }));

  return (
    <div style={panel}>
      <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "0.02em" }}>
        Panorama territorial
      </h3>
      {data.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sin datos territoriales</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barGap={2}>
            <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip
              contentStyle={{
                background: "rgba(15,15,25,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                fontSize: 12,
                color: "#fff",
              }}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            <Bar dataKey="productores" name="Productores" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]!} fillOpacity={0.75} />
              ))}
            </Bar>
            <Bar dataKey="ofertas" name="Ofertas" radius={[4, 4, 0, 0]} fill="#60a5fa" fillOpacity={0.55} />
            <Bar dataKey="demandas" name="Demandas" radius={[4, 4, 0, 0]} fill="#f59e0b" fillOpacity={0.55} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
