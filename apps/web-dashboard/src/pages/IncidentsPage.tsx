import { useEffect, useState } from "react";
import { fetchIncidents, registerIncident } from "../services/incidents";
import { useAuth } from "../hooks/useAuth";

const initialForm = {
  tenantId: "",
  type: "inseguridad_alimentaria",
  severity: "high",
  description: "",
  status: "open",
  location: "",
  notes: "",
};

const INCIDENT_TYPES = [
  { value: "inseguridad_alimentaria", label: "Inseguridad Alimentaria", icon: "🍽️" },
  { value: "desnutricion", label: "Desnutrición Infantil/Adulto", icon: "❤️‍🩹" },
  { value: "falta_acceso_alimentos", label: "Falta de Acceso", icon: "🚧" },
  { value: "falla_programa", label: "Falla en Programa Social", icon: "📉" },
  { value: "desperdicio_alimentario", label: "Riesgo de Desperdicio", icon: "🗑️" },
  { value: "problema_logistico", label: "Problema Logístico", icon: "🚚" },
  { value: "emergencia_social", label: "Emergencia Social", icon: "🆘" },
];

const SEVERITIES = [
  { value: "low", label: "Baja (Monitoreo)", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  { value: "medium", label: "Media (Prevención)", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  { value: "high", label: "Alta (Intervención)", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  { value: "critical", label: "Crítica (Inmediata)", color: "#fca5a5", bg: "rgba(127,29,29,0.5)" },
];

const STATUSES = [
  { value: "open", label: "Reportada" },
  { value: "investigating", label: "En Análisis" },
  { value: "resolved", label: "Intervenida/Cerrada" },
];

const getTypeIcon = (type: string) => INCIDENT_TYPES.find(t => t.value === type)?.icon || "⚠️";
const getTypeLabel = (type: string) => INCIDENT_TYPES.find(t => t.value === type)?.label || type;
const getSeverityColor = (sev: string) => SEVERITIES.find(s => s.value === sev)?.color || "#ccc";
const getSeverityBg = (sev: string) => SEVERITIES.find(s => s.value === sev)?.bg || "rgba(255,255,255,0.1)";
const getSeverityLabel = (sev: string) => SEVERITIES.find(s => s.value === sev)?.label || sev;

export function IncidentsPage() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [form, setForm] = useState({ ...initialForm, tenantId: user?.tenantId || "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIncidents().then(res => {
      if (res.ok) setIncidents(res.data);
    });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    if (!form.tenantId || !form.type || !form.severity || !form.description || !form.status) {
      setError("Todos los campos obligatorios deben ser completados.");
      setLoading(false);
      return;
    }
    const payload = {
      ...form,
      location: form.location || undefined,
      notes: form.notes || undefined,
    };
    const res = await registerIncident(payload);
    setLoading(false);
    if (res.ok) {
      setIncidents(u => [res.data, ...u]);
      setForm({ ...initialForm, tenantId: user?.tenantId || "" });
    } else {
      setError(res.message || "Error al registrar incidente");
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", animation: "fadeIn 0.5s ease-out" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em" }}>
          Gestión de Incidencias Sociales
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
          Sistema de detección, priorización y respuesta a riesgos sociales alimentarios.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: 24, alignItems: "start" }}>
        {/* Form Panel */}
        <div style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)", borderRadius: 16, padding: 24, border: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(10px)", position: "sticky", top: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Reportar Riesgo</h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.6)" }}>Tipo de Incidencia</label>
              <select name="type" value={form.type} onChange={handleChange} required style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
                {INCIDENT_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>)}
              </select>
            </div>
            
            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.6)" }}>Nivel de Riesgo</label>
              <select name="severity" value={form.severity} onChange={handleChange} required style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
                {SEVERITIES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.6)" }}>Descripción del Evento</label>
              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Detalles de la incidencia..." required rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", resize: "none" }} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.6)" }}>Ubicación / Coordenadas</label>
              <input name="location" value={form.location} onChange={handleChange} placeholder="Ej: Comuna 4, Sector Alto" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} />
            </div>

            <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", borderRadius: 8, background: "linear-gradient(to right, #ef4444, #f59e0b)", color: "#fff", border: "none", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginTop: 8, transition: "transform 0.2s" }}>
              {loading ? "Registrando..." : "Activar Alerta"}
            </button>
            {error && <div style={{ color: "#ef4444", fontSize: 13, marginTop: 4, textAlign: "center" }}>{error}</div>}
          </form>
        </div>

        {/* Incidents Feed */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {incidents.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: 16, border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }}>
              No hay incidencias sociales reportadas en este momento.
            </div>
          ) : (
            incidents.map((inc, i) => {
              const isCritical = inc.severity === "critical" || inc.severity === "high";
              return (
                <div key={inc.id || i} style={{ 
                  background: isCritical ? "linear-gradient(145deg, rgba(239,68,68,0.08) 0%, rgba(0,0,0,0) 100%)" : "rgba(255,255,255,0.02)", 
                  border: `1px solid ${isCritical ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}`, 
                  borderRadius: 16, padding: 20, position: "relative", overflow: "hidden", transition: "transform 0.2s"
                }}>
                  {isCritical && <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: "#ef4444" }} />}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontSize: 24, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", borderRadius: "50%" }}>
                        {getTypeIcon(inc.type)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{getTypeLabel(inc.type)}</div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>📍 {inc.location || "Ubicación no especificada"}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 8px", borderRadius: 12, background: getSeverityBg(inc.severity), color: getSeverityColor(inc.severity) }}>
                        {getSeverityLabel(inc.severity)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: "4px 8px", borderRadius: 12, background: "rgba(255,255,255,0.1)", color: "#ccc" }}>
                        {STATUSES.find(s => s.value === inc.status)?.label || inc.status}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.5, margin: 0, paddingLeft: 52 }}>
                    {inc.description}
                  </p>
                  {inc.notes && (
                    <div style={{ marginTop: 12, marginLeft: 52, padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, fontSize: 12, color: "rgba(255,255,255,0.5)", borderLeft: "2px solid rgba(255,255,255,0.1)" }}>
                      <strong>Notas de seguimiento:</strong> {inc.notes}
                    </div>
                  )}
                  <div style={{ marginTop: 16, marginLeft: 52, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                    {new Date(inc.occurredAt || new Date()).toLocaleString()} • Reportado por el sistema
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        select option { background: #1a1a2e; }
        .incident-card:hover { transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
