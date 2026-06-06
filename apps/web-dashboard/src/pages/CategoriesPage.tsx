import { useState, useMemo } from "react";

interface Category {
  id: string;
  name: string;
  label: string;
  color: string;
  description: string;
  isActive: boolean;
}

const STORAGE_KEY = "agrored_catalog_categories";

const DEFAULTS: Category[] = [
  { id: "1",  name: "tuberculo",   label: "Tubérculo",   color: "#f59e0b", description: "Papa, yuca, batata, ñame", isActive: true },
  { id: "2",  name: "hortaliza",   label: "Hortaliza",   color: "#4ade80", description: "Verduras de hoja y tallo", isActive: true },
  { id: "3",  name: "fruta",       label: "Fruta",       color: "#f472b6", description: "Frutas frescas y tropicales", isActive: true },
  { id: "4",  name: "cereal",      label: "Cereal",      color: "#fb923c", description: "Arroz, maíz, trigo, cebada", isActive: true },
  { id: "5",  name: "leguminosa",  label: "Leguminosa",  color: "#a78bfa", description: "Fríjol, lenteja, garbanzo", isActive: true },
  { id: "6",  name: "lacteo",      label: "Lácteo",      color: "#60a5fa", description: "Leche, queso, yogur", isActive: true },
  { id: "7",  name: "cacao",       label: "Cacao",       color: "#92400e", description: "Cacao y derivados", isActive: true },
  { id: "8",  name: "platano",     label: "Plátano",     color: "#fbbf24", description: "Plátano verde, maduro, dominico", isActive: true },
  { id: "9",  name: "yuca",        label: "Yuca",        color: "#d97706", description: "Yuca fresca y procesada", isActive: true },
  { id: "10", name: "otro",        label: "Otro",        color: "#6b7280", description: "Otros productos alimentarios", isActive: true },
];

function loadItems(): Category[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : DEFAULTS;
  } catch { return DEFAULTS; }
}
function saveItems(items: Category[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function uid() { return Math.random().toString(36).slice(2, 10); }

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
const emptyForm = () => ({ name: "", label: "", color: "#4ade80", description: "" });

export function CategoriesPage() {
  const [items, setItems] = useState<Category[]>(loadItems);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm(), isActive: true });
  const [error, setError] = useState<string | null>(null);

  const set  = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setE = (k: string, v: string | boolean) => setEditForm(f => ({ ...f, [k]: v }));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(c => c.label.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [items, search]);

  const save = (updated: Category[]) => { setItems(updated); saveItems(updated); };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!form.name.trim() || !form.label.trim()) { setError("Código y etiqueta son obligatorios."); return; }
    if (items.some(c => c.name === form.name.trim())) { setError("Ese código ya existe."); return; }
    save([...items, { id: uid(), name: form.name.trim(), label: form.label.trim(), color: form.color, description: form.description.trim(), isActive: true }]);
    setForm(emptyForm()); setShowForm(false);
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditForm({ name: c.name, label: c.label, color: c.color, description: c.description, isActive: c.isActive });
    setShowForm(false);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return;
    save(items.map(c => c.id === editingId ? { ...c, ...editForm } : c));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("¿Eliminar esta categoría?")) return;
    save(items.filter(c => c.id !== id));
  };

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#22d3ee,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Categorías de Productos
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {items.length} categorías · {items.filter(c => c.isActive).length} activas · Usadas en ofertas y demandas
          </p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditingId(null); setError(null); }}
          style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#22d3ee,#60a5fa)", color: showForm ? "rgba(255,255,255,0.5)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
          {showForm ? "✕ Cancelar" : "+ Nueva categoría"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: "#22d3ee" }}>Nueva categoría</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>Código (único) *</label><input style={inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="tuberculo" required /></div>
              <div><label style={lbl}>Etiqueta *</label><input style={inp} value={form.label} onChange={e => set("label", e.target.value)} placeholder="Tubérculo" required /></div>
              <div><label style={lbl}>Color</label><input style={{ ...inp, width: 60, padding: 4, height: 38 }} type="color" value={form.color} onChange={e => set("color", e.target.value)} /></div>
              <div style={{ gridColumn: "span 3" }}><label style={lbl}>Descripción</label><input style={inp} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Papa, yuca, batata…" /></div>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{error}</div>}
            <button type="submit" style={{ background: "linear-gradient(135deg,#22d3ee,#60a5fa)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Guardar categoría</button>
          </form>
        </div>
      )}

      {editingId && (
        <div style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#22d3ee" }}>✏️ Editando categoría</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>Código</label><input style={inp} value={editForm.name} onChange={e => setE("name", e.target.value)} required /></div>
              <div><label style={lbl}>Etiqueta</label><input style={inp} value={editForm.label} onChange={e => setE("label", e.target.value)} required /></div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}><label style={lbl}>Color</label><input style={{ ...inp, width: 60, padding: 4, height: 38 }} type="color" value={editForm.color} onChange={e => setE("color", e.target.value)} /></div>
                <button type="button" onClick={() => setE("isActive", !editForm.isActive)}
                  style={{ padding: "8px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11, background: editForm.isActive ? "rgba(74,222,128,0.15)" : "rgba(148,163,184,0.15)", color: editForm.isActive ? "#4ade80" : "#94a3b8" }}>
                  {editForm.isActive ? "Activa" : "Inactiva"}
                </button>
              </div>
              <div style={{ gridColumn: "span 3" }}><label style={lbl}>Descripción</label><input style={inp} value={editForm.description} onChange={e => setE("description", e.target.value)} /></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" style={{ background: "linear-gradient(135deg,#22d3ee,#60a5fa)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Guardar cambios</button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar categoría…" style={{ ...inp, borderRadius: 12 }} />

      {/* Grid de tarjetas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {filtered.map(c => (
          <div key={c.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${c.color}22`, borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: c.color, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{c.label}</span>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: c.isActive ? "rgba(74,222,128,0.1)" : "rgba(148,163,184,0.1)", color: c.isActive ? "#4ade80" : "#94a3b8" }}>
                {c.isActive ? "Activa" : "Inactiva"}
              </span>
            </div>
            <code style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 6, display: "inline-block", marginBottom: 8 }}>{c.name}</code>
            {c.description && <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>{c.description}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => startEdit(c)} style={{ flex: 1, padding: "7px 0", background: "rgba(96,165,250,0.08)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️ Editar</button>
              <button onClick={() => handleDelete(c.id)} style={{ padding: "7px 14px", background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🗑️</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
            {search ? `Sin resultados para "${search}"` : "No hay categorías registradas."}
          </div>
        )}
      </div>
    </div>
  );
}
