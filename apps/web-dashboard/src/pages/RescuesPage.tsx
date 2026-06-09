import { useEffect, useState, useMemo } from "react";
import { fetchRescues, registerRescue, updateRescue } from "../services/rescues";
import { fetchOrigins, registerOrigin, updateOrigin, deleteOrigin } from "../services/origins";
import { fetchProducers } from "../services/producers";
import { useAuth } from "../hooks/useAuth";
import { DEPARTMENTS, getMunicipalitiesByDepartment, getDepartmentByMunicipalityName } from "../services/locations";

// ── Constants ────────────────────────────────────────────────
const CHANNELS = [
  { value: "food_bank",         label: "Banco de alimentos" },
  { value: "community_kitchen", label: "Comedor comunitario" },
  { value: "social_program",    label: "Programa social" },
  { value: "market_recovery",   label: "Recuperación mercado" },
];
const CHANNEL_COLOR: Record<string, string> = {
  food_bank: "#a78bfa", community_kitchen: "#f59e0b",
  social_program: "#60a5fa", market_recovery: "#4ade80",
};
const STATUS_COLOR: Record<string, [string, string]> = {
  scheduled:   ["#60a5fa", "Programado"],
  in_progress: ["#f59e0b", "En curso"],
  completed:   ["#4ade80", "Completado"],
  cancelled:   ["#f87171", "Cancelado"],
};
const CATEGORIES = ["tuberculo","hortaliza","fruta","cereal","leguminosa","lacteo","cacao","platano","yuca","otro"];
const COMMON_PRODUCTS: Record<string, string[]> = {
  tuberculo:   ["Papa criolla","Papa pastusa","Yuca","Batata","Remolacha","Zanahoria","Nabo"],
  hortaliza:   ["Lechuga","Tomate chonto","Espinaca","Acelga","Repollo","Pepino","Pimentón","Cebolla"],
  fruta:       ["Mango","Aguacate","Naranja","Mandarina","Banano","Maracuyá","Guayaba","Melón"],
  cereal:      ["Maíz amarillo","Arroz","Trigo","Cebada","Avena"],
  leguminosa:  ["Frijol","Arveja","Lenteja","Garbanzo","Soya"],
  lacteo:      ["Leche","Queso","Yogur","Mantequilla","Crema"],
  cacao:       ["Cacao fino","Cacao corriente"],
  platano:     ["Plátano hartón","Plátano dominico","Plátano barraganete"],
  yuca:        ["Yuca blanca","Yuca amarilla","Yuca brava"],
  otro:        ["Panela","Miel","Huevos","Aceite","Sal"],
};

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };

const emptyRescue = { originId: "", rescueChannel: "food_bank", destinationOrganizationName: "", productName: "", category: "hortaliza", unit: "kg", quantityRescued: "", scheduledAt: "", beneficiaryCount: "", departmentCode: "", municipalityName: "", notes: "", latitude: "", longitude: "", producerId: "", offerId: "" };
const emptyOrigin = { name: "", municipalityName: "", address: "", latitude: "", longitude: "" };

