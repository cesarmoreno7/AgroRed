import type { CSSProperties } from "react";
import type { AnalyticsTotals } from "../types";

interface Props {
  totals: AnalyticsTotals;
}

const ROWS: { key: keyof AnalyticsTotals; label: string; icon: string }[] = [
  { key: "users", label: "Usuarios", icon: "👤" },
  { key: "producers", label: "Productores", icon: "🌾" },
  { key: "offers", label: "Ofertas", icon: "📦" },
  { key: "rescues", label: "Rescates", icon: "♻️" },
  { key: "demands", label: "Demandas", icon: "🍽️" },
  { key: "inventoryItems", label: "Inventario", icon: "📊" },
  { key: "logisticsOrders", label: "Órdenes logísticas", icon: "🚚" },
  { key: "incidents", label: "Incidentes", icon: "⚠️" },
  { key: "notifications", label: "Notificaciones", icon: "🔔" },
];

export function TotalsTable({ totals }: Props) {
  const panel: CSSProperties = {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 24,
    backdropFilter: "blur(10px)",
  };

  return (
    <div style={panel}>
      <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "0.02em" }}>
        Totales del ecosistema
      </h3>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {ROWS.map((r) => (
            <tr
              key={r.key}
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <td style={{ padding: "10px 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                <span style={{ marginRight: 8 }}>{r.icon}</span>{r.label}
              </td>
              <td style={{ padding: "10px 0", fontSize: 14, fontWeight: 600, color: "#fff", textAlign: "right" }}>
                {totals[r.key].toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
