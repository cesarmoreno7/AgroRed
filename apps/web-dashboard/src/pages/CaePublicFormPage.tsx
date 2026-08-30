import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicCaeForm, submitPublicCaeReport } from "../services/pae";

const CATEGORY_LABEL: Record<string, string> = {
  gramaje: "Porciones incompletas / gramaje",
  cadena_frio: "Comida fría / cadena de frío",
  vencimiento: "Productos vencidos o por vencer",
  higiene: "Condiciones higiénicas de la cocina",
  inasistencia_entrega: "No llegó la alimentación",
  otro: "Otro"
};

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f1f5f9",
  color: "#0f172a",
  fontFamily: "system-ui, sans-serif",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "40px 16px"
};
const cardS: React.CSSProperties = {
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
  padding: 28,
  width: "100%",
  maxWidth: 520
};
const inpS: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  fontSize: 14,
  boxSizing: "border-box"
};
const lblS: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", margin: "14px 0 5px" };

export function CaePublicFormPage() {
  const { token = "" } = useParams();
  const [form, setForm] = useState<{ schoolName: string; municipality: string; categories: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [data, setData] = useState({ reporterName: "", reporterRole: "padre_familia", category: "gramaje", description: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPublicCaeForm(token).then((r) => (r.ok ? setForm(r.data) : setErr("Este enlace de reporte no es válido o fue desactivado.")));
  }, [token]);

  const submit = async () => {
    if (data.description.trim().length < 10) return setErr("Describe la situación con al menos 10 caracteres.");
    setBusy(true);
    setErr(null);
    const r = await submitPublicCaeReport(token, {
      reporterName: data.reporterName || undefined,
      reporterRole: data.reporterRole,
      category: data.category,
      description: data.description
    });
    setBusy(false);
    if (!r.ok) return setErr(r.message);
    setSent(r.data.trackingCode);
  };

  if (err && !form) return <div style={wrap}><div style={cardS}><p style={{ color: "#b91c1c" }}>{err}</p></div></div>;
  if (!form) return <div style={wrap}><div style={cardS}>Cargando…</div></div>;

  if (sent) {
    return (
      <div style={wrap}>
        <div style={cardS}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Reporte recibido</h2>
          <p style={{ color: "#475569" }}>
            Gracias. Tu reporte fue registrado y remitido a la Alcaldía y a la Gobernación para su verificación.
          </p>
          <p style={{ fontSize: 13 }}>Código de seguimiento: <b>{sent}</b></p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={cardS}>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Comité de Alimentación Escolar
        </div>
        <h2 style={{ margin: "6px 0 2px", fontSize: 19 }}>{form.schoolName}</h2>
        <div style={{ color: "#64748b", fontSize: 13 }}>{form.municipality}</div>

        <label style={lblS}>¿Quién reporta?</label>
        <select style={inpS} value={data.reporterRole} onChange={(e) => setData((d) => ({ ...d, reporterRole: e.target.value }))}>
          <option value="rector">Rector(a)</option>
          <option value="docente">Docente</option>
          <option value="padre_familia">Padre / madre de familia</option>
          <option value="estudiante">Estudiante</option>
          <option value="otro">Otro</option>
        </select>

        <label style={lblS}>Nombre (opcional)</label>
        <input style={inpS} value={data.reporterName} onChange={(e) => setData((d) => ({ ...d, reporterName: e.target.value }))} />

        <label style={lblS}>Tipo de situación</label>
        <select style={inpS} value={data.category} onChange={(e) => setData((d) => ({ ...d, category: e.target.value }))}>
          {form.categories.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>)}
        </select>

        <label style={lblS}>¿Qué pasó?</label>
        <textarea
          style={{ ...inpS, minHeight: 110, resize: "vertical" }}
          value={data.description}
          onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
        />

        {err && <p style={{ color: "#b91c1c", fontSize: 13 }}>{err}</p>}

        <button
          onClick={submit}
          disabled={busy}
          style={{ marginTop: 16, width: "100%", padding: "12px", borderRadius: 10, border: "none", background: "#1A5C2E", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          {busy ? "Enviando…" : "Enviar reporte"}
        </button>
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 12 }}>
          Tu reporte llega a la Gobernación de Antioquia y a la Alcaldía. No se requiere identificarse.
        </p>
      </div>
    </div>
  );
}
