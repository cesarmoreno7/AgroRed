import { useState, useMemo } from "react";

interface Channel {
  id: string;
  label: string;
  value: string;
  description: string;
  color: string;
  isActive: boolean;
}

const STORAGE_KEY = "agrored_catalog_channels";

const DEFAULTS: Channel[] = [
  { id: "1", label: "Comedor comunitario", value: "community_kitchen",  description: "Comedores que atienden a poblaciones vulnerables", color: "#f59e0b", isActive: true },
  { id: "2", label: "Programa escolar",    value: "school_program",     description: "Programas de alimentación escolar PAE", color: "#60a5fa", isActive: true },
  { id: "3", label: "Programa social",     value: "social_program",     description: "Hospitales, cárceles, hogares, albergues", color: "#a78bfa", isActive: true },
  { id: "4", label: "Emergencia",          value: "emergency_response", description: "Atención de emergencias humanitarias", color: "#f87171", isActive: true },
];

function loadChannels(): Channel[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : DEFAULTS;
  } catch { return DEFAULTS; }
}
function saveChannels(items: Channel[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function uid() { return Math.random().toString(36).slice(2, 10); }

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
const emptyForm = () => ({ label: "", value: "", description: "", color: "#60a5fa" });

export function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>(loadChannels);
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
    return channels.filter(c => c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  }, [channels, search]);

  const save = (updated: Channel[]) => { setChannels(updated); saveChannels(updated); };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!form.label.trim() || !form.value.trim()) { setError("Nombre y código son obligatorios."); return; }
    if (channels.some(c => c.value === form.value.trim())) { setError("Ese código ya existe."); return; }
    save([...channels, { id: uid(), label: form.label.trim(), value: form.value.trim(), description: form.description.trim(), color: form.color, isActive: true }]);
    setForm(emptyForm()); setShowForm(false);
  };

  const startEdit = (c: Channel) => {
    setEditingId(c.id);
    setEditForm({ label: c.label, value: c.value, description: c.description, color: c.color, isActive: c.isActive });
    setShowForm(false);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return;
    save(channels.map(c => c.id === editingId ? { ...c, ...editForm } : c));
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("¿Eliminar este canal?")) return;
    save(channels.filter(c => c.id !== id));
  };

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#f59e0b,#fb923c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Canales de Distribución
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {channels.length} canales · {channels.filter(c => c.isActive).length} activos · Usados en demandas alimentarias
          </p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditingId(null); setError(null); }}
          style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#f59e0b,#fb923c)", color: showForm ? "rgba(255,255,255,0.5)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
          {showForm ? "✕ Cancelar" : "+ Nuevo canal"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 700, color: "#f59e0b" }}>Nuevo canal</h3>
          <form onSubmit={handleCreate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>Nombre *</label><input style={inp} value={form.label} onChange={e => set("label", e.target.value)} placeholder="Comedor comunitario" required /></div>
              <div><label style={lbl}>Código (único) *</label><input style={inp} value={form.value} onChange={e => set("value", e.target.value)} placeholder="community_kitchen" required /></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Descripción</label><input style={inp} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descripción del canal" /></div>
              <div><label style={lbl}>Color</label><input style={{ ...inp, width: 60, padding: 4, height: 38 }} type="color" value={form.color} onChange={e => set("color", e.target.value)} /></div>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{error}</div>}
            <button type="submit" style={{ background: "linear-gradient(135deg,#f59e0b,#fb923c)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Guardar canal</button>
          </form>
        </div>
      )}

      {editingId && (
        <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f59e0b" }}>✏️ Editando canal</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>Nombre</label><input style={inp} value={editForm.label} onChange={e => setE("label", e.target.value)} required /></div>
              <div><label style={lbl}>Código</label><input style={inp} value={editForm.value} onChange={e => setE("value", e.target.value)} required /></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Descripción</label><input style={inp} value={editForm.description} onChange={e => setE("description", e.target.value)} /></div>
              <div><label style={lbl}>Color</label><input style={{ ...inp, width: 60, padding: 4, height: 38 }} type="color" value={editForm.color} onChange={e => setE("color", e.target.value)} /></div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="button" onClick={() => setE("isActive", !editForm.isActive)}
                  style={{ padding: "8px 18px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, background: editForm.isActive ? "rgba(74,222,128,0.15)" : "rgba(148,163,184,0.15)", color: editForm.isActive ? "#4ade80" : "#94a3b8" }}>
                  {editForm.isActive ? "Activo" : "Inactivo"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" style={{ background: "linear-gradient(135deg,#f59e0b,#fb923c)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Guardar cambios</button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar canal…" style={{ ...inp, borderRadius: 12 }} />

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Canal", "Código", "Descripción", "Estado", "Acciones"].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 ? "rgba(255,255,255,0.01)" : "transparent" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,158,11,0.04)")}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 ? "rgba(255,255,255,0.01)" : "transparent")}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 12, height: 12, borderRadius: "50%", background: c.color, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: "#fff" }}>{c.label}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 16px" }}><code style={{ fontSize: 11, color: "#94a3b8", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: 6 }}>{c.value}</code></td>
                <td style={{ padding: "12px 16px", color: "rgba(255,255,255,0.5)", maxWidth: 250 }}>{c.description || "—"}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.isActive ? "rgba(74,222,128,0.12)" : "rgba(148,163,184,0.12)", color: c.isActive ? "#4ade80" : "#94a3b8" }}>
                    {c.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => startEdit(c)} style={{ background: "rgba(96,165,250,0.08)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️ Editar</button>
                    <button onClick={() => handleDelete(c.id)} style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>No hay canales registrados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
