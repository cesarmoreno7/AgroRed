import type { CSSProperties } from "react";
import type { AnalyticsTotals } from "../types";

interface Props {
  totals: AnalyticsTotals;
}

const ROWS: { key: keyof AnalyticsTotals; label: string; icon: string; color: string }[] = [
  { key: "users",           label: "Usuarios",            icon: "👤", color: "#818cf8" },
  { key: "producersActive", label: "Productores activos", icon: "🌾", color: "#4ade80" },
  { key: "producers",       label: "Productores total",   icon: "🌿", color: "#34d399" },
  { key: "offers",          label: "Ofertas",             icon: "📦", color: "#60a5fa" },
  { key: "rescues",         label: "Rescates",            icon: "♻️", color: "#a78bfa" },
  { key: "demands",         label: "Demandas",            icon: "🍽️", color: "#f59e0b" },
  { key: "inventoryItems",  label: "Ítems inventario",    icon: "📊", color: "#22d3ee" },
  { key: "logisticsOrders", label: "Órdenes logísticas",  icon: "🚚", color: "#f472b6" },
  { key: "incidents",       label: "Incidentes",          icon: "⚠️", color: "#f87171" },
  { key: "notifications",   label: "Notificaciones",      icon: "🔔", color: "#fbbf24" },
  { key: "auctions",        label: "Subastas",            icon: "🏷️", color: "#fb923c" },
];

export function TotalsTable({ totals }: Props) {
  const panel: CSSProperties = {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 24,
    backdropFilter: "blur(10px)",
    height: "100%",
    minHeight: 380,
    display: "flex",
    flexDirection: "column",
  };

  const total = ROWS.reduce((sum, r) => sum + (totals[r.key] ?? 0), 0);

  return (
    <div style={panel}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "0.02em" }}>
          Totales del ecosistema
        </h3>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontVariantNumeric: "tabular-nums" }}>
          {total.toLocaleString()} registros
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        {ROWS.map(r => {
          const value = totals[r.key] ?? 0;
          const max = Math.max(1, ...ROWS.map(row => totals[row.key] ?? 0));
          const pct = Math.round((value / max) * 100);
          return (
            <div
              key={r.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 10,
                transition: "background 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >
              {/* Color dot */}
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0, boxShadow: `0 0 6px ${r.color}55` }} />
              {/* Icon + label */}
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.icon} {r.label}
              </span>
              {/* Mini bar */}
              <div style={{ width: 48, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", flexShrink: 0 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: r.color, borderRadius: 2, transition: "width 0.6s ease", opacity: 0.7 }} />
              </div>
              {/* Value */}
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", minWidth: 36, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {value.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
