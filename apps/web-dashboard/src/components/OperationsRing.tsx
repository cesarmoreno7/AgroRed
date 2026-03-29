import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { CSSProperties } from "react";
import type { AnalyticsOperations } from "../types";

interface Props {
  operations: AnalyticsOperations;
}

const ITEMS: { key: keyof AnalyticsOperations; label: string; color: string }[] = [
  { key: "openDemands", label: "Demandas abiertas", color: "#60a5fa" },
  { key: "scheduledRescues", label: "Rescates programados", color: "#a78bfa" },
  { key: "scheduledLogistics", label: "Logística programada", color: "#34d399" },
  { key: "openIncidents", label: "Incidentes abiertos", color: "#f87171" },
  { key: "pendingNotifications", label: "Notif. pendientes", color: "#fbbf24" },
];

export function OperationsRing({ operations }: Props) {
  const panel: CSSProperties = {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 24,
    backdropFilter: "blur(10px)",
  };

  const data = ITEMS.map((i) => ({ name: i.label, value: operations[i.key], color: i.color }));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div style={panel}>
      <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "0.02em" }}>
        Operaciones activas
      </h3>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ position: "relative", width: 160, height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} innerRadius={50} outerRadius={72} paddingAngle={3} dataKey="value" stroke="none">
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} fillOpacity={0.8} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "rgba(15,15,25,0.95)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "#fff",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{total}</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>total</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.map((d) => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{d.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginLeft: "auto" }}>{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
