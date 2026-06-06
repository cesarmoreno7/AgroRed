import { useEffect, useState, useMemo } from "react";
import { fetchInventory, registerInventoryItem, updateInventoryItem } from "../services/inventory";
import { fetchProducts } from "../services/products";
import type { ProductCatalogItem } from "../services/products";
import { fetchProducers } from "../services/producers";
import { useAuth } from "../hooks/useAuth";
import { DEPARTMENTS, getMunicipalitiesByDepartment, getDepartmentByMunicipalityName } from "../services/locations";

const SOURCE_TYPES = [
  { value: "offer_stock",    label: "Stock de oferta" },
  { value: "rescued_stock",  label: "Stock rescatado" },
  { value: "buffer_stock",   label: "Stock buffer" },
];
const SOURCE_COLOR: Record<string, string> = { offer_stock: "#22d3ee", rescued_stock: "#a78bfa", buffer_stock: "#f59e0b" };
const STATUS_COLOR: Record<string, [string, string]> = {
  available: ["#4ade80","Disponible"],
  reserved:  ["#f59e0b","Reservado"],
  depleted:  ["#f87171","Agotado"],
  expired:   ["#94a3b8","Vencido"],
};

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
const empty = { producerId: "", offerId: "", rescueId: "", sourceType: "offer_stock", storageLocationName: "", productId: "", productName: "", category: "hortaliza", unit: "kg", quantityOnHand: "", quantityReserved: "", departmentCode: "", municipalityName: "", notes: "", expiresAt: "", latitude: "", longitude: "" };

