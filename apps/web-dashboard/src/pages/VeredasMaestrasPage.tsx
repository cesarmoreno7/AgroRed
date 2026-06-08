import { useEffect, useState } from "react";
import { DEPARTMENTS, getMunicipalitiesByDepartment } from "../services/locations";
import {
  fetchVeredas,
  createVereda,
  updateVereda,
  deleteVereda,
  type Vereda,
} from "../services/locations-api";

const inp: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#fff",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "rgba(255,255,255,0.4)",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const emptyForm = {
  nombre: "",
  departmentCode: "",
  municipalityCode: "",
  municipalityName: "",
  mainProduct: "",
};

export function VeredasMaestrasPage() {
  const [data, setData] = useState<Vereda[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const municipioOptions = form.departmentCode
    ? getMunicipalitiesByDepartment(form.departmentCode)
    : [];

  const loadData = async () => {
    setLoading(true);
    const res = await fetchVeredas(page, limit, search);
    if (res.ok) {
      setData(res.data.data);
      setTotal(res.data.total);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [page, search]);

  const handleDeptChange = (deptCode: string) => {
    setForm(f => ({ ...f, departmentCode: deptCode, municipalityCode: "", municipalityName: "" }));
  };

  const handleMuniChange = (muniCode: string) => {
    const muni = municipioOptions.find(m => m.code === muniCode);
    setForm(f => ({ ...f, municipalityCode: muniCode, municipalityName: muni?.name ?? "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.nombre || !form.municipalityCode || !form.departmentCode) {
      setError("Nombre, departamento y municipio son obligatorios.");
      return;
    }
    setSaving(true);
    const payload = {
      nombre: form.nombre,
      municipalityCode: form.municipalityCode,
      municipalityName: form.municipalityName,
      departmentCode: form.departmentCode,
      mainProduct: form.mainProduct || undefined,
    };
    const res = editingId
      ? await updateVereda(editingId, payload)
      : await createVereda(payload);
    setSaving(false);
    if (res.ok) {
      loadData();
      setForm({ ...emptyForm });
      setEditingId(null);
      setShowForm(false);
    } else {
      setError(res.message);
    }
  };

  const handleEdit = (item: Vereda) => {
    setEditingId(item.id);
    setForm({
      nombre: item.nombre,
      departmentCode: item.departmentCode,
      municipalityCode: item.municipalityCode,
      municipalityName: item.municipalityName,
      mainProduct: item.mainProduct ?? "",
    });
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar esta vereda?")) return;
    const res = await deleteVereda(id);
    if (res.ok) loadData();
    else alert(res.message);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Veredas
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {total} registros · Gestión de veredas
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...emptyForm }); setError(null); }}
          style={{ background: "linear-gradient(135deg,#60a5fa,#a78bfa)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
        >
          + Nueva Vereda
        </button>
      </div>

      {showForm && (
        <div style={{ background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#60a5fa" }}>
            {editingId ? "✏️ Editar Vereda" : "📝 Nueva Vereda"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={lbl}>Nombre *</label>
                <input
                  style={inp}
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: La Esperanza"
                  maxLength={200}
                />
              </div>
              <div>
                <label style={lbl}>Departamento *</label>
                <select
                  style={inp}
                  value={form.departmentCode}
                  onChange={e => handleDeptChange(e.target.value)}
                >
                  <option value="">-- Seleccione --</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Municipio *</label>
                <select
                  style={inp}
                  value={form.municipalityCode}
                  onChange={e => handleMuniChange(e.target.value)}
                  disabled={!form.departmentCode}
                >
                  <option value="">-- Seleccione --</option>
                  {municipioOptions.map(m => (
                    <option key={m.code} value={m.code}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Producto principal</label>
                <input
                  style={inp}
                  value={form.mainProduct}
                  onChange={e => setForm({ ...form, mainProduct: e.target.value })}
                  placeholder="Ej: Papa criolla"
                  maxLength={100}
                />
              </div>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={saving} style={{ background: saving ? "rgba(96,165,250,0.3)" : "linear-gradient(135deg,#60a5fa,#a78bfa)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontSize: 13 }}>
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...emptyForm }); setError(null); }} style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 20px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <input
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        placeholder="Buscar por nombre de vereda..."
        style={{ ...inp, marginBottom: 16, borderRadius: 12, fontSize: 14 }}
      />

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Nombre</th>
              <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Municipio</th>
              <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Departamento</th>
              <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Producto principal</th>
              <th style={{ padding: "14px 16px", textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>Cargando...</td></tr>}
            {!loading && data.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)" }}>Sin resultados</td></tr>}
            {!loading && data.map(item => (
              <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td style={{ padding: "12px 16px", fontSize: 14, color: "#fff" }}>{item.nombre}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{item.municipalityName}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{DEPARTMENTS.find(d => d.code === item.departmentCode)?.name ?? item.departmentCode}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#a78bfa" }}>{item.mainProduct ?? "—"}</td>
                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                  <button onClick={() => handleEdit(item)} style={{ marginRight: 8, background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 13 }}>Editar</button>
                  <button onClick={() => handleDelete(item.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 13 }}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>← Anterior</button>
          <span style={{ padding: "8px 16px", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Página {page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>Siguiente →</button>
        </div>
      )}
    </div>
  );
}
