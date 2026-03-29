import type { CSSProperties } from "react";
import type { CurrentPosition } from "../types";

interface Props {
  resources: CurrentPosition[];
}

const STATUS_COLOR: Record<string, string> = {
  en_ruta: "#4ade80",
  disponible: "#60a5fa",
  inactivo: "#6b7280",
  mantenimiento: "#f59e0b",
};

export function ActiveFleet({ resources }: Props) {
  const panel: CSSProperties = {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 24,
    backdropFilter: "blur(10px)",
  };

  return (
    <div style={panel}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 8px #4ade80" }} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)", letterSpacing: "0.02em" }}>
          Recursos en ruta — {resources.length} activos
        </h3>
      </div>

      {resources.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, margin: 0 }}>Sin recursos activos en este momento</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {resources.map((r) => (
            <div
              key={r.recursoId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.04)",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{r.nombre}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {r.tipo} · {r.evento}
                  {r.velocidad != null ? ` · ${r.velocidad.toFixed(0)} km/h` : ""}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: `${STATUS_COLOR[r.estado] ?? "#6b7280"}22`,
                  color: STATUS_COLOR[r.estado] ?? "#6b7280",
                }}
              >
                {r.estado.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