export function InventoryPage() {
  const { user } = useAuth();
  const [items, setItems]         = useState<any[]>([]);
  const [products, setProducts]   = useState<ProductCatalogItem[]>([]);
  const [producers, setProducers] = useState<any[]>([]);
  const [search, setSearch]       = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [form, setForm]           = useState({ ...empty });
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editForm, setEditForm]         = useState({ ...empty });
  const [editLoading, setEditLoading]   = useState(false);
  const [editError, setEditError]       = useState<string | null>(null);

  useEffect(() => {
    fetchInventory().then(r => { if (r.ok) setItems(r.data); });
    fetchProducts(user?.tenantId).then(r => { if (r.ok) setProducts(r.data); });
    fetchProducers(200).then(r => { if (r.ok) setProducers(r.data); });
  }, [user?.tenantId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(i =>
      i.productName?.toLowerCase().includes(q) ||
      i.storageLocationName?.toLowerCase().includes(q) ||
      i.municipalityName?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const totalUnits = items.reduce((s, i) => s + (i.quantityOnHand ?? 0), 0);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setE = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  // When product is selected from catalog, fill name, category and unit
  const handleProductSelect = (productId: string, setter: typeof set) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setter("productId", productId);
      setter("productName", product.name);
      setter("category", product.category);
      setter("unit", product.unit);
    } else {
      setter("productId", "");
    }
  };

  // Linked dept + municipality
  const handleDeptChange = (v: string) => setForm(f => ({ ...f, departmentCode: v, municipalityName: "" }));
  const handleEditDeptChange = (v: string) => setEditForm(f => ({ ...f, departmentCode: v, municipalityName: "" }));

  const getInitialDept = (municipalityName: string) => getDepartmentByMunicipalityName(municipalityName)?.code ?? "";

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setEditForm({
      producerId: record.producerId || "", offerId: record.offerId || "", rescueId: record.rescueId || "",
      sourceType: record.sourceType || "offer_stock", storageLocationName: record.storageLocationName || "",
      productId: "", productName: record.productName || "", category: record.category || "hortaliza",
      unit: record.unit || "kg", quantityOnHand: String(record.quantityOnHand ?? ""),
      quantityReserved: String(record.quantityReserved ?? ""),
      departmentCode: getInitialDept(record.municipalityName || ""),
      municipalityName: record.municipalityName || "",
      notes: record.notes || "", expiresAt: record.expiresAt?.slice(0,10) || "",
      latitude: String(record.latitude ?? ""), longitude: String(record.longitude ?? ""),
    });
    setEditError(null); setShowForm(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return;
    setEditLoading(true); setEditError(null);
    const res = await updateInventoryItem(editingId, {
      ...editForm,
      quantityOnHand: parseFloat(editForm.quantityOnHand),
      quantityReserved: editForm.quantityReserved ? parseFloat(editForm.quantityReserved) : undefined,
      latitude: editForm.latitude ? parseFloat(editForm.latitude) : undefined,
      longitude: editForm.longitude ? parseFloat(editForm.longitude) : undefined,
      expiresAt: editForm.expiresAt || undefined,
    });
    setEditLoading(false);
    if (res.ok) { setItems(u => u.map(x => x.id === editingId ? res.data : x)); setEditingId(null); }
    else setEditError((res as any).message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    const res = await registerInventoryItem({
      ...form, tenantId: user?.tenantId ?? "",
      offerId: form.offerId || undefined, rescueId: form.rescueId || undefined,
      quantityOnHand: parseFloat(form.quantityOnHand),
      quantityReserved: form.quantityReserved ? parseFloat(form.quantityReserved) : undefined,
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      expiresAt: form.expiresAt || undefined, notes: form.notes || undefined,
    });
    setLoading(false);
    if (res.ok) { setItems(u => [res.data, ...u]); setForm({ ...empty }); setShowForm(false); }
    else setError((res as any).message);
  };

  const DeptMuniSelects = ({ deptCode, muniName, onDept, onMuni, required = false }: { deptCode: string; muniName: string; onDept: (v: string) => void; onMuni: (v: string) => void; required?: boolean }) => {
    const munis = deptCode ? getMunicipalitiesByDepartment(deptCode) : [];
    return (
      <>
        <div>
          <label style={lbl}>Departamento</label>
          <select style={inp} value={deptCode} onChange={e => onDept(e.target.value)}>
            <option value="">— Seleccione —</option>
            {DEPARTMENTS.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Municipio {required && "*"}</label>
          <select style={inp} value={muniName} onChange={e => onMuni(e.target.value)} required={required} disabled={!deptCode}>
            <option value="">— Seleccione —</option>
            {munis.map(m => <option key={m.code} value={m.name}>{m.name}</option>)}
          </select>
        </div>
      </>
    );
  };

  return (
    <div style={{ color: "#fff", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#22d3ee,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Inventario Alimentario</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{items.length} ítems · {totalUnits.toLocaleString()} unidades totales · {products.length} productos en catálogo</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditingId(null); }} style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#22d3ee,#60a5fa)", color: showForm ? "rgba(255,255,255,0.6)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
          {showForm ? "✕ Cancelar" : "+ Nuevo ítem"}
        </button>
      </div>

      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por producto, ubicación, municipio o categoría…" style={{ ...inp, paddingLeft: 42, fontSize: 14, borderRadius: 12 }} />
      </div>

      {showForm && (
        <div style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#22d3ee" }}>Nuevo ítem de inventario</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              {/* Productor */}
              <div>
                <label style={lbl}>Productor *</label>
                <select style={inp} value={form.producerId} onChange={e => set("producerId", e.target.value)} required>
                  <option value="">— Seleccione —</option>
                  {producers.map((p: any) => <option key={p.id} value={p.id}>{p.organizationName} — {p.municipalityName}</option>)}
                </select>
              </div>
              <div><label style={lbl}>ID Oferta</label><input style={inp} value={form.offerId} onChange={e => set("offerId", e.target.value)} /></div>
              <div><label style={lbl}>ID Rescate</label><input style={inp} value={form.rescueId} onChange={e => set("rescueId", e.target.value)} /></div>
              <div>
                <label style={lbl}>Tipo de stock *</label>
                <select style={inp} value={form.sourceType} onChange={e => set("sourceType", e.target.value)}>
                  {SOURCE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Ubicación (bodega/punto) *</label>
                <input style={inp} value={form.storageLocationName} onChange={e => set("storageLocationName", e.target.value)} required />
              </div>
              {/* Producto desde catálogo */}
              <div>
                <label style={lbl}>Producto del catálogo *</label>
                <select style={inp} value={form.productId} onChange={e => handleProductSelect(e.target.value, set)} required>
                  <option value="">— Seleccione producto —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Categoría</label>
                <input style={{ ...inp, background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.5)" }} value={form.category} readOnly />
              </div>
              <div>
                <label style={lbl}>Unidad</label>
                <input style={{ ...inp, background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.5)" }} value={form.unit} readOnly />
              </div>
              <div>
                <label style={lbl}>Cantidad disponible *</label>
                <input style={inp} type="number" min="0.01" step="0.01" value={form.quantityOnHand} onChange={e => set("quantityOnHand", e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Cantidad reservada</label>
                <input style={inp} type="number" min="0" step="0.01" value={form.quantityReserved} onChange={e => set("quantityReserved", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Vencimiento</label>
                <input style={inp} type="date" value={form.expiresAt} onChange={e => set("expiresAt", e.target.value)} />
              </div>
              {/* Departamento + Municipio */}
              <DeptMuniSelects deptCode={form.departmentCode} muniName={form.municipalityName} onDept={handleDeptChange} onMuni={v => set("municipalityName", v)} required />
              <div><label style={lbl}>Latitud</label><input style={inp} type="number" step="0.0001" value={form.latitude} onChange={e => set("latitude", e.target.value)} /></div>
              <div><label style={lbl}>Longitud</label><input style={inp} type="number" step="0.0001" value={form.longitude} onChange={e => set("longitude", e.target.value)} /></div>
              <div style={{ gridColumn: "span 3" }}><label style={lbl}>Notas</label><input style={inp} value={form.notes} onChange={e => set("notes", e.target.value)} /></div>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ background: "linear-gradient(135deg,#22d3ee,#60a5fa)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{loading ? "Guardando…" : "Registrar ítem"}</button>
          </form>
        </div>
      )}

      {editingId && (
        <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>✏️ Editando ítem</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Tipo de stock</label>
                <select style={inp} value={editForm.sourceType} onChange={e => setE("sourceType", e.target.value)}>
                  {SOURCE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Ubicación</label>
                <input style={inp} value={editForm.storageLocationName} onChange={e => setE("storageLocationName", e.target.value)} />
              </div>
              {/* Producto: muestra el actual y permite cambiar desde catálogo */}
              <div>
                <label style={lbl}>Producto</label>
                <select style={inp} value={editForm.productId} onChange={e => handleProductSelect(e.target.value, setE)}>
                  <option value="">— {editForm.productName || "Sin cambio"} —</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Cantidad disponible</label>
                <input style={inp} type="number" step="0.01" value={editForm.quantityOnHand} onChange={e => setE("quantityOnHand", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Cantidad reservada</label>
                <input style={inp} type="number" step="0.01" value={editForm.quantityReserved} onChange={e => setE("quantityReserved", e.target.value)} />
              </div>
              <DeptMuniSelects deptCode={editForm.departmentCode} muniName={editForm.municipalityName} onDept={handleEditDeptChange} onMuni={v => setE("municipalityName", v)} />
              <div>
                <label style={lbl}>Vencimiento</label>
                <input style={inp} type="date" value={editForm.expiresAt} onChange={e => setE("expiresAt", e.target.value)} />
              </div>
              <div style={{ gridColumn: "span 3" }}><label style={lbl}>Notas</label><input style={inp} value={editForm.notes} onChange={e => setE("notes", e.target.value)} /></div>
            </div>
            {editError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{editError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={editLoading} style={{ background: "linear-gradient(135deg,#22d3ee,#60a5fa)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{editLoading ? "Guardando…" : "Guardar cambios"}</button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Producto", "Ubicación", "Disponible", "Reservado", "Municipio", "Vence", "Tipo", "Estado", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const [sc, sl] = STATUS_COLOR[item.status] ?? ["#94a3b8", item.status];
                const src = SOURCE_TYPES.find(s => s.value === item.sourceType);
                return (
                  <tr key={item.id || i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: editingId === item.id ? "rgba(245,158,11,0.04)" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={e => { if (editingId !== item.id) e.currentTarget.style.background = "rgba(34,211,238,0.04)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = editingId === item.id ? "rgba(245,158,11,0.04)" : "transparent"; }}>
                    <td style={{ padding: "13px 16px" }}><div style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{item.productName}</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{item.category}</div></td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{item.storageLocationName}</td>
                    <td style={{ padding: "13px 16px", fontSize: 14, fontWeight: 700, color: "#22d3ee", whiteSpace: "nowrap" }}>{item.quantityOnHand?.toLocaleString()} <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>{item.unit}</span></td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: item.quantityReserved > 0 ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>{item.quantityReserved ?? 0}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{item.municipalityName}</td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>{item.expiresAt?.slice?.(0,10) ?? "—"}</td>
                    <td style={{ padding: "13px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${SOURCE_COLOR[item.sourceType] ?? "#94a3b8"}18`, color: SOURCE_COLOR[item.sourceType] ?? "#94a3b8" }}>{src?.label ?? item.sourceType}</span></td>
                    <td style={{ padding: "13px 16px" }}><span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${sc}18`, color: sc, border: `1px solid ${sc}33` }}>{sl}</span></td>
                    <td style={{ padding: "13px 16px" }}>
                      <button onClick={() => handleEdit(item)} style={{ background: editingId === item.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)", color: editingId === item.id ? "#f59e0b" : "rgba(255,255,255,0.5)", border: `1px solid ${editingId === item.id ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️ Editar</button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>{search ? `Sin resultados para "${search}"` : "No hay ítems."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
