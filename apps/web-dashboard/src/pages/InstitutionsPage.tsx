import { useEffect, useState, useMemo } from "react";
import { fetchInstitutions, registerInstitution, updateInstitution, updateInstitutionStatus, deleteInstitution } from "../services/institutions";
import { DEPARTMENTS, getMunicipalitiesByDepartment, getDepartmentByMunicipalityName } from "../services/locations";
import { useAuth } from "../hooks/useAuth";

const INSTITUTION_TYPES = [
  { value: "educational",       label: "Institución Educativa" },
  { value: "hospital",          label: "Hospital / Centro de Salud" },
  { value: "prison",            label: "Centro Penitenciario" },
  { value: "community_canteen", label: "Comedor Comunitario" },
  { value: "airport",           label: "Aeropuerto" },
  { value: "military",          label: "Base Militar" },
  { value: "elderly_home",      label: "Hogar de Adultos Mayores" },
  { value: "shelter",           label: "Albergue / Refugio" },
  { value: "other",             label: "Otra Institución" },
];

const TYPE_COLOR: Record<string, string> = {
  educational: "#60a5fa",
  hospital: "#34d399",
  prison: "#f87171",
  community_canteen: "#f59e0b",
  airport: "#a78bfa",
  military: "#94a3b8",
  elderly_home: "#fb923c",
  shelter: "#38bdf8",
  other: "#6b7280"
};

const STATUS_CONFIG: Record<string, [string, string]> = {
  pending_verification: ["#f59e0b", "Pendiente"],
  active: ["#4ade80", "Activa"],
  inactive: ["#94a3b8", "Inactiva"]
};

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10, color: "#fff", fontSize: 13,
  outline: "none", boxSizing: "border-box"
};
const lbl: React.CSSProperties = {
  display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)",
  marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em"
};

const EMPTY_FORM = {
  institutionType: "educational", name: "", contactName: "", contactPhone: "",
  contactEmail: "", municipalityName: "", address: "", beneficiaryCount: "",
  productCategories: "", notes: "", latitude: "", longitude: ""
};

