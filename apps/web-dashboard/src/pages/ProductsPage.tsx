import { useEffect, useState, useMemo } from "react";
import { fetchProducts, createProduct, updateProduct, deleteProduct } from "../services/products";
import type { ProductCatalogItem } from "../services/products";
import { useAuth } from "../hooks/useAuth";

const CATEGORIES = ["tuberculo","hortaliza","fruta","cereal","leguminosa","lacteo","cacao","platano","yuca","otro"];
const CAT_COLOR: Record<string, string> = { tuberculo: "#f59e0b", hortaliza: "#4ade80", fruta: "#f472b6", cereal: "#fb923c", leguminosa: "#a78bfa", lacteo: "#60a5fa", cacao: "#92400e", platano: "#fbbf24", yuca: "#d97706", otro: "#6b7280" };

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
const emptyForm = () => ({ name: "", category: "hortaliza", unit: "kg", description: "", inSeason: false });

export function ProductsPage() {
  const { user } = useAuth();
  const [items, setItems]         = useState<ProductCatalogItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm]   = useState({ ...emptyForm(), isActive: true });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    // Solo los admins pueden ver/crear productos de un tenant especifico.
    // Para el resto de roles, solo se muestran los productos globales.
    const tenantId = user?.tenantId;
    fetchProducts(tenantId).then(r => {
      if (r.ok) setItems(r.data);
      else setApiError((r as any).message ?? "Error al cargar catálogo");
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [user?.tenantId]);

  const set  = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));
  const setE = (k: string, v: string | boolean) => setEditForm(f => ({ ...f, [k]: v }));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(p =>
      (filterCat === "all" || p.category === filterCat) &&
      (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q))
    );
  }, [items, search, filterCat]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(null);
    if (!form.name.trim()) { setFormError("El nombre es obligatorio."); return; }
    setSaving(true);
    const res = await createProduct({ ...form, name: form.name.trim(), tenantId: user?.tenantId ?? null });
    setSaving(false);
    if (res.ok) { setItems(prev => [...prev, res.data]); setForm(emptyForm()); setShowForm(false); }
    else setFormError((res as any).message ?? "Error al guardar");
  };

  const startEdit = (p: ProductCatalogItem) => {
    setEditingId(p.id);
    setEditForm({ name: p.name, category: p.category, unit: p.unit, description: p.description ?? "", inSeason: p.inSeason, isActive: p.isActive });
    setShowForm(false); setFormError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return;
    setSaving(true); setFormError(null);
    const res = await updateProduct(editingId, { ...editForm, description: editForm.description || null });
    setSaving(false);
    if (res.ok) { setItems(prev => prev.map(p => p.id === editingId ? res.data : p)); setEditingId(null); }
    else setFormError((res as any).message ?? "Error al guardar");
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este producto del catálogo?")) return;
    const res = await deleteProduct(id);
    if (res.ok || res.status === 204) setItems(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#4ade80,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Catálogo de Productos
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {loading ? "Cargando…" : `${items.length} productos · ${items.filter(p => p.inSeason).length} en temporada · Vinculados a ofertas, rescates e inventario`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={load} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>↺ Actualizar</button>
          <button onClick={() => { setShowForm(v => !v); setEditingId(null); setFormError(null); }}
            style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#4ade80,#22d3ee)", color: showForm ? "rgba(255,255,255,0.5)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
            {showForm ? "✕ Cancelar" : "+ Nuevo producto"}
          </button>
        </div>
      </div>

      {apiError && (
        <div style={{ padding: "12px 16px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 12, color: "#f87171", fontSize: 13 }}>
          ⚠️ {apiError} — Los datos del catálogo global de productos se cargan desde la base de datos.
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: "#4ade80" }}>Nuevo producto</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Nombre del producto *</label>
                <input style={inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Papa criolla, Tomate chonto…" required />
              </div>
              <div>
                <label style={lbl}>Categoría</label>
                <select style={inp} value={form.category} onChange={e => set("category", e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Unidad de medida</label>
                <select style={inp} value={form.unit} onChange={e => set("unit", e.target.value)}>
                  {["kg","libra","tonelada","und","litro","arroba","bulto"].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Descripción</label>
                <input style={inp} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Variedad, características…" />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.inSeason as boolean} onChange={e => set("inSeason", e.target.checked)} />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>En temporada</span>
                </label>
              </div>
            </div>
            {formError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{formError}</div>}
            <button type="submit" disabled={saving} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              {saving ? "Guardando…" : "Guardar producto"}
            </button>
          </form>
        </div>
      )}

      {/* Edit form */}
      {editingId && (
        <div style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#4ade80" }}>✏️ Editando producto</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Nombre</label>
                <input style={inp} value={editForm.name} onChange={e => setE("name", e.target.value)} required />
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
                  {["kg","libra","tonelada","und","litro","arroba","bulto"].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Descripción</label>
                <input style={inp} value={editForm.description} onChange={e => setE("description", e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={editForm.inSeason as boolean} onChange={e => setE("inSeason", e.target.checked)} />
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>En temporada</span>
                </label>
                <button type="button" onClick={() => setE("isActive", !editForm.isActive)}
                  style={{ padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11, background: editForm.isActive ? "rgba(74,222,128,0.15)" : "rgba(148,163,184,0.15)", color: editForm.isActive ? "#4ade80" : "#94a3b8" }}>
                  {editForm.isActive ? "Activo" : "Inactivo"}
                </button>
              </div>
            </div>
            {formError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{formError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={saving} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto…" style={{ ...inp, flex: 1, minWidth: 200, borderRadius: 12 }} />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...inp, width: "auto" }}>
          <option value="all">Todas las categorías</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["Producto", "Categoría", "Unidad", "Temporada", "Estado", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Cargando catálogo desde la base de datos…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
                  {search || filterCat !== "all" ? "Sin resultados." : "No hay productos en el catálogo. Agrega el primero."}
                </td></tr>
              ) : filtered.map((p, i) => (
                <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,222,128,0.04)")}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 ? "rgba(255,255,255,0.01)" : "transparent")}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: "#fff" }}>{p.name}</div>
                    {p.description && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{p.description}</div>}
                    {!p.tenantId && <span style={{ fontSize: 10, color: "#60a5fa", marginTop: 2, display: "inline-block" }}>🌐 Global</span>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: `${CAT_COLOR[p.category] ?? "#6b7280"}18`, color: CAT_COLOR[p.category] ?? "#6b7280" }}>{p.category}</span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.6)" }}>{p.unit}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {p.inSeason ? <span style={{ color: "#4ade80", fontSize: 14 }}>🌱</span> : <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: p.isActive ? "rgba(74,222,128,0.12)" : "rgba(148,163,184,0.12)", color: p.isActive ? "#4ade80" : "#94a3b8" }}>
                      {p.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => startEdit(p)} style={{ background: "rgba(96,165,250,0.08)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️ Editar</button>
                      <button onClick={() => handleDelete(p.id)} style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
