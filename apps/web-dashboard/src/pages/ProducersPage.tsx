import { useCallback, useEffect, useState } from "react";
import { fetchProducers, registerProducer, updateProducer } from "../services/producers";
import type { ProducerRecord, ProducerMapProperties } from "../services/producers";
import { ProducerMap } from "../components/ProducerMap";
import { ProducerDetailPanel } from "../components/ProducerDetailPanel";
import { useAuth } from "../hooks/useAuth";

const PRODUCER_TYPES = [
  { value: "individual",  label: "Individual" },
  { value: "association", label: "Asociación" },
  { value: "cooperative", label: "Cooperativa" },
];
const ZONE_TYPES = [
  { value: "rural",           label: "Rural" },
  { value: "urban_periphery", label: "Periferia urbana" },
];
const STATUS_OPTIONS = [
  { value: "",                     label: "Todos los estados" },
  { value: "active",               label: "Activo" },
  { value: "pending_verification", label: "Pendiente verificación" },
  { value: "inactive",             label: "Inactivo" },
];
const STATUS_COLOR: Record<string, [string, string]> = {
  active:               ["#4ade80", "Activo"],
  pending_verification: ["#facc15", "Pendiente"],
  inactive:             ["#6b7280", "Inactivo"],
};

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
  userId: "", producerType: "individual", organizationName: "",
  contactName: "", contactPhone: "", municipalityName: "",
  zoneType: "rural", productCategories: "", latitude: "", longitude: "",
};

