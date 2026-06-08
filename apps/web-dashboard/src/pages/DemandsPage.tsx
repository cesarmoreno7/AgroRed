import { useEffect, useState, useMemo } from "react";
import { fetchDemands, registerDemand, updateDemand } from "../services/demands";
import { fetchInstitutions } from "../services/institutions";
import { fetchProducts, type ProductCatalogItem } from "../services/products";
import { DEPARTMENTS, getMunicipalitiesByDepartment, getDepartmentByMunicipalityName } from "../services/locations";
import { useAuth } from "../hooks/useAuth";

const CHANNELS = [
  { value: "community_kitchen", label: "Comedor comunitario" },
  { value: "school_program",    label: "Programa escolar" },
  { value: "social_program",    label: "Programa social" },
  { value: "emergency_response",label: "Emergencia" },
];

// Mapeo institution_type → demand_channel
const INST_TYPE_TO_CHANNEL: Record<string, string> = {
  educational:       "school_program",
  community_canteen: "community_kitchen",
  hospital:          "social_program",
  prison:            "social_program",
  military:          "social_program",
  elderly_home:      "social_program",
  shelter:           "social_program",
  airport:           "social_program",
  other:             "social_program",
};

const CHANNEL_COLOR: Record<string, string> = {
  community_kitchen:  "#f59e0b",
  school_program:     "#60a5fa",
  social_program:     "#a78bfa",
  emergency_response: "#f87171",
};
const STATUS_COLOR: Record<string, [string, string]> = {
  open:      ["#4ade80", "Abierta"],
  matched:   ["#60a5fa", "Emparejada"],
  fulfilled: ["#94a3b8", "Atendida"],
  cancelled: ["#f87171", "Cancelada"],
};

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
const UNITS = ["kg","libra","tonelada","und","litro","arroba","bulto"];
const CATEGORIES = ["tuberculo","hortaliza","fruta","cereal","leguminosa","lacteo","cacao","platano","yuca","otro"];
const emptyForm = () => ({ institutionId: "", demandChannel: "community_kitchen", organizationName: "", productName: "", category: "hortaliza", unit: "kg", quantityRequired: "", neededBy: "", beneficiaryCount: "", municipalityName: "", notes: "", latitude: "", longitude: "" });

