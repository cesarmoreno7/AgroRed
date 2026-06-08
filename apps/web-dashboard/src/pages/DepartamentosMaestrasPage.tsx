import { useEffect, useState } from "react";
import {
  fetchDepartamentos,
  createDepartamento,
  updateDepartamento,
  deleteDepartamento,
  type Departamento,
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

export function DepartamentosMaestrasPage() {
  const [data, setData] = useState<Departamento[]>([]);
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

  const loadData = async () => {
    setLoading(true);
    const res = await fetchDepartamentos(page, limit, search);
    if (res.ok) {
      setData(res.data.data);
      setTotal(res.data.total);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [page, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.codigoDane || !form.nombre) {
      setError("Código DANE y nombre son obligatorios.");
      return;
    }
    setSaving(true);
    let res;
    if (editingId) {
      res = await updateDepartamento(editingId, form);
    } else {
      res = await createDepartamento(form);
    }
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
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este departamento?")) return;
    const res = await deleteDepartamento(id);
    if (res.ok) {
      loadData();
    } else {
      alert(res.message);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ color: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Departamentos
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {total} registros · Gestión de departamentos de Colombia
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...emptyForm }); }}
          style={{
            background: "linear-gradient(135deg,#60a5fa,#a78bfa)",
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "11px 22px",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          + Nuevo Departamento
        </button>
      </div>

      {showForm && (
        <div style={{ background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#60a5fa" }}>
            {editingId ? "✏️ Editar Departamento" : "📝 Nuevo Departamento"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label style={lbl}>Código DANE *</label>
                <input
                  style={inp}
                  value={form.codigoDane}
                  onChange={(e) => setForm({ ...form, codigoDane: e.target.value })}
                  placeholder="Ej: 05"
                  maxLength={10}
                />
              </div>
              <div>
                <label style={lbl}>Nombre *</label>
                <input
                  style={inp}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Antioquia"
                  maxLength={200}
                />
              </div>
            </div>
            {error && (
              <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: saving ? "rgba(96,165,250,0.3)" : "linear-gradient(135deg,#60a5fa,#a78bfa)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 20px",
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                  fontSize: 13,
                }}
              >
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setForm({ ...emptyForm }); setError(null); }}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.6)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  padding: "10px 20px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre o código DANE..."
        style={{ ...inp, marginBottom: 16, borderRadius: 12, fontSize: 14 }}
      />

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Cód. DANE</th>
              <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Nombre</th>
              <th style={{ padding: "14px 16px", textAlign: "right", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={3} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>Cargando...</td></tr>
            )}
            {!loading && data.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)" }}>Sin resultados</td></tr>
            )}
            {!loading && data.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td style={{ padding: "12px 16px", fontSize: 12, color: "#60a5fa", fontFamily: "monospace", fontWeight: 700 }}>{item.codigoDane}</td>
                <td style={{ padding: "12px 16px", fontSize: 14, color: "#fff" }}>{item.nombre}</td>
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
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              background: page === 1 ? "rgba(255,255,255,0.05)" : "rgba(96,165,250,0.1)",
              color: page === 1 ? "rgba(255,255,255,0.3)" : "#60a5fa",
              border: "1px solid rgba(96,165,250,0.2)",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: page === 1 ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            ← Anterior
          </button>
          <span style={{ padding: "8px 16px", color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              background: page === totalPages ? "rgba(255,255,255,0.05)" : "rgba(96,165,250,0.1)",
              color: page === totalPages ? "rgba(255,255,255,0.3)" : "#60a5fa",
              border: "1px solid rgba(96,165,250,0.2)",
              borderRadius: 8,
              padding: "8px 16px",
              cursor: page === totalPages ? "not-allowed" : "pointer",
              fontSize: 13,
            }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