export function InstitutionsPage() {
  const { user } = useAuth();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newDept, setNewDept] = useState("");
  const [editDept, setEditDept] = useState("");

  useEffect(() => {
    fetchInstitutions().then(r => { if (r.ok) setInstitutions(r.data as any[]); });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return institutions.filter(i => {
      const matchSearch = !q || i.name?.toLowerCase().includes(q) || i.municipalityName?.toLowerCase().includes(q) || i.contactName?.toLowerCase().includes(q);
      const matchType = typeFilter === "all" || i.institutionType === typeFilter;
      return matchSearch && matchType;
    });
  }, [institutions, search, typeFilter]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setE = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setEditForm({
      institutionType: record.institutionType || "educational",
      name: record.name || "",
      contactName: record.contactName || "",
      contactPhone: record.contactPhone || "",
      contactEmail: record.contactEmail || "",
      municipalityName: record.municipalityName || "",
      address: record.address || "",
      beneficiaryCount: String(record.beneficiaryCount ?? ""),
      productCategories: (record.productCategories || []).join(", "),
      notes: record.notes || "",
      latitude: String(record.latitude ?? ""),
      longitude: String(record.longitude ?? "")
    });
    setEditDept(getDepartmentByMunicipalityName(record.municipalityName || "")?.code ?? "");
    setEditError(null);
    setShowForm(false);
  };

  const parseCategories = (v: string) => v.split(",").map(s => s.trim()).filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await registerInstitution({
      ...form,
      tenantId: user?.tenantId ?? "",
      beneficiaryCount: parseInt(form.beneficiaryCount),
      productCategories: parseCategories(form.productCategories),
      contactEmail: form.contactEmail || null,
      address: form.address || null,
      notes: form.notes || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null
    });
    setLoading(false);
    if (res.ok) {
      setInstitutions(u => [res.data, ...u]);
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
    } else {
      setError((res as any).message ?? "Error al registrar la institución.");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setEditLoading(true); setEditError(null);
    const res = await updateInstitution(editingId, {
      institutionType: editForm.institutionType,
      name: editForm.name,
      contactName: editForm.contactName,
      contactPhone: editForm.contactPhone,
      contactEmail: editForm.contactEmail || null,
      municipalityName: editForm.municipalityName,
      address: editForm.address || null,
      beneficiaryCount: parseInt(editForm.beneficiaryCount),
      productCategories: parseCategories(editForm.productCategories),
      notes: editForm.notes || null,
      latitude: editForm.latitude ? parseFloat(editForm.latitude) : null,
      longitude: editForm.longitude ? parseFloat(editForm.longitude) : null
    });
    setEditLoading(false);
    if (res.ok) {
      setInstitutions(u => u.map(x => x.id === editingId ? res.data : x));
      setEditingId(null);
    } else {
      setEditError((res as any).message ?? "Error al actualizar.");
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await updateInstitutionStatus(id, status);
    if (res.ok) setInstitutions(u => u.map(x => x.id === id ? res.data : x));
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar esta institución? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    await deleteInstitution(id);
    setInstitutions(u => u.filter(x => x.id !== id));
    if (editingId === id) setEditingId(null);
    setDeletingId(null);
  };

  const activeCount = institutions.filter(i => i.status === "active").length;
  const totalBeneficiaries = institutions.reduce((sum, i) => sum + (i.beneficiaryCount || 0), 0);

  return (
    <div style={{ color: "#fff", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#34d399,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Instituciones
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {institutions.length} instituciones · {activeCount} activas · {totalBeneficiaries.toLocaleString()} beneficiarios
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setEditingId(null); }}
          style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#34d399,#60a5fa)", color: showForm ? "rgba(255,255,255,0.6)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
        >
          {showForm ? "✕ Cancelar" : "+ Nueva institución"}
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { label: "Total instituciones", value: institutions.length, color: "#60a5fa" },
          { label: "Activas", value: activeCount, color: "#4ade80" },
          { label: "Pendientes", value: institutions.filter(i => i.status === "pending_verification").length, color: "#f59e0b" },
          { label: "Beneficiarios totales", value: totalBeneficiaries.toLocaleString(), color: "#a78bfa" }
        ].map(kpi => (
          <div key={kpi.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, municipio o contacto…" style={{ ...inp, paddingLeft: 42, fontSize: 14, borderRadius: 12 }} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inp, width: 220 }}>
          <option value="all">Todos los tipos</option>
          {INSTITUTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Register form */}
      {showForm && (
        <div style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#34d399" }}>Nueva institución</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Tipo *</label>
                <select style={inp} value={form.institutionType} onChange={e => set("institutionType", e.target.value)}>
                  {INSTITUTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Nombre de la institución *</label>
                <input style={inp} value={form.name} onChange={e => set("name", e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Nombre de contacto *</label>
                <input style={inp} value={form.contactName} onChange={e => set("contactName", e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Teléfono *</label>
                <input style={inp} value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Email de contacto</label>
                <input style={inp} type="email" value={form.contactEmail} onChange={e => set("contactEmail", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Departamento *</label>
                <select style={inp} value={newDept} onChange={e => { setNewDept(e.target.value); set("municipalityName", ""); }}>
                  <option value="">— Seleccione —</option>
                  {DEPARTMENTS.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Municipio *</label>
                <select style={inp} value={form.municipalityName} onChange={e => set("municipalityName", e.target.value)} required disabled={!newDept}>
                  <option value="">— Seleccione municipio —</option>
                  {(newDept ? getMunicipalitiesByDepartment(newDept) : []).map(m => <option key={m.code} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Dirección</label>
                <input style={inp} value={form.address} onChange={e => set("address", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Beneficiarios/día *</label>
                <input style={inp} type="number" min="1" value={form.beneficiaryCount} onChange={e => set("beneficiaryCount", e.target.value)} required />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Categorías de productos * (separadas por coma)</label>
                <input style={inp} placeholder="ej: Frutas, Verduras, Lácteos" value={form.productCategories} onChange={e => set("productCategories", e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Latitud</label>
                <input style={inp} type="number" step="0.0001" value={form.latitude} onChange={e => set("latitude", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Longitud</label>
                <input style={inp} type="number" step="0.0001" value={form.longitude} onChange={e => set("longitude", e.target.value)} />
              </div>
              <div style={{ gridColumn: "span 3" }}>
                <label style={lbl}>Notas</label>
                <input style={inp} value={form.notes} onChange={e => set("notes", e.target.value)} />
              </div>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ background: "linear-gradient(135deg,#34d399,#60a5fa)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              {loading ? "Guardando…" : "Registrar institución"}
            </button>
          </form>
        </div>
      )}

      {/* Edit form */}
      {editingId && (
        <div style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#60a5fa" }}>✏️ Editando institución</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Tipo</label>
                <select style={inp} value={editForm.institutionType} onChange={e => setE("institutionType", e.target.value)}>
                  {INSTITUTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Nombre</label>
                <input style={inp} value={editForm.name} onChange={e => setE("name", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Contacto</label>
                <input style={inp} value={editForm.contactName} onChange={e => setE("contactName", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Teléfono</label>
                <input style={inp} value={editForm.contactPhone} onChange={e => setE("contactPhone", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input style={inp} type="email" value={editForm.contactEmail} onChange={e => setE("contactEmail", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Departamento</label>
                <select style={inp} value={editDept} onChange={e => { setEditDept(e.target.value); setE("municipalityName", ""); }}>
                  <option value="">— Seleccione —</option>
                  {DEPARTMENTS.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Municipio</label>
                <select style={inp} value={editForm.municipalityName} onChange={e => setE("municipalityName", e.target.value)} disabled={!editDept}>
                  <option value="">— Seleccione municipio —</option>
                  {(editDept ? getMunicipalitiesByDepartment(editDept) : []).map(m => <option key={m.code} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Beneficiarios/día</label>
                <input style={inp} type="number" min="1" value={editForm.beneficiaryCount} onChange={e => setE("beneficiaryCount", e.target.value)} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Categorías (separadas por coma)</label>
                <input style={inp} value={editForm.productCategories} onChange={e => setE("productCategories", e.target.value)} />
              </div>
              <div style={{ gridColumn: "span 3" }}>
                <label style={lbl}>Dirección</label>
                <input style={inp} value={editForm.address} onChange={e => setE("address", e.target.value)} />
              </div>
              <div style={{ gridColumn: "span 3" }}>
                <label style={lbl}>Notas</label>
                <input style={inp} value={editForm.notes} onChange={e => setE("notes", e.target.value)} />
              </div>
            </div>
            {editError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{editError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={editLoading} style={{ background: "linear-gradient(135deg,#60a5fa,#a78bfa)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {editLoading ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Institución", "Tipo", "Municipio", "Contacto", "Beneficiarios/día", "Estado", "Acciones"].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((inst, i) => {
              const typeObj = INSTITUTION_TYPES.find(t => t.value === inst.institutionType);
              const typeColor = TYPE_COLOR[inst.institutionType] ?? "#94a3b8";
              const [sc] = STATUS_CONFIG[inst.status] ?? ["#94a3b8", inst.status];
              const isEditing = editingId === inst.id;
              return (
                <tr key={inst.id || i}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: isEditing ? "rgba(96,165,250,0.04)" : "transparent", transition: "background 0.15s" }}
                  onMouseEnter={e => { if (!isEditing) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isEditing ? "rgba(96,165,250,0.04)" : "transparent"; }}
                >
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{inst.name}</div>
                    {inst.address && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{inst.address}</div>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${typeColor}18`, color: typeColor }}>
                      {typeObj?.label ?? inst.institutionType}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{inst.municipalityName}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontSize: 13, color: "#fff" }}>{inst.contactName}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{inst.contactPhone}</div>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 14, fontWeight: 700, color: "#60a5fa", textAlign: "center" }}>
                    {inst.beneficiaryCount?.toLocaleString()}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <select
                      value={inst.status}
                      onChange={e => handleStatusChange(inst.id, e.target.value)}
                      style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}33`, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", outline: "none" }}
                    >
                      <option value="pending_verification">Pendiente</option>
                      <option value="active">Activa</option>
                      <option value="inactive">Inactiva</option>
                    </select>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => handleEdit(inst)}
                        style={{ background: isEditing ? "rgba(96,165,250,0.15)" : "rgba(255,255,255,0.05)", color: isEditing ? "#60a5fa" : "rgba(255,255,255,0.5)", border: `1px solid ${isEditing ? "rgba(96,165,250,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        ✏️
                      </button>
                      <button onClick={() => handleDelete(inst.id)} disabled={deletingId === inst.id}
                        style={{ background: "rgba(248,113,113,0.07)", color: "#f87171", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 48, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
                  {search || typeFilter !== "all" ? "Sin resultados para los filtros aplicados." : "No hay instituciones registradas. Crea la primera."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
