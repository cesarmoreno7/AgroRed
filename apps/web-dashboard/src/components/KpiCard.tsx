import type { CSSProperties, ReactNode } from "react";

interface Props {
  value: number;
  label: string;
  icon: ReactNode;
  color: string;
  delta?: number;
}

export function KpiCard({ value, label, icon, color, delta }: Props) {
  const card: CSSProperties = {
    background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: "20px 22px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    position: "relative",
    overflow: "hidden",
    backdropFilter: "blur(10px)",
    transition: "transform 0.25s, border-color 0.25s, box-shadow 0.25s",
    cursor: "default",
  };

  const glow: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: 4,
    height: "100%",
    background: color,
    borderRadius: "16px 0 0 16px",
    boxShadow: `0 0 20px ${color}55`,
  };

  return (
    <div
      style={card}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.borderColor = `${color}44`;
        e.currentTarget.style.boxShadow = `0 8px 30px ${color}15`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={glow} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 28, opacity: 0.85 }}>{icon}</span>
        {delta !== undefined && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: delta >= 0 ? "#4ade80" : "#f87171",
              background: delta >= 0 ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
              padding: "2px 8px",
              borderRadius: 20,
            }}
          >
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}
