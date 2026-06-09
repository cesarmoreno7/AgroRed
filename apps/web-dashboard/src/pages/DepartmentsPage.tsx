import { useEffect, useState } from "react";
import {
  fetchDepartamentos,
  createDepartamento,
  updateDepartamento,
  deleteDepartamento,
  fetchMunicipios,
  type Departamento,
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

const emptyForm = { codigoDane: "", nombre: "" };

export function DepartmentsPage() {
  const [data, setData] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Departamento | null>(null);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [loadingMuni, setLoadingMuni] = useState(false);
  const limit = 20;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const res = await fetchDepartamentos(page, limit, search);
    if (res.ok) {
      setData(res.data.data);
      setTotal(res.data.total);
    } else {
      setError(`Error al cargar departamentos: ${(res as any).message ?? res.status}`);
    }
    setLoading(false);
  };

  const loadMunicipios = async (deptCode: string) => {
    setLoadingMuni(true);
    const res = await fetchMunicipios(1, 200, "", deptCode);
    if (res.ok) setMunicipios(res.data.data);
    setLoadingMuni(false);
  };

  useEffect(() => { loadData(); }, [page, search]);

  useEffect(() => {
    if (selected) loadMunicipios(selected.codigoDane);
    else setMunicipios([]);
  }, [selected]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.codigoDane || !form.nombre) {
      setError("Código DANE y nombre son obligatorios.");
      return;
    }
    setSaving(true);
    const res = editingId
      ? await updateDepartamento(editingId, form)
      : await createDepartamento(form);
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

  const handleEdit = (item: Departamento) => {
    setEditingId(item.id);
    setForm({ codigoDane: item.codigoDane, nombre: item.nombre });
    setShowForm(true);
    setError(null);
    setSelected(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este departamento?")) return;
    const res = await deleteDepartamento(id);
    if (res.ok) {
      if (selected?.id === id) setSelected(null);
      loadData();
    } else {
      alert(res.message);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Departamentos de Colombia
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {total} registros · Catálogo maestro territorial
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...emptyForm }); setError(null); }}
          style={{ background: "linear-gradient(135deg,#60a5fa,#a78bfa)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
        >
          + Nuevo Departamento
        </button>
      </div>

      {showForm && (
        <div style={{ background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#60a5fa" }}>
            {editingId ? "✏️ Editar Departamento" : "📝 Nuevo Departamento"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={lbl}>Código DANE *</label>
                <input style={inp} value={form.codigoDane} onChange={e => setForm({ ...form, codigoDane: e.target.value })} placeholder="Ej: 05" maxLength={10} />
              </div>
              <div>
                <label style={lbl}>Nombre *</label>
                <input style={inp} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Antioquia" maxLength={100} />
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

      <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar departamento por nombre o código DANE…" style={{ ...inp, borderRadius: 12, fontSize: 14 }} />

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 16, alignItems: "start" }}>

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Cód. DANE", "Departamento", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={3} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>Cargando...</td></tr>}
              {!loading && data.length === 0 && <tr><td colSpan={3} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)" }}>Sin registros. Agrega el primer departamento.</td></tr>}
              {!loading && data.map(dept => {
                const isSelected = selected?.id === dept.id;
                return (
                  <tr
                    key={dept.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: isSelected ? "rgba(96,165,250,0.08)" : "transparent", cursor: "pointer" }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(96,165,250,0.08)" : "transparent"; }}
                  >
                    <td onClick={() => setSelected(isSelected ? null : dept)} style={{ padding: "12px 16px", fontSize: 12, color: "#60a5fa", fontFamily: "monospace", fontWeight: 700 }}>{dept.codigoDane}</td>
                    <td onClick={() => setSelected(isSelected ? null : dept)} style={{ padding: "12px 16px", fontSize: 14, fontWeight: isSelected ? 700 : 400, color: isSelected ? "#60a5fa" : "#fff" }}>{dept.nombre}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <button onClick={() => handleEdit(dept)} style={{ marginRight: 8, background: "none", border: "none", color: "#60a5fa", cursor: "pointer", fontSize: 13 }}>Editar</button>
                      <button onClick={() => handleDelete(dept.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 13 }}>Eliminar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: 12 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>← Anterior</button>
              <span style={{ padding: "6px 14px", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Pág. {page}/{totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>Siguiente →</button>
            </div>
          )}
        </div>

        {selected && (
          <div style={{ background: "rgba(167,139,250,0.03)", border: "1px solid rgba(167,139,250,0.15)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(167,139,250,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#a78bfa" }}>{selected.nombre}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>Cód. {selected.codigoDane} · {loadingMuni ? "..." : `${municipios.length} municipios`}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ maxHeight: 480, overflowY: "auto" }}>
              {loadingMuni && <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>Cargando municipios...</div>}
              {!loadingMuni && municipios.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>Sin municipios en la base de datos para este departamento.</div>}
              {!loadingMuni && municipios.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["Cód. DANE", "Municipio"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {municipios.map(m => (
                      <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.04)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "10px 16px", fontSize: 11, color: "#a78bfa", fontFamily: "monospace", fontWeight: 600 }}>{m.codigoDane}</td>
                        <td style={{ padding: "10px 16px", fontSize: 13, color: "#fff" }}>{m.nombre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "12px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
        💡 Haz clic en un departamento para ver sus municipios registrados en la base de datos.
      </div>
    </div>
  );
}
