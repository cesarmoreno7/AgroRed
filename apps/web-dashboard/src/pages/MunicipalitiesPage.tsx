import { useEffect, useState } from "react";
import { DEPARTMENTS } from "../services/locations";
import {
  fetchMunicipios,
  createMunicipio,
  updateMunicipio,
  deleteMunicipio,
  type Municipio,
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
  codigoDane: "",
  nombre: "",
  departmentCode: "",
  departmentName: "",
  population: "",
};

export function MunicipalitiesPage() {
  const [data, setData] = useState<Municipio[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const limit = 25;

  const loadData = async () => {
    setLoading(true);
    const res = await fetchMunicipios(page, limit, search, deptFilter);
    if (res.ok) {
      setData(res.data.data);
      setTotal(res.data.total);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [page, search, deptFilter]);

  const handleDeptChange = (code: string) => {
    setDeptFilter(code);
    setPage(1);
    const dept = DEPARTMENTS.find(d => d.code === code);
    setForm(f => ({ ...f, departmentCode: code, departmentName: dept?.name ?? "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.codigoDane || !form.nombre || !form.departmentCode) {
      setError("Código DANE, nombre y departamento son obligatorios.");
      return;
    }
    const dept = DEPARTMENTS.find(d => d.code === form.departmentCode);
    if (!dept) {
      setError("Departamento inválido.");
      return;
    }
    setSaving(true);
    const payload = {
      codigoDane: form.codigoDane,
      nombre: form.nombre,
      departmentCode: form.departmentCode,
      departmentName: dept.name,
      population: form.population ? parseInt(form.population, 10) : undefined,
    };
    const res = editingId
      ? await updateMunicipio(editingId, payload)
      : await createMunicipio(payload);
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

  const handleEdit = (item: Municipio) => {
    setEditingId(item.id);
    setForm({
      codigoDane: item.codigoDane,
      nombre: item.nombre,
      departmentCode: item.departmentCode,
      departmentName: item.departmentName,
      population: item.population ? String(item.population) : "",
    });
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este municipio?")) return;
    const res = await deleteMunicipio(id);
    if (res.ok) loadData();
    else alert(res.message);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#4ade80,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Municipios de Colombia
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {total} registros en base de datos
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...emptyForm }); setError(null); }}
          style={{ background: "linear-gradient(135deg,#4ade80,#60a5fa)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
        >
          + Nuevo Municipio
        </button>
      </div>

      {showForm && (
        <div style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#4ade80" }}>
            {editingId ? "✏️ Editar Municipio" : "📝 Nuevo Municipio"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={lbl}>Código DANE *</label>
                <input style={inp} value={form.codigoDane} onChange={e => setForm({ ...form, codigoDane: e.target.value })} placeholder="Ej: 05001" maxLength={10} />
              </div>
              <div>
                <label style={lbl}>Nombre *</label>
                <input style={inp} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Medellín" maxLength={100} />
              </div>
              <div>
                <label style={lbl}>Departamento *</label>
                <select
                  style={inp}
                  value={form.departmentCode}
                  onChange={e => {
                    const dept = DEPARTMENTS.find(d => d.code === e.target.value);
                    setForm({ ...form, departmentCode: e.target.value, departmentName: dept?.name ?? "" });
                  }}
                >
                  <option value="">-- Seleccione --</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Población</label>
                <input style={inp} type="number" value={form.population} onChange={e => setForm({ ...form, population: e.target.value })} placeholder="Ej: 2700000" min={0} />
              </div>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={saving} style={{ background: saving ? "rgba(74,222,128,0.3)" : "linear-gradient(135deg,#4ade80,#60a5fa)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", fontSize: 13 }}>
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...emptyForm }); setError(null); }} style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 20px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar municipio por nombre o código…"
          style={{ ...inp, flex: 1, minWidth: 220, borderRadius: 12, fontSize: 14 }}
        />
        <select
          value={deptFilter}
          onChange={e => handleDeptChange(e.target.value)}
          style={{ ...inp, width: "auto", minWidth: 220, borderRadius: 12 }}
        >
          <option value="">Todos los departamentos</option>
          {DEPARTMENTS.map(d => (
            <option key={d.code} value={d.code}>{d.name}</option>
          ))}
        </select>
      </div>

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Cód. Municipio", "Municipio", "Departamento", "Población", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>Cargando...</td></tr>}
              {!loading && data.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>Sin registros. Agrega el primer municipio.</td></tr>}
              {!loading && data.map((m, i) => (
                <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,222,128,0.04)")}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 ? "rgba(255,255,255,0.01)" : "transparent")}>
                  <td style={{ padding: "11px 16px", fontSize: 11, color: "#4ade80", fontFamily: "monospace", fontWeight: 600 }}>{m.codigoDane}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: "#fff", fontWeight: 500 }}>{m.nombre}</td>
                  <td style={{ padding: "11px 16px", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{m.departmentName}</td>
                  <td style={{ padding: "11px 16px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{m.population ? m.population.toLocaleString("es-CO") : "—"}</td>
                  <td style={{ padding: "11px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => handleEdit(m)} style={{ marginRight: 8, background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 13 }}>Editar</button>
                    <button onClick={() => handleDelete(m.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 13 }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>← Anterior</button>
            <span style={{ padding: "6px 14px", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Pág. {page}/{totalPages} · {total} registros</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Siguiente →</button>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
        💡 Los municipios registrados aquí se usan como referencias territoriales en Rescates, Inventario y Productores.
      </div>
    </div>
  );
}
