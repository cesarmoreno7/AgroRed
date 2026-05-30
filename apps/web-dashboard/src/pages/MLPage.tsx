import { useEffect, useState } from "react";
import { api } from "../services/api";

interface MLSuggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  priority: string;
  status: string;
  createdAt: string;
}

const PRIORITY_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  critical: { color: "#f87171", label: "Crítico",  icon: "🚨" },
  high:     { color: "#fb923c", label: "Alto",     icon: "⚠️" },
  medium:   { color: "#facc15", label: "Medio",    icon: "📊" },
  low:      { color: "#4ade80", label: "Bajo",     icon: "✅" },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending:    { color: "#facc15", label: "Pendiente" },
  applied:    { color: "#4ade80", label: "Aplicado" },
  dismissed:  { color: "#94a3b8", label: "Descartado" },
};

export function MLPage() {
  const [suggestions, setSuggestions] = useState<MLSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState("all");

  useEffect(() => {
    api<MLSuggestion[]>("/api/v1/ml/suggestions")
      .then((res) => {
        if (res.ok) setSuggestions(Array.isArray(res.data) ? res.data : []);
        else setError(res.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = filterPriority === "all"
    ? suggestions
    : suggestions.filter(s => s.priority === filterPriority);

  const counts = suggestions.reduce((acc, s) => {
    acc[s.priority] = (acc[s.priority] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ color: "#fff", maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#a78bfa,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Apoyo a Decisión (ML)
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            Sugerencias heurísticas para optimizar la operación territorial.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); setError(null); api<MLSuggestion[]>("/api/v1/ml/suggestions").then(r => { if (r.ok) setSuggestions(Array.isArray(r.data) ? r.data : []); else setError(r.message); }).finally(() => setLoading(false)); }}
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 20px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
        >
          ↺ Actualizar
        </button>
      </div>

      {/* Priority summary cards */}
      {!loading && !error && (
        <div style={{ display: "flex", gap: 10 }}>
          {(["critical","high","medium","low"] as const).map(p => {
            const cfg = PRIORITY_CONFIG[p];
            return (
              <button key={p} onClick={() => setFilterPriority(filterPriority === p ? "all" : p)}
                style={{ flex: 1, background: filterPriority === p ? `${cfg.color}18` : "rgba(255,255,255,0.03)", border: `1px solid ${filterPriority === p ? cfg.color + "44" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", color: "#fff", textAlign: "left", transition: "all 0.15s" }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{cfg.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: cfg.color }}>{counts[p] ?? 0}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{cfg.label}</div>
              </button>
            );
          })}
          <button onClick={() => setFilterPriority("all")}
            style={{ flex: 1, background: filterPriority === "all" ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${filterPriority === "all" ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", color: "#fff", textAlign: "left" }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>🧠</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa" }}>{suggestions.length}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Total</div>
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{ padding: "18px 20px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 12, color: "#f87171", display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No se pudieron cargar las sugerencias</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{error}</div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: "center", padding: 64 }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>🔄</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Cargando sugerencias del modelo…</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 64, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
            {filterPriority !== "all" ? `No hay sugerencias de prioridad "${PRIORITY_CONFIG[filterPriority]?.label}".` : "No hay sugerencias disponibles por el momento."}
          </div>
        </div>
      )}

      {/* Suggestions list */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((s) => {
            const p = PRIORITY_CONFIG[s.priority] ?? { color: "#94a3b8", label: s.priority, icon: "📌" };
            const st = STATUS_CONFIG[s.status] ?? { color: "#94a3b8", label: s.status };
            return (
              <div key={s.id} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${p.color}18`, borderLeft: `3px solid ${p.color}`, borderRadius: 12, padding: "18px 20px" }}>

                {/* Top row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{p.icon}</span>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: p.color, marginRight: 8 }}>{p.label}</span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.type}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}33` }}>{st.label}</span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                      {new Date(s.createdAt).toLocaleDateString("es-CO")}
                    </span>
                  </div>
                </div>

                {/* Title & description */}
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 14, lineHeight: 1.6 }}>{s.description}</div>

                {/* Confidence bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>Confianza del modelo</span>
                  <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${s.confidence}%`, height: "100%", borderRadius: 3, background: s.confidence > 70 ? "#4ade80" : s.confidence > 40 ? "#facc15" : "#f87171", transition: "width 0.3s ease" }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: s.confidence > 70 ? "#4ade80" : s.confidence > 40 ? "#facc15" : "#f87171", minWidth: 40, textAlign: "right" }}>{s.confidence}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
