import { useState, useMemo } from "react";

interface Organization {
  id: string;
  name: string;
  type: string;
  municipality: string;
  contact: string;
  notes: string;
  isActive: boolean;
}

const STORAGE_KEY = "agrored_catalog_organizations";
const ORG_TYPES = [
  { value: "fundacion", label: "Fundación" },
  { value: "ong",       label: "ONG" },
  { value: "comedor",   label: "Comedor comunitario" },
  { value: "programa",  label: "Programa social" },
  { value: "empresa",   label: "Empresa" },
  { value: "otro",      label: "Otra" },
];

const DEFAULTS: Organization[] = [
  { id: "1", name: "Banco de Alimentos de Antioquia",          type: "fundacion", municipality: "Medellín",        contact: "3101234500", notes: "Mayor banco de alimentos de la región andina",                          isActive: true  },
  { id: "2", name: "Fundación Banco de Alimentos Caribe",      type: "fundacion", municipality: "Barranquilla",    contact: "3152233100", notes: "Atiende a familias vulnerables en la costa Caribe",                     isActive: true  },
  { id: "3", name: "ONG Alimentar Colombia",                   type: "ong",       municipality: "Bogotá D.C.",     contact: "3004455667", notes: "Programa nacional de seguridad alimentaria",                            isActive: true  },
  { id: "4", name: "Comedor Popular Ciudad Equidad",           type: "comedor",   municipality: "Medellín",        contact: "3165551234", notes: "500 almuerzos diarios en zona nororiental",                            isActive: true  },
  { id: "5", name: "Comedor Comunitario La Esperanza",         type: "comedor",   municipality: "San Roque",       contact: "3112233445", notes: "320 familias beneficiadas semanalmente",                               isActive: true  },
  { id: "6", name: "Programa PAE Antioquia",                   type: "programa",  municipality: "Medellín",        contact: "3187001122", notes: "Programa de Alimentación Escolar departamental",                       isActive: true  },
  { id: "7", name: "Programa Social Sé Vive",                  type: "programa",  municipality: "Bogotá D.C.",     contact: "3201122334", notes: "Programa distrital de atención a población vulnerable",                isActive: true  },
  { id: "8", name: "Agrocomercios del Valle S.A.S.",           type: "empresa",   municipality: "Cali",            contact: "3118887766", notes: "Distribuidora mayorista de productos agrícolas del Valle del Cauca",   isActive: true  },
  { id: "9", name: "Agroexport Caribe Ltda.",                  type: "empresa",   municipality: "Cartagena",       contact: "3004433221", notes: "Exportadora y distribuidora de frutas tropicales",                     isActive: true  },
  { id:"10", name: "Red de Mujeres Campesinas del Oriente",    type: "fundacion", municipality: "Santa Rosa",      contact: "3155443322", notes: "Organización de base para productoras rurales del oriente antioqueño", isActive: true  },
  { id:"11", name: "Corporación Semillas de Paz",              type: "ong",       municipality: "Bucaramanga",     contact: "3142211009", notes: "Apoyo a comunidades rurales en seguridad alimentaria",                 isActive: true  },
  { id:"12", name: "Asociación de Comedores Comunitarios Norte", type:"otro",     municipality: "Barranquilla",    contact: "3177665544", notes: "Agrupa 18 comedores comunitarios del norte de Barranquilla",          isActive: false },
];