export function RescuesPage() {
  const { user } = useAuth();
  const [rescues, setRescues]     = useState<any[]>([]);
  const [origins, setOrigins]     = useState<any[]>([]);
  const [producers, setProducers] = useState<any[]>([]);
  const [search, setSearch]       = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [form, setForm]           = useState({ ...emptyRescue });
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [editForm, setEditForm]           = useState({ ...emptyRescue });
  const [editLoading, setEditLoading]     = useState(false);
  const [editError, setEditError]         = useState<string | null>(null);

  // Origins state
  const [showOrigins, setShowOrigins]         = useState(false);
  const [originForm, setOriginForm]           = useState({ ...emptyOrigin });
  const [editingOriginId, setEditingOriginId] = useState<string | null>(null);
  const [originSaving, setOriginSaving]       = useState(false);
  const [originFormError, setOriginFormError] = useState<string | null>(null);
  const [originDept, setOriginDept]           = useState("");

  useEffect(() => {
    fetchRescues().then(r => { if (r.ok) setRescues(r.data); });
    fetchOrigins().then(r => { if (r.ok) setOrigins(Array.isArray(r.data) ? r.data : (r.data as any)?.data ?? []); });
    fetchProducers(200).then(r => { if (r.ok) setProducers(r.data); });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rescues.filter(r =>
      r.destinationOrganizationName?.toLowerCase().includes(q) ||
      r.productName?.toLowerCase().includes(q) ||
      r.municipalityName?.toLowerCase().includes(q) ||
      r.rescueChannel?.toLowerCase().includes(q)
    );
  }, [rescues, search]);

  const originMap = useMemo(() => Object.fromEntries(origins.map((o: any) => [o.id, o])), [origins]);
  const producerMap = useMemo(() => Object.fromEntries(producers.map((p: any) => [p.id, p])), [producers]);

  const set  = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setE = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));
  const setO = (k: string, v: string) => setOriginForm(f => ({ ...f, [k]: v }));

  // When category changes in new form, clear productName
  const handleCategoryChange = (cat: string) => {
    setForm(f => ({ ...f, category: cat, productName: "" }));
  };
  const handleEditCategoryChange = (cat: string) => {
    setEditForm(f => ({ ...f, category: cat, productName: "" }));
  };

  // When department changes, clear municipality
  const handleDeptChange = (deptCode: string) => setForm(f => ({ ...f, departmentCode: deptCode, municipalityName: "" }));
  const handleEditDeptChange = (deptCode: string) => setEditForm(f => ({ ...f, departmentCode: deptCode, municipalityName: "" }));

  // Auto-detect department from existing municipalityName
  const getInitialDept = (municipalityName: string) => {
    const dept = getDepartmentByMunicipalityName(municipalityName);
    return dept?.code ?? "";
  };

  // ── Origins handlers ──────────────────────────────────────────
  const handleSaveOrigin = async () => {
    setOriginFormError(null);
    if (!originForm.name || !originForm.municipalityName) {
      setOriginFormError("Nombre y municipio son obligatorios."); return;
    }
    setOriginSaving(true);
    if (editingOriginId) {
      const res = await updateOrigin(editingOriginId, {
        name: originForm.name, municipalityName: originForm.municipalityName,
        address: originForm.address || null,
        latitude:  originForm.latitude  ? parseFloat(originForm.latitude)  : null,
        longitude: originForm.longitude ? parseFloat(originForm.longitude) : null,
      });
      if (res.ok) { setOrigins(prev => prev.map(o => o.id === editingOriginId ? res.data : o)); setEditingOriginId(null); }
      else setOriginFormError((res as any).message);
    } else {
      const res = await registerOrigin({
        tenantId: user?.tenantId ?? "",
        name: originForm.name, municipalityName: originForm.municipalityName,
        address: originForm.address || null,
        latitude:  originForm.latitude  ? parseFloat(originForm.latitude)  : null,
        longitude: originForm.longitude ? parseFloat(originForm.longitude) : null,
      });
      if (res.ok) setOrigins(prev => [...prev, res.data]);
      else setOriginFormError((res as any).message);
    }
    setOriginSaving(false);
    setOriginForm({ ...emptyOrigin });
    setOriginDept("");
  };

  const handleEditOrigin = (o: any) => {
    setEditingOriginId(o.id);
    setOriginForm({ name: o.name, municipalityName: o.municipalityName, address: o.address ?? "", latitude: o.latitude != null ? String(o.latitude) : "", longitude: o.longitude != null ? String(o.longitude) : "" });
    setOriginDept(getDepartmentByMunicipalityName(o.municipalityName || "")?.code ?? "");
    setOriginFormError(null);
  };
  const handleDeleteOrigin = async (id: string) => {
    if (!window.confirm("¿Eliminar este origen?")) return;
    const res = await deleteOrigin(id);
    if (res.ok) setOrigins(prev => prev.filter(o => o.id !== id));
  };

  // ── Rescue handlers ───────────────────────────────────────────
  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setEditForm({
      originId: record.originId || "", rescueChannel: record.rescueChannel || "food_bank",
      destinationOrganizationName: record.destinationOrganizationName || "",
      productName: record.productName || "", category: record.category || "hortaliza",
      unit: record.unit || "kg", quantityRescued: String(record.quantityRescued ?? ""),
      scheduledAt: record.scheduledAt?.slice(0, 10) || "",
      beneficiaryCount: String(record.beneficiaryCount ?? ""),
      departmentCode: getInitialDept(record.municipalityName || ""),
      municipalityName: record.municipalityName || "",
      notes: record.notes || "", latitude: String(record.latitude ?? ""), longitude: String(record.longitude ?? ""),
      producerId: record.producerId || "", offerId: record.offerId || "",
    });
    setEditError(null); setShowForm(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return;
    setEditLoading(true); setEditError(null);
    const res = await updateRescue(editingId, {
      ...editForm, originId: editForm.originId || null,
      quantityRescued: parseFloat(editForm.quantityRescued),
      beneficiaryCount: parseInt(editForm.beneficiaryCount),
      latitude: editForm.latitude ? parseFloat(editForm.latitude) : undefined,
      longitude: editForm.longitude ? parseFloat(editForm.longitude) : undefined,
    });
    setEditLoading(false);
    if (res.ok) { setRescues(u => u.map(x => x.id === editingId ? res.data : x)); setEditingId(null); }
    else setEditError((res as any).message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    const res = await registerRescue({
      ...form, tenantId: user?.tenantId ?? "",
      originId: form.originId || null, offerId: form.offerId || undefined,
      quantityRescued: parseFloat(form.quantityRescued),
      beneficiaryCount: parseInt(form.beneficiaryCount),
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      notes: form.notes || undefined,
    });
    setLoading(false);
    if (res.ok) { setRescues(u => [res.data, ...u]); setForm({ ...emptyRescue }); setShowForm(false); }
    else setError((res as any).message);
  };

  // Departamento+municipio selects
  const DeptMuniSelects = ({ deptCode, muniName, onDept, onMuni, required = false }: { deptCode: string; muniName: string; onDept: (v: string) => void; onMuni: (v: string) => void; required?: boolean }) => {
    const munis = deptCode ? getMunicipalitiesByDepartment(deptCode) : [];
    return (
      <>
        <div>
          <label style={lbl}>Departamento {required && "*"}</label>
          <select style={inp} value={deptCode} onChange={e => onDept(e.target.value)}>
            <option value="">— Seleccione —</option>
            {DEPARTMENTS.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Municipio {required && "*"}</label>
          <select style={inp} value={muniName} onChange={e => onMuni(e.target.value)} required={required} disabled={!deptCode}>
            <option value="">— Seleccione municipio —</option>
            {munis.map(m => <option key={m.code} value={m.name}>{m.name}</option>)}
          </select>
        </div>
      </>
    );
  };

  const CatProdSelects = ({ cat, prod, onCat, onProd }: { cat: string; prod: string; onCat: (v: string) => void; onProd: (v: string) => void }) => {
    const products = COMMON_PRODUCTS[cat] ?? [];
    return (
      <>
        <div>
          <label style={lbl}>Categoría *</label>
          <select style={inp} value={cat} onChange={e => onCat(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Producto *</label>
          <select style={inp} value={prod} onChange={e => onProd(e.target.value)} required>
            <option value="">— Seleccione —</option>
            {products.map(p => <option key={p} value={p}>{p}</option>)}
            <option value="__otro__">Otro (escribir abajo)</option>
          </select>
          {prod === "__otro__" && (
            <input style={{ ...inp, marginTop: 6 }} placeholder="Nombre del producto…" onChange={e => onProd(e.target.value)} />
          )}
        </div>
      </>
    );
  };

  return (
    <div style={{ color: "#fff", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#a78bfa,#f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Rescate Alimentario
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {rescues.length} rescates · {rescues.filter(r => r.status === "scheduled").length} programados
            {" · "}{origins.length} orígenes · {producers.length} productores
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowOrigins(v => !v)} style={{ background: showOrigins ? "rgba(255,255,255,0.07)" : "rgba(74,222,128,0.1)", color: showOrigins ? "rgba(255,255,255,0.5)" : "#4ade80", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 12, padding: "11px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
            📍 {showOrigins ? "Cerrar" : "Gestionar"} Orígenes ({origins.length})
          </button>
          <button onClick={() => { setShowForm(v => !v); setEditingId(null); }} style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#a78bfa,#f472b6)", color: showForm ? "rgba(255,255,255,0.6)" : "#fff", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
            {showForm ? "✕ Cancelar" : "+ Nuevo rescate"}
          </button>
        </div>
      </div>

      {/* Origins panel */}
      {showOrigins && (
        <div style={{ background: "rgba(74,222,128,0.03)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#4ade80" }}>📍 Orígenes de Alimentos</h3>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 12, fontWeight: 600 }}>{editingOriginId ? "✏️ Editando origen" : "Nuevo origen"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={lbl}>Nombre *</label><input style={inp} value={originForm.name} onChange={e => setO("name", e.target.value)} placeholder="Ej: Mercado Minorista" /></div>
              <div>
                <label style={lbl}>Departamento *</label>
                <select style={inp} value={originDept} onChange={e => { setOriginDept(e.target.value); setO("municipalityName", ""); }}>
                  <option value="">— Seleccione —</option>
                  {DEPARTMENTS.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Municipio *</label>
                <select style={inp} value={originForm.municipalityName} onChange={e => setO("municipalityName", e.target.value)} disabled={!originDept}>
                  <option value="">— Seleccione municipio —</option>
                  {(originDept ? getMunicipalitiesByDepartment(originDept) : []).map(m => <option key={m.code} value={m.name}>{m.name}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Dirección</label><input style={inp} value={originForm.address} onChange={e => setO("address", e.target.value)} /></div>
              <div><label style={lbl}>Latitud</label><input style={inp} type="number" step="0.0001" value={originForm.latitude} onChange={e => setO("latitude", e.target.value)} /></div>
              <div><label style={lbl}>Longitud</label><input style={inp} type="number" step="0.0001" value={originForm.longitude} onChange={e => setO("longitude", e.target.value)} /></div>
            </div>
            {originFormError && <div style={{ color: "#f87171", fontSize: 12, marginBottom: 10 }}>{originFormError}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSaveOrigin} disabled={originSaving} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#0a0a12", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                {originSaving ? "Guardando…" : editingOriginId ? "Guardar cambios" : "+ Agregar origen"}
              </button>
              {editingOriginId && (
                <button onClick={() => { setEditingOriginId(null); setOriginForm({ ...emptyOrigin }); setOriginDept(""); }} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
              )}
            </div>
          </div>
          {origins.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>No hay orígenes registrados.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {origins.map((o: any) => (
                <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: editingOriginId === o.id ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${editingOriginId === o.id ? "rgba(74,222,128,0.2)" : "rgba(255,255,255,0.06)"}`, borderRadius: 10 }}>
                  <span style={{ fontSize: 18 }}>📍</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{o.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{o.municipalityName}{o.address ? ` · ${o.address}` : ""}</div>
                  </div>
                  <button onClick={() => handleEditOrigin(o)} style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️</button>
                  <button onClick={() => handleDeleteOrigin(o.id)} style={{ background: "rgba(248,113,113,0.07)", color: "#f87171", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por organización, producto, municipio o canal…" style={{ ...inp, paddingLeft: 42, fontSize: 14, borderRadius: 12 }} />
      </div>

      {/* New rescue form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>+ Nuevo rescate</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Origen de los alimentos *</label>
              <select style={inp} value={form.originId} onChange={e => set("originId", e.target.value)} required>
                <option value="">— Seleccione un origen —</option>
                {origins.map(o => <option key={o.id} value={o.id}>{o.name} ({o.municipalityName})</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Canal de rescate *</label>
              <select style={inp} value={form.rescueChannel} onChange={e => set("rescueChannel", e.target.value)}>
                {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>ID Productor *</label>
              <select style={inp} value={form.producerId} onChange={e => set("producerId", e.target.value)} required>
                <option value="">— Seleccione productor —</option>
                {producers.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.organizationName} — {p.municipalityName}</option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={lbl}>Organización destino *</label>
              <input style={inp} value={form.destinationOrganizationName} onChange={e => set("destinationOrganizationName", e.target.value)} required />
            </div>
            <div>
              <label style={lbl}>ID Oferta</label>
              <input style={inp} value={form.offerId} onChange={e => set("offerId", e.target.value)} />
            </div>
            <CatProdSelects cat={form.category} prod={form.productName} onCat={handleCategoryChange} onProd={v => set("productName", v)} />
            <div>
              <label style={lbl}>Unidad *</label>
              <select style={inp} value={form.unit} onChange={e => set("unit", e.target.value)} required>
                {["kg","libra","tonelada","und","litro","arroba","bulto"].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Cantidad *</label>
              <input style={inp} type="number" min="0.01" step="0.01" value={form.quantityRescued} onChange={e => set("quantityRescued", e.target.value)} required />
            </div>
            <div>
              <label style={lbl}>Fecha programada *</label>
              <input style={inp} type="date" value={form.scheduledAt} onChange={e => set("scheduledAt", e.target.value)} required />
            </div>
            <div>
              <label style={lbl}>Beneficiarios *</label>
              <input style={inp} type="number" min="1" value={form.beneficiaryCount} onChange={e => set("beneficiaryCount", e.target.value)} required />
            </div>
            <DeptMuniSelects deptCode={form.departmentCode} muniName={form.municipalityName} onDept={handleDeptChange} onMuni={v => set("municipalityName", v)} required />
            <div style={{ gridColumn: "span 3" }}>
              <label style={lbl}>Notas</label>
              <input style={inp} value={form.notes} onChange={e => set("notes", e.target.value)} />
            </div>
          </div>
          {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
            {loading ? "Guardando…" : "Registrar rescate"}
          </button>
        </form>
      )}

      {/* Edit panel */}
      {editingId && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700 }}>✏️ Editando rescate</h3>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Origen de los alimentos *</label>
                <select style={inp} value={editForm.originId} onChange={e => setE("originId", e.target.value)} required>
                  <option value="">— Seleccione un origen —</option>
                  {origins.map(o => <option key={o.id} value={o.id}>{o.name} ({o.municipalityName})</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Canal de rescate *</label>
                <select style={inp} value={editForm.rescueChannel} onChange={e => setE("rescueChannel", e.target.value)} required>
                  {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Productor</label>
                <select style={inp} value={editForm.producerId} onChange={e => setE("producerId", e.target.value)}>
                  <option value="">— Sin productor —</option>
                  {producers.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.organizationName} — {p.municipalityName}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Organización destino</label>
                <input style={inp} value={editForm.destinationOrganizationName} onChange={e => setE("destinationOrganizationName", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Categoría</label>
                <select style={inp} value={editForm.category} onChange={e => handleEditCategoryChange(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Producto</label>
                <select style={inp} value={editForm.productName} onChange={e => setE("productName", e.target.value)}>
                  <option value="">— Seleccione —</option>
                  {(COMMON_PRODUCTS[editForm.category] ?? []).map(p => <option key={p} value={p}>{p}</option>)}
                  {editForm.productName && !(COMMON_PRODUCTS[editForm.category] ?? []).includes(editForm.productName) && (
                    <option value={editForm.productName}>{editForm.productName}</option>
                  )}
                </select>
              </div>
              <div>
                <label style={lbl}>Cantidad</label>
                <input style={inp} type="number" step="0.01" value={editForm.quantityRescued} onChange={e => setE("quantityRescued", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Beneficiarios</label>
                <input style={inp} type="number" value={editForm.beneficiaryCount} onChange={e => setE("beneficiaryCount", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Fecha programada</label>
                <input style={inp} type="date" value={editForm.scheduledAt} onChange={e => setE("scheduledAt", e.target.value)} />
              </div>
              <DeptMuniSelects deptCode={editForm.departmentCode} muniName={editForm.municipalityName} onDept={handleEditDeptChange} onMuni={v => setE("municipalityName", v)} />
              <div style={{ gridColumn: "span 3" }}>
                <label style={lbl}>Notas</label>
                <input style={inp} value={editForm.notes} onChange={e => setE("notes", e.target.value)} />
              </div>
            </div>
            {editError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{editError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={editLoading} style={{ background: "linear-gradient(135deg,#a78bfa,#f472b6)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {editLoading ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Table — with overflow-x:auto to prevent horizontal clipping */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Origen", "Productor", "Organización destino", "Producto", "Cantidad", "Fecha", "Beneficiarios", "Municipio", "Canal", "Estado", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const [sc, sl] = STATUS_COLOR[r.status] ?? ["#94a3b8", r.status];
                const ch = CHANNELS.find(c => c.value === r.rescueChannel);
                const origin = r.originId ? originMap[r.originId] : null;
                const producer = r.producerId ? producerMap[r.producerId] : null;
                return (
                  <tr key={r.id || i}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: editingId === r.id ? "rgba(245,158,11,0.04)" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={e => { if (editingId !== r.id) e.currentTarget.style.background = "rgba(167,139,250,0.04)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = editingId === r.id ? "rgba(245,158,11,0.04)" : "transparent"; }}>
                    <td style={{ padding: "12px 16px" }}>
                      {origin
                        ? <div><div style={{ fontSize: 12, fontWeight: 600, color: "#4ade80" }}>{origin.name}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{origin.municipalityName}</div></div>
                        : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {producer
                        ? <div><div style={{ fontSize: 11, fontWeight: 600, color: "#a78bfa" }}>{producer.organizationName}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{producer.municipalityName}</div></div>
                        : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>—</span>}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13, color: "#fff" }}>{r.destinationOrganizationName}</td>
                    <td style={{ padding: "12px 16px" }}><div style={{ fontSize: 13, color: "#fff" }}>{r.productName}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{r.category}</div></td>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#a78bfa", whiteSpace: "nowrap" }}>{r.quantityRescued?.toLocaleString()} <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{r.unit}</span></td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>{r.scheduledAt?.slice?.(0, 10)}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>{r.beneficiaryCount}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{r.municipalityName}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${CHANNEL_COLOR[r.rescueChannel] ?? "#94a3b8"}18`, color: CHANNEL_COLOR[r.rescueChannel] ?? "#94a3b8" }}>{ch?.label ?? r.rescueChannel}</span></td>
                    <td style={{ padding: "12px 16px" }}><span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${sc}18`, color: sc, border: `1px solid ${sc}33` }}>{sl}</span></td>
                    <td style={{ padding: "12px 16px" }}>
                      <button onClick={() => handleEdit(r)} style={{ background: editingId === r.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)", color: editingId === r.id ? "#f59e0b" : "rgba(255,255,255,0.5)", border: `1px solid ${editingId === r.id ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>✏️ Editar</button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>{search ? `Sin resultados para "${search}"` : "No hay rescates."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
