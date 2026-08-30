import type { CSSProperties, ReactNode } from "react";

export const card: CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 18
};
export const inp: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 9,
  color: "#fff",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box"
};
export const lbl: CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "rgba(255,255,255,0.45)",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.05em"
};
export const btn: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: 12.5,
  cursor: "pointer"
};
export const btnPrimary: CSSProperties = { ...btn, background: "#2E7D32", border: "1px solid #2E7D32" };
export const th: CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 10.5,
  color: "rgba(255,255,255,0.4)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "1px solid rgba(255,255,255,0.1)"
};
export const td: CSSProperties = {
  padding: "9px 10px",
  fontSize: 12.5,
  color: "rgba(255,255,255,0.85)",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  verticalAlign: "top"
};

const RESULT_COLORS: Record<string, string> = {
  conforme: "#4ade80",
  conforme_con_observaciones: "#fbbf24",
  no_conforme: "#f87171",
  pendiente: "#94a3b8",
  abierto: "#fbbf24",
  notificado: "#fb923c",
  en_respuesta: "#60a5fa",
  subsanado: "#4ade80",
  incumplido: "#f87171",
  escalado_sancion: "#c084fc",
  archivado: "#94a3b8",
  nuevo: "#fbbf24",
  triage: "#60a5fa",
  derivado: "#c084fc",
  descartado: "#94a3b8",
  propuesta: "#fbbf24",
  requerida: "#fb923c",
  aplicada: "#f87171",
  en_firme: "#c084fc"
};

export function Badge({ value }: { value: string }) {
  const c = RESULT_COLORS[value] ?? "#94a3b8";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        color: c,
        background: `${c}22`,
        border: `1px solid ${c}44`
      }}
    >
      {value}
    </span>
  );
}

export function PageShell({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: "#fff", margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.45)", margin: "4px 0 0" }}>{subtitle}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>
      </div>
      {children}
    </div>
  );
}
