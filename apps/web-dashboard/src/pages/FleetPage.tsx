import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../hooks/useAuth";
import { fetchActiveResources } from "../services/dashboard";
import { buildApiUrl, getToken } from "../services/api";
import { FleetMap } from "../components/FleetMap";
import { FleetManager } from "../components/FleetManager";
import type { CurrentPosition } from "../types";

const STATUS_DOT: Record<string, string> = {
  en_ruta:      "#4ade80",
  disponible:   "#60a5fa",
  inactivo:     "#6b7280",
  mantenimiento:"#f59e0b",
};

export function FleetPage() {
  const { user } = useAuth();
  const [resources, setResources] = useState<CurrentPosition[]>([]);
  const [loading, setLoading]     = useState(true);
  const [liveMode, setLiveMode]   = useState(false);
  // ── Initial load + fallback polling every 15 s ──
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

  // ── SSE live stream via fetch (supports Authorization header) ──
  useEffect(() => {
    const token = getToken();
    if (!token || !user?.tenantId) return;

    let aborted = false;
    const controller = new AbortController();

    async function connectSSE() {
      try {
        const res = await fetch(buildApiUrl("/api/v1/logistics/tracking/stream"), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) { setLiveMode(false); return; }

        setLiveMode(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const pos: CurrentPosition = JSON.parse(line.slice(6));
              setResources(prev => {
                const idx = prev.findIndex(r => r.recursoId === pos.recursoId);
                if (idx === -1) return [...prev, pos];
                const next = [...prev];
                next[idx] = pos;
                return next;
              });
            } catch { /* ignore */ }
          }
        }
      } catch {
        /* aborted or network error */
      } finally {
        if (!aborted) setLiveMode(false);
      }
    }

    connectSSE();
    return () => { aborted = true; controller.abort(); setLiveMode(false); };
  }, [user?.tenantId]);

  if (loading) {
    return <div style={{ color: "rgba(255,255,255,0.3)", padding: 40 }}>Cargando flota…</div>;
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#f472b6,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Flota en tiempo real
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {resources.length} recursos activos en el mapa
          </p>
        </div>

        {/* Live indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${liveMode ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 24, padding: "8px 16px" }}>
          <span style={{
            display: "block", width: 8, height: 8, borderRadius: "50%",
            background: liveMode ? "#4ade80" : "#6b7280",
            boxShadow: liveMode ? "0 0 6px #4ade80" : "none",
            animation: liveMode ? "pulse 1.5s infinite" : "none",
          }} />
          <span style={{ fontSize: 12, color: liveMode ? "#4ade80" : "rgba(255,255,255,0.35)", fontWeight: 600 }}>
            {liveMode ? "En vivo" : "Polling 15 s"}
          </span>
        </div>
      </div>

      {/* Mapa */}
      <FleetMap resources={resources} />

      {/* CRUD Manager */}
      <FleetManager tenantId={user?.role === "admin_municipal" ? undefined : user?.tenantId} />

      {/* KPIs */}
      {resources.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {[
            { label: "Total activos",   value: resources.length,                                                                            color: "#4ade80" },
            { label: "En ruta",         value: resources.filter(r => r.estado === "en_ruta").length,                                        color: "#60a5fa" },
            { label: "Disponibles",     value: resources.filter(r => r.estado === "disponible").length,                                     color: "#a78bfa" },
            { label: "Velocidad prom.", value: `${Math.round(resources.reduce((s, r) => s + (r.velocidad ?? 0), 0) / Math.max(resources.length, 1))} km/h`, color: "#f59e0b" },
          ].map(s => (
            <div key={s.label} style={{ padding: "16px 18px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Leyenda de estados */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.04)" }}>
        {Object.entries(STATUS_DOT).map(([estado, color]) => (
          <span key={estado} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
            {estado.replace("_", " ")}
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
          Solo recursos con coordenadas registradas aparecen en el mapa
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
