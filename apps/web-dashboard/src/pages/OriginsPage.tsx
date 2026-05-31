import { useEffect, useState, useMemo } from "react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";

interface Origin {
  id: string;
  tenantId: string;
  name: string;
  municipalityName: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  createdAt: string;
}

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, color: "#fff", fontSize: 13,
  outline: "none", boxSizing: "border-box",
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)",
  marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em",
};

const emptyForm = {
  name: "", municipalityName: "", address: "", latitude: "", longitude: "",
};

export function OriginsPage() {
  const { user } = useAuth();
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm, isActive: true });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await api<Origin[]>("/api/v1/analytics/origins?limit=200");
    if (res.ok) setOrigins(Array.isArray(res.data) ? res.data : (res.data as any).data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const set  = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setE = (k: string, v: string | boolean) => setEditForm(f => ({ ...f, [k]: v }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.municipalityName.trim()) {
      setFormError("Nombre y municipio son obligatorios.");
      return;
    }
    setSaving(true);
    const res = await api<Origin>("/api/v1/analytics/origins", {
      method: "POST",
      body: {
        tenantId:         user?.tenantId,
        name:             form.name.trim(),
        municipalityName: form.municipalityName.trim(),
        address:          form.address.trim() || null,
        latitude:         form.latitude  ? parseFloat(form.latitude)  : null,
        longitude:        form.longitude ? parseFloat(form.longitude) : null,
      },
    });
    setSaving(false);
    if (res.ok) { setOrigins(prev => [res.data, ...prev]); setForm({ ...emptyForm }); setShowForm(false); }
    else setFormError((res as any).message ?? "Error al crear el origen.");
  };

  const startEdit = (o: Origin) => {
    setEditingId(o.id);
    setEditForm({ name: o.name, municipalityName: o.municipalityName, address: o.address ?? "", latitude: o.latitude != null ? String(o.latitude) : "", longitude: o.longitude != null ? String(o.longitude) : "", isActive: o.isActive });
    setEditError(null); setShowForm(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return;
    setEditError(null);
    setEditSaving(true);
    const res = await api<Origin>(`/api/v1/analytics/origins/${editingId}`, {
      method: "PUT",
      body: {
        name:             editForm.name.trim(),
        municipalityName: editForm.municipalityName.trim(),
        address:          editForm.address.trim() || null,
        latitude:         editForm.latitude  ? parseFloat(editForm.latitude)  : null,
        longitude:        editForm.longitude ? parseFloat(editForm.longitude) : null,
        isActive:         editForm.isActive,
      },
    });
    setEditSaving(false);
    if (res.ok) { setOrigins(prev => prev.map(o => o.id === editingId ? res.data : o)); setEditingId(null); }
    else setEditError((res as any).message ?? "Error al actualizar.");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este origen permanentemente?")) return;
    setDeletingId(id);
    await api(`/api/v1/analytics/origins/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setOrigins(prev => prev.filter(o => o.id !== id));
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return origins.filter(o => {
      const matchSearch = o.name.toLowerCase().includes(q) || o.municipalityName.toLowerCase().includes(q) || (o.address ?? "").toLowerCase().includes(q);
      const matchActive = filterActive === "all" || (filterActive === "active" ? o.isActive : !o.isActive);
      return matchSearch && matchActive;
    });
  }, [origins, search, filterActive]);

  const active = origins.filter(o => o.isActive).length;

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#a78bfa,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Orígenes Aliados
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {origins.length} establecimientos · {active} activos · Supermercados y comercios que venden productos económicos
          </p>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setEditingId(null); setFormError(null); }}
          style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#a78bfa,#60a5fa)", color: showForm ? "rgba(255,255,255,0.5)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
        >
          {showForm ? "✕ Cancelar" : "+ Agregar origen"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: "rgba(167,139,250,0.05)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: "#a78bfa" }}>Nuevo origen aliado</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Nombre del establecimiento *</label>
                <input style={inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Supermercado La Economía" required />
              </div>
              <div>
                <label style={lbl}>Municipio *</label>
                <input style={inp} value={form.municipalityName} onChange={e => set("municipalityName", e.target.value)} placeholder="Ej: Bogotá D.C." required />
              </div>
              <div style={{ gridColumn: "span 3" }}>
                <label style={lbl}>Dirección</label>
                <input style={inp} value={form.address} onChange={e => set("address", e.target.value)} placeholder="Ej: Carrera 15 # 32-45, Local 101" />
              </div>
              <div>
                <label style={lbl}>Latitud</label>
                <input style={inp} type="number" step="0.0001" value={form.latitude} onChange={e => set("latitude", e.target.value)} placeholder="4.6097" />
              </div>
              <div>
                <label style={lbl}>Longitud</label>
                <input style={inp} type="number" step="0.0001" value={form.longitude} onChange={e => set("longitude", e.target.value)} placeholder="-74.0817" />
              </div>
            </div>
            {formError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{formError}</div>}
            <button type="submit" disabled={saving} style={{ background: "linear-gradient(135deg,#a78bfa,#60a5fa)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontSize: 14 }}>
              {saving ? "Guardando…" : "Guardar origen"}
            </button>
          </form>
        </div>
      )}

      {/* Edit form */}
      {editingId && (
        <div style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#60a5fa" }}>✏️ Editando origen</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Nombre</label>
                <input style={inp} value={editForm.name} onChange={e => setE("name", e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Municipio</label>
                <input style={inp} value={editForm.municipalityName} onChange={e => setE("municipalityName", e.target.value)} required />
              </div>
              <div style={{ gridColumn: "span 3" }}>
                <label style={lbl}>Dirección</label>
                <input style={inp} value={editForm.address} onChange={e => setE("address", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Latitud</label>
                <input style={inp} type="number" step="0.0001" value={editForm.latitude} onChange={e => setE("latitude", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Longitud</label>
                <input style={inp} type="number" step="0.0001" value={editForm.longitude} onChange={e => setE("longitude", e.target.value)} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ ...lbl, marginBottom: 0 }}>Estado</label>
                <button
                  type="button"
                  onClick={() => setE("isActive", !editForm.isActive)}
                  style={{ padding: "6px 16px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, background: editForm.isActive ? "rgba(74,222,128,0.15)" : "rgba(148,163,184,0.15)", color: editForm.isActive ? "#4ade80" : "#94a3b8" }}
                >
                  {editForm.isActive ? "Activo" : "Inactivo"}
                </button>
              </div>
            </div>
            {editError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{editError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={editSaving} style={{ background: "linear-gradient(135deg,#60a5fa,#a78bfa)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {editSaving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, municipio o dirección…"
          style={{ ...inp, flex: 1, borderRadius: 12 }}
        />
        {(["all","active","inactive"] as const).map(f => (
          <button key={f}
            onClick={() => setFilterActive(f)}
            style={{ padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12, background: filterActive === f ? "linear-gradient(135deg,#a78bfa,#60a5fa)" : "rgba(255,255,255,0.06)", color: filterActive === f ? "#0a0a12" : "rgba(255,255,255,0.5)" }}
          >
            {f === "all" ? "Todos" : f === "active" ? "Activos" : "Inactivos"}
          </button>
        ))}
        <span style={{ color: "#475569", fontSize: 13 }}>{filtered.length} resultados</span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.3)" }}>Cargando orígenes…</div>
      ) : (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Establecimiento", "Municipio", "Dirección", "Coordenadas", "Estado", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr
                  key={o.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)")}
                >
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>🏪</span>
                      <div>
                        <div style={{ fontWeight: 600, color: "#fff" }}>{o.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>ID: {o.id.slice(0, 8)}…</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "#94a3b8" }}>{o.municipalityName}</td>
                  <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.5)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {o.address ?? <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {o.latitude != null
                      ? <span title={`${o.latitude}, ${o.longitude}`} style={{ fontSize: 16 }}>📍</span>
                      : <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: o.isActive ? "rgba(74,222,128,0.12)" : "rgba(148,163,184,0.12)", color: o.isActive ? "#4ade80" : "#94a3b8", border: `1px solid ${o.isActive ? "rgba(74,222,128,0.3)" : "rgba(148,163,184,0.2)"}` }}>
                      {o.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => startEdit(o)}
                        style={{ background: "rgba(96,165,250,0.08)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleDelete(o.id)}
                        disabled={deletingId === o.id}
                        style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
                    No hay orígenes registrados. Agrega el primer establecimiento aliado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