export function DemandsPage() {
  const { user } = useAuth();
  const [demands, setDemands]           = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [search, setSearch]             = useState("");
  const [showForm, setShowForm]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [form, setForm]                 = useState(emptyForm());
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editForm, setEditForm]         = useState(emptyForm());
  const [editLoading, setEditLoading]   = useState(false);
  const [editError, setEditError]       = useState<string | null>(null);
  const [products, setProducts]         = useState<ProductCatalogItem[]>([]);
  const [newDept, setNewDept]           = useState("");
  const [editDept, setEditDept]         = useState("");

  useEffect(() => {
    fetchDemands().then(r => { if (r.ok) setDemands(r.data); });
    fetchInstitutions().then(r => {
      if (r.ok) setInstitutions((r.data as any[]).filter((i: any) => i.status === "active"));
    });
    fetchProducts().then(r => { if (r.ok) setProducts(r.data); });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return demands.filter(d =>
      d.organizationName?.toLowerCase().includes(q) ||
      d.productName?.toLowerCase().includes(q) ||
      d.municipalityName?.toLowerCase().includes(q) ||
      d.demandChannel?.toLowerCase().includes(q)
    );
  }, [demands, search]);

  // Cuando el usuario elige una institución, auto-rellena el formulario
  const applyInstitution = (instId: string, target: "new" | "edit") => {
    const inst = institutions.find((i: any) => i.id === instId);
    const setter = target === "new" ? setForm : setEditForm;
    if (!inst) {
      setter(f => ({ ...f, institutionId: instId }));
      return;
    }
    const dept = getDepartmentByMunicipalityName(inst.municipalityName ?? "");
    if (target === "new") setNewDept(dept?.code ?? "");
    else setEditDept(dept?.code ?? "");
    setter(f => ({
      ...f,
      institutionId:    inst.id,
      organizationName: inst.name,
      municipalityName: inst.municipalityName,
      beneficiaryCount: String(inst.beneficiaryCount ?? ""),
      demandChannel:    INST_TYPE_TO_CHANNEL[inst.institutionType] ?? f.demandChannel,
    }));
  };

  const set  = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setE = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setEditForm({
      institutionId:    record.institutionId || "",
      demandChannel:    record.demandChannel || "community_kitchen",
      organizationName: record.organizationName || "",
      productName:      record.productName || "",
      category:         record.category || "hortaliza",
      unit:             record.unit || "kg",
      quantityRequired: String(record.quantityRequired ?? ""),
      neededBy:         record.neededBy?.slice(0, 10) || "",
      beneficiaryCount: String(record.beneficiaryCount ?? ""),
      municipalityName: record.municipalityName || "",
      notes:            record.notes || "",
      latitude:         String(record.latitude ?? ""),
      longitude:        String(record.longitude ?? ""),
    });
    setEditDept(getDepartmentByMunicipalityName(record.municipalityName || "")?.code ?? "");
    setEditError(null); setShowForm(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setEditLoading(true); setEditError(null);
    const res = await updateDemand(editingId, {
      ...editForm,
      institutionId:    editForm.institutionId || null,
      quantityRequired: parseFloat(editForm.quantityRequired),
      beneficiaryCount: parseInt(editForm.beneficiaryCount),
      latitude:         editForm.latitude  ? parseFloat(editForm.latitude)  : undefined,
      longitude:        editForm.longitude ? parseFloat(editForm.longitude) : undefined,
    });
    setEditLoading(false);
    if (res.ok) { setDemands(u => u.map(x => x.id === editingId ? res.data : x)); setEditingId(null); }
    else setEditError((res as any).message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await registerDemand({
      ...form,
      tenantId:         user?.tenantId ?? "",
      institutionId:    form.institutionId || null,
      quantityRequired: parseFloat(form.quantityRequired),
      beneficiaryCount: parseInt(form.beneficiaryCount),
      latitude:         form.latitude  ? parseFloat(form.latitude)  : undefined,
      longitude:        form.longitude ? parseFloat(form.longitude) : undefined,
      notes:            form.notes || undefined,
    });
    setLoading(false);
    if (res.ok) { setDemands(u => [res.data, ...u]); setForm(emptyForm()); setShowForm(false); }
    else setError((res as any).message);
  };

  const institutionName = (id?: string | null) => {
    if (!id) return null;
    return institutions.find((i: any) => i.id === id)?.name ?? null;
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const InstitutionSelector = ({ value, onChange }: { value: string; onChange: (id: string) => void }) => (
    <div>
      <label style={lbl}>Institución (opcional)</label>
      <select style={inp} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— Sin institución registrada —</option>
        {institutions.map((i: any) => (
          <option key={i.id} value={i.id}>{i.name} · {i.municipalityName}</option>
        ))}
      </select>
      {value && (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
          Los campos Organización, Municipio, Beneficiarios y Canal se auto-completaron desde la institución.
        </p>
      )}
    </div>
  );

  return (
    <div style={{ color: "#fff", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#f59e0b,#fb923c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Demandas Alimentarias
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {demands.length} demandas · {demands.filter(d => d.status === "open").length} abiertas
            {institutions.length > 0 && ` · ${institutions.length} instituciones activas`}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setEditingId(null); }}
          style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#f59e0b,#fb923c)", color: showForm ? "rgba(255,255,255,0.6)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
          {showForm ? "✕ Cancelar" : "+ Nueva demanda"}
        </button>
      </div>

      {/* ── Búsqueda ───────────────────────────────────────────────────────── */}
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por organización, producto, municipio o canal…" style={{ ...inp, paddingLeft: 42, fontSize: 14, borderRadius: 12 }} />
      </div>

      {/* ── Formulario nueva demanda ────────────────────────────────────────── */}
      {showForm && (
        <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>Nueva demanda</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>

              {/* Selector de institución — abarca toda la fila */}
              <div style={{ gridColumn: "span 3" }}>
                <InstitutionSelector value={form.institutionId} onChange={id => applyInstitution(id, "new")} />
              </div>

              <div>
                <label style={lbl}>Canal *</label>
                <select style={inp} value={form.demandChannel} onChange={e => set("demandChannel", e.target.value)}>
                  {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Organización *</label>
                <input style={inp} value={form.organizationName} onChange={e => set("organizationName", e.target.value)} required />
              </div>

              <div>
                <label style={lbl}>Producto *</label>
                <input style={inp} value={form.productName} list="demands-products-list" onChange={e => { const p = products.find(x => x.name === e.target.value); set("productName", e.target.value); if (p) { set("category", p.category); set("unit", p.unit); } }} required />
                <datalist id="demands-products-list">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
              </div>
              <div>
                <label style={lbl}>Categoría *</label>
                <select style={inp} value={form.category} onChange={e => set("category", e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Unidad *</label>
                <select style={inp} value={form.unit} onChange={e => set("unit", e.target.value)}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div><label style={lbl}>Cantidad *</label><input style={inp} type="number" min="0.01" step="0.01" value={form.quantityRequired} onChange={e => set("quantityRequired", e.target.value)} required /></div>
              <div><label style={lbl}>Fecha límite *</label><input style={inp} type="date" value={form.neededBy} onChange={e => set("neededBy", e.target.value)} required /></div>
              <div><label style={lbl}>Beneficiarios *</label><input style={inp} type="number" min="1" value={form.beneficiaryCount} onChange={e => set("beneficiaryCount", e.target.value)} required /></div>

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
              <div><label style={lbl}>Latitud</label><input style={inp} type="number" step="0.0001" value={form.latitude} onChange={e => set("latitude", e.target.value)} /></div>
              <div><label style={lbl}>Longitud</label><input style={inp} type="number" step="0.0001" value={form.longitude} onChange={e => set("longitude", e.target.value)} /></div>

              <div style={{ gridColumn: "span 3" }}><label style={lbl}>Notas</label><input style={inp} value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ background: "linear-gradient(135deg,#f59e0b,#fb923c)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              {loading ? "Guardando…" : "Registrar demanda"}
            </button>
          </form>
        </div>
      )}

      {/* ── Formulario edición ─────────────────────────────────────────────── */}
      {editingId && (
        <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>✏️ Editando demanda</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>

              <div style={{ gridColumn: "span 3" }}>
                <InstitutionSelector value={editForm.institutionId} onChange={id => applyInstitution(id, "edit")} />
              </div>

              <div>
                <label style={lbl}>Canal</label>
                <select style={inp} value={editForm.demandChannel} onChange={e => setE("demandChannel", e.target.value)}>
                  {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Organización</label>
                <input style={inp} value={editForm.organizationName} onChange={e => setE("organizationName", e.target.value)} />
              </div>

              <div>
                <label style={lbl}>Producto</label>
                <input style={inp} value={editForm.productName} list="demands-edit-products-list" onChange={e => { const p = products.find(x => x.name === e.target.value); setE("productName", e.target.value); if (p) { setE("category", p.category); setE("unit", p.unit); } }} />
                <datalist id="demands-edit-products-list">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
              </div>
              <div>
                <label style={lbl}>Categoría</label>
                <select style={inp} value={editForm.category} onChange={e => setE("category", e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Unidad</label>
                <select style={inp} value={editForm.unit} onChange={e => setE("unit", e.target.value)}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Cantidad</label><input style={inp} type="number" step="0.01" value={editForm.quantityRequired} onChange={e => setE("quantityRequired", e.target.value)} /></div>
              <div><label style={lbl}>Beneficiarios</label><input style={inp} type="number" value={editForm.beneficiaryCount} onChange={e => setE("beneficiaryCount", e.target.value)} /></div>
              <div><label style={lbl}>Fecha límite</label><input style={inp} type="date" value={editForm.neededBy} onChange={e => setE("neededBy", e.target.value)} /></div>
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
              <div style={{ gridColumn: "span 3" }}><label style={lbl}>Notas</label><input style={inp} value={editForm.notes} onChange={e => setE("notes", e.target.value)} /></div>
            </div>
            {editError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{editError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={editLoading} style={{ background: "linear-gradient(135deg,#f59e0b,#fb923c)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {editLoading ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Organización / Institución", "Producto", "Cantidad", "Límite", "Beneficiarios", "Municipio", "Canal", "Estado", "Acciones"].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const [sc, sl] = STATUS_COLOR[d.status] ?? ["#94a3b8", d.status];
              const ch = CHANNELS.find(c => c.value === d.demandChannel);
              const instName = institutionName(d.institutionId);
              return (
                <tr key={d.id || i}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: editingId === d.id ? "rgba(245,158,11,0.04)" : "transparent", transition: "background 0.15s" }}
                  onMouseEnter={e => { if (editingId !== d.id) e.currentTarget.style.background = "rgba(245,158,11,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = editingId === d.id ? "rgba(245,158,11,0.04)" : "transparent"; }}>

                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{d.organizationName}</div>
                    {instName && (
                      <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                        🏛️ {instName}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontSize: 13, color: "#fff" }}>{d.productName}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{d.category}</div>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>
                    {d.quantityRequired?.toLocaleString()} <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{d.unit}</span>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{d.neededBy?.slice?.(0, 10)}</td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>{d.beneficiaryCount}</td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{d.municipalityName}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${CHANNEL_COLOR[d.demandChannel] ?? "#94a3b8"}18`, color: CHANNEL_COLOR[d.demandChannel] ?? "#94a3b8" }}>
                      {ch?.label ?? d.demandChannel}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${sc}18`, color: sc, border: `1px solid ${sc}33` }}>{sl}</span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <button onClick={() => handleEdit(d)} style={{ background: editingId === d.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)", color: editingId === d.id ? "#f59e0b" : "rgba(255,255,255,0.5)", border: `1px solid ${editingId === d.id ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      ✏️ Editar
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
                {search ? `Sin resultados para "${search}"` : "No hay demandas registradas."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