export function ProducersPage() {
  const { user } = useAuth();
  const [producers, setProducers] = useState<ProducerRecord[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMunicipality, setFilterMunicipality] = useState("");

  // Map detail panel
  const [selectedProducer, setSelectedProducer] = useState<ProducerMapProperties | null>(null);

  useEffect(() => {
    fetchProducers().then(res => { if (res.ok) setProducers(res.data); });
  }, []);

  const handleProducerClick = useCallback((p: ProducerMapProperties) => {
    setSelectedProducer(p);
  }, []);

  const set  = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setE = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setFormError(null);
    const { organizationName, contactName, contactPhone, municipalityName, productCategories } = form;
    if (!organizationName || !contactName || !contactPhone || !municipalityName || !productCategories) {
      setFormError("Todos los campos obligatorios deben completarse.");
      setLoading(false); return;
    }
    const payload = {
      tenantId: user?.tenantId ?? "",
      userId: form.userId || undefined,
      producerType: form.producerType,
      organizationName, contactName, contactPhone, municipalityName,
      zoneType: form.zoneType,
      productCategories: productCategories.split(",").map(s => s.trim()).filter(Boolean),
      latitude:  form.latitude  ? parseFloat(form.latitude)  : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
    };
    const res = await registerProducer(payload);
    setLoading(false);
    if (res.ok) { setProducers(prev => [...prev, res.data]); setForm({ ...emptyForm }); setShowForm(false); }
    else setFormError(res.message ?? "Error al registrar productor.");
  };

  const handleEdit = (p: ProducerRecord) => {
    setEditingId(p.id);
    setEditForm({
      userId: p.userId ?? "", producerType: p.producerType,
      organizationName: p.organizationName, contactName: p.contactName,
      contactPhone: p.contactPhone, municipalityName: p.municipalityName,
      zoneType: p.zoneType,
      productCategories: p.productCategories.join(", "),
      latitude: p.latitude != null ? String(p.latitude) : "",
      longitude: p.longitude != null ? String(p.longitude) : "",
    });
    setEditError(null); setShowForm(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return;
    setEditLoading(true); setEditError(null);
    const payload = {
      producerType: editForm.producerType,
      organizationName: editForm.organizationName,
      contactName: editForm.contactName,
      contactPhone: editForm.contactPhone,
      municipalityName: editForm.municipalityName,
      zoneType: editForm.zoneType,
      productCategories: editForm.productCategories.split(",").map(s => s.trim()).filter(Boolean),
      latitude:  editForm.latitude  ? parseFloat(editForm.latitude)  : undefined,
      longitude: editForm.longitude ? parseFloat(editForm.longitude) : undefined,
    };
    const res = await updateProducer(editingId, payload);
    setEditLoading(false);
    if (res.ok) { setProducers(prev => prev.map(x => x.id === editingId ? res.data : x)); setEditingId(null); }
    else setEditError((res as any).message ?? "Error al actualizar productor.");
  };

  const filtered = producers.filter(p => {
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterMunicipality && !p.municipalityName.toLowerCase().includes(filterMunicipality.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ color: "#fff", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#4ade80,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Productores
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {producers.length} predios · {producers.filter(p => p.status === "active").length} activos
            {" · "}{producers.filter(p => p.latitude != null && p.longitude != null).length} en mapa
            {producers.filter(p => p.latitude == null).length > 0 && (
              <span style={{ color: "#f59e0b", marginLeft: 4 }}>
                · {producers.filter(p => p.latitude == null).length} sin coordenadas
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setEditingId(null); }}
          style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#4ade80,#22d3ee)", color: showForm ? "rgba(255,255,255,0.6)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
        >
          {showForm ? "✕ Cancelar" : "+ Registrar productor"}
        </button>
      </div>

      {/* Register form */}
      {showForm && (
        <div style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#4ade80" }}>Nuevo productor</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Tipo de productor *</label>
                <select style={inp} value={form.producerType} onChange={e => set("producerType", e.target.value)}>
                  {PRODUCER_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Nombre / Organización *</label>
                <input style={inp} value={form.organizationName} onChange={e => set("organizationName", e.target.value)} placeholder="Ej: Asociación Agropecuaria del Valle" required />
              </div>
              <div>
                <label style={lbl}>Nombre de contacto *</label>
                <input style={inp} value={form.contactName} onChange={e => set("contactName", e.target.value)} placeholder="Nombre completo" required />
              </div>
              <div>
                <label style={lbl}>Teléfono *</label>
                <input style={inp} value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)} placeholder="300 000 0000" required />
              </div>
              <div>
                <label style={lbl}>Municipio *</label>
                <input style={inp} value={form.municipalityName} onChange={e => set("municipalityName", e.target.value)} placeholder="Ej: Medellín" required />
              </div>
              <div>
                <label style={lbl}>Tipo de zona</label>
                <select style={inp} value={form.zoneType} onChange={e => set("zoneType", e.target.value)}>
                  {ZONE_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Categorías de productos * (separadas por coma)</label>
                <input style={inp} value={form.productCategories} onChange={e => set("productCategories", e.target.value)} placeholder="Ej: hortalizas, frutas, tubérculos" required />
              </div>
              <div>
                <label style={lbl}>Latitud</label>
                <input style={inp} type="number" step="0.0001" value={form.latitude} onChange={e => set("latitude", e.target.value)} placeholder="6.2442" />
              </div>
              <div>
                <label style={lbl}>Longitud</label>
                <input style={inp} type="number" step="0.0001" value={form.longitude} onChange={e => set("longitude", e.target.value)} placeholder="-75.5812" />
              </div>
              <div>
                <label style={lbl}>ID Usuario (opcional)</label>
                <input style={inp} value={form.userId} onChange={e => set("userId", e.target.value)} placeholder="UUID" />
              </div>
            </div>
            {formError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{formError}</div>}
            <button type="submit" disabled={loading} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              {loading ? "Guardando…" : "Registrar productor"}
            </button>
          </form>
        </div>
      )}

      {/* Edit panel */}
      {editingId && (
        <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>✏️ Editando productor</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Tipo</label>
                <select style={inp} value={editForm.producerType} onChange={e => setE("producerType", e.target.value)}>
                  {PRODUCER_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Organización</label>
                <input style={inp} value={editForm.organizationName} onChange={e => setE("organizationName", e.target.value)} />
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
                <label style={lbl}>Municipio</label>
                <input style={inp} value={editForm.municipalityName} onChange={e => setE("municipalityName", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Zona</label>
                <select style={inp} value={editForm.zoneType} onChange={e => setE("zoneType", e.target.value)}>
                  {ZONE_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Categorías (separadas por coma)</label>
                <input style={inp} value={editForm.productCategories} onChange={e => setE("productCategories", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Latitud</label>
                <input style={inp} type="number" step="0.0001" value={editForm.latitude} onChange={e => setE("latitude", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Longitud</label>
                <input style={inp} type="number" step="0.0001" value={editForm.longitude} onChange={e => setE("longitude", e.target.value)} />
              </div>
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

      {/* Map + detail panel */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 2, minWidth: 0 }}>
          <ProducerMap onProducerClick={handleProducerClick} selectedProducerId={selectedProducer?.id} />
        </div>
        {selectedProducer && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <ProducerDetailPanel producer={selectedProducer} onClose={() => setSelectedProducer(null)} />
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#64748b" }}>
        {[
          { color: "#4ade80", label: "Activo" },
          { color: "#facc15", label: "Pendiente verificación" },
          { color: "#6b7280", label: "Inactivo" },
        ].map(item => (
          <span key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, display: "inline-block" }} />
            {item.label}
          </span>
        ))}
        <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
          Solo se muestran en el mapa los productores con coordenadas registradas
        </span>
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "8px 12px", background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, outline: "none", fontSize: 13 }}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          value={filterMunicipality}
          onChange={e => setFilterMunicipality(e.target.value)}
          placeholder="Filtrar por municipio…"
          style={{ padding: "8px 14px", background: "rgba(255,255,255,0.05)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, width: 220, outline: "none", fontSize: 13 }}
        />
        <span style={{ color: "#475569", fontSize: 13 }}>
          {filtered.length} productor{filtered.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Tipo", "Organización", "Contacto", "Municipio", "Zona", "Categorías", "Mapa", "Estado", "Acciones"].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const [sc, sl] = STATUS_COLOR[p.status] ?? ["#94a3b8", p.status];
              const isEditing = editingId === p.id;
              return (
                <tr
                  key={p.id}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: isEditing ? "rgba(245,158,11,0.04)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)", cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={e => { if (!isEditing) e.currentTarget.style.background = "rgba(74,222,128,0.05)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isEditing ? "rgba(245,158,11,0.04)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"; }}
                  onClick={() => setSelectedProducer({ id: p.id, nombre: p.organizationName, tipo: p.producerType, contactName: p.contactName, contactPhone: p.contactPhone, productCategories: p.productCategories, status: p.status, zona: p.zoneType, comuna: null, municipio: p.municipalityName, departamento: null })}
                >
                  <td style={{ padding: "12px 16px", color: "#94a3b8" }}>{p.producerType}</td>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "#fff" }}>{p.organizationName}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ color: "#fff", fontSize: 13 }}>{p.contactName}</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{p.contactPhone}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>{p.municipalityName}</td>
                  <td style={{ padding: "12px 16px", color: "#94a3b8" }}>{p.zoneType}</td>
                  <td style={{ padding: "12px 16px", maxWidth: 200 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {p.productCategories.slice(0, 3).map(c => (
                        <span key={c} style={{ padding: "2px 8px", background: "rgba(74,222,128,0.1)", color: "#4ade80", borderRadius: 20, fontSize: 10, fontWeight: 600 }}>{c}</span>
                      ))}
                      {p.productCategories.length > 3 && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>+{p.productCategories.length - 3}</span>}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {p.latitude != null && p.longitude != null
                      ? <span title={`${p.latitude}, ${p.longitude}`} style={{ fontSize: 16 }}>📍</span>
                      : <span title="Sin coordenadas — no aparece en el mapa" style={{ fontSize: 13, color: "rgba(255,255,255,0.2)" }}>—</span>
                    }
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${sc}18`, color: sc, border: `1px solid ${sc}33` }}>{sl}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleEdit(p)}
                      style={{ background: isEditing ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)", color: isEditing ? "#f59e0b" : "rgba(255,255,255,0.5)", border: `1px solid ${isEditing ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                    >
                      ✏️ Editar
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
                  No hay productores que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