function loadItems(): Organization[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : DEFAULTS;
  } catch { return DEFAULTS; }
}
function saveItems(items: Organization[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function uid() { return Math.random().toString(36).slice(2, 10); }

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
const emptyForm = () => ({ name: "", type: "fundacion", municipality: "", contact: "", notes: "" });

export function OrganizationsPage() {
  const [items, setItems] = useState<Organization[]>(loadItems);
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
    return items.filter(o => o.name.toLowerCase().includes(q) || o.municipality.toLowerCase().includes(q) || o.type.toLowerCase().includes(q));
  }, [items, search]);

  const save = (updated: Organization[]) => { setItems(updated); saveItems(updated); };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!form.name.trim()) { setError("El nombre es obligatorio."); return; }
    save([...items, { id: uid(), ...form, name: form.name.trim(), isActive: true }]);
    setForm(emptyForm()); setShowForm(false);
  };

  const startEdit = (o: Organization) => {
    setEditingId(o.id);
    setEditForm({ name: o.name, type: o.type, municipality: o.municipality, contact: o.contact, notes: o.notes, isActive: o.isActive });
    setShowForm(false);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return;
    save(items.map(o => o.id === editingId ? { ...o, ...editForm } : o));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("¿Eliminar esta organización?")) return;
    save(items.filter(o => o.id !== id));
  };

  const typeLabel = (v: string) => ORG_TYPES.find(t => t.value === v)?.label ?? v;

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#a78bfa,#818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Organizaciones
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {items.length} organizaciones · {items.filter(o => o.isActive).length} activas · Catálogo para demandas alimentarias
          </p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditingId(null); setError(null); }}
          style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#a78bfa,#818cf8)", color: showForm ? "rgba(255,255,255,0.5)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
          {showForm ? "✕ Cancelar" : "+ Nueva organización"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.2)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: "#a78bfa" }}>Nueva organización</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Nombre *</label><input style={inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Fundación Alimentar Colombia" required /></div>
              <div><label style={lbl}>Tipo</label>
                <select style={inp} value={form.type} onChange={e => set("type", e.target.value)}>
                  {ORG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Municipio</label><input style={inp} value={form.municipality} onChange={e => set("municipality", e.target.value)} placeholder="Bogotá D.C." /></div>
              <div><label style={lbl}>Contacto</label><input style={inp} value={form.contact} onChange={e => set("contact", e.target.value)} placeholder="3001234567" /></div>
              <div style={{ gridColumn: "span 3" }}><label style={lbl}>Notas</label><input style={inp} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observaciones" /></div>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{error}</div>}
            <button type="submit" style={{ background: "linear-gradient(135deg,#a78bfa,#818cf8)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Guardar</button>
          </form>
        </div>
      )}

      {editingId && (
        <div style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#a78bfa" }}>✏️ Editando organización</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Nombre</label><input style={inp} value={editForm.name} onChange={e => setE("name", e.target.value)} required /></div>
              <div><label style={lbl}>Tipo</label>
                <select style={inp} value={editForm.type} onChange={e => setE("type", e.target.value)}>
                  {ORG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Municipio</label><input style={inp} value={editForm.municipality} onChange={e => setE("municipality", e.target.value)} /></div>
              <div><label style={lbl}>Contacto</label><input style={inp} value={editForm.contact} onChange={e => setE("contact", e.target.value)} /></div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="button" onClick={() => setE("isActive", !editForm.isActive)}
                  style={{ padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, background: editForm.isActive ? "rgba(74,222,128,0.15)" : "rgba(148,163,184,0.15)", color: editForm.isActive ? "#4ade80" : "#94a3b8" }}>
                  {editForm.isActive ? "Activa" : "Inactiva"}
                </button>
              </div>
              <div style={{ gridColumn: "span 3" }}><label style={lbl}>Notas</label><input style={inp} value={editForm.notes} onChange={e => setE("notes", e.target.value)} /></div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" style={{ background: "linear-gradient(135deg,#a78bfa,#818cf8)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Guardar cambios</button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar organización…" style={{ ...inp, borderRadius: 12 }} />

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Organización", "Tipo", "Municipio", "Contacto", "Estado", "Acciones"].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => (
              <tr key={o.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(167,139,250,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 ? "rgba(255,255,255,0.01)" : "transparent")}>
                <td style={{ padding: "12px 16px", fontWeight: 600, color: "#fff" }}>{o.name}</td>
                <td style={{ padding: "12px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: "rgba(167,139,250,0.1)", color: "#a78bfa", fontWeight: 600 }}>{typeLabel(o.type)}</span></td>
                <td style={{ padding: "12px 16px", color: "#94a3b8" }}>{o.municipality || "—"}</td>
                <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.5)" }}>{o.contact || "—"}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: o.isActive ? "rgba(74,222,128,0.12)" : "rgba(148,163,184,0.12)", color: o.isActive ? "#4ade80" : "#94a3b8" }}>
                    {o.isActive ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => startEdit(o)} style={{ background: "rgba(96,165,250,0.08)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️ Editar</button>
                    <button onClick={() => handleDelete(o.id)} style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
                {search ? `Sin resultados para "${search}"` : "No hay organizaciones registradas. Agrega la primera."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
