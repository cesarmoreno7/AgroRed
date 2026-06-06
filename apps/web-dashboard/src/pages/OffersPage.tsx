import { useEffect, useState, useMemo } from "react";
import { fetchOffers, registerOffer, updateOffer } from "../services/offers";
import { fetchProducers } from "../services/producers";
import type { ProducerRecord } from "../services/producers";
import { useAuth } from "../hooks/useAuth";

const STATUS_COLOR: Record<string, [string, string]> = {
  published: ["#4ade80", "Publicada"],
  draft:     ["#94a3b8", "Borrador"],
  closed:    ["#f87171", "Cerrada"],
};

const CATEGORIES = ["tuberculo","hortaliza","fruta","cereal","leguminosa","lacteo","cacao","platano","yuca","otro"];

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };

const emptyForm = { producerId: "", title: "", productName: "", category: "hortaliza", unit: "kg", quantityAvailable: "", priceAmount: "", currency: "COP", availableFrom: "", availableUntil: "", municipalityName: "", notes: "", latitude: "", longitude: "", status: "draft" };

export function OffersPage() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<any[]>([]);
  const [producers, setProducers] = useState<ProducerRecord[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    fetchOffers().then(r => { if (r.ok) setOffers(r.data); });
    fetchProducers().then(r => { if (r.ok) setProducers(r.data); });
  }, []);

  // Build lookup map: producerId → organizationName
  const producerMap = useMemo(() =>
    Object.fromEntries(producers.map(p => [p.id, p.organizationName])),
    [producers]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return offers.filter(o =>
      o.title?.toLowerCase().includes(q) ||
      o.productName?.toLowerCase().includes(q) ||
      o.municipalityName?.toLowerCase().includes(q) ||
      o.category?.toLowerCase().includes(q) ||
      producerMap[o.producerId]?.toLowerCase().includes(q)
    );
  }, [offers, search, producerMap]);

  const set  = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setE = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setEditForm({ producerId: record.producerId || "", title: record.title || "", productName: record.productName || "", category: record.category || "hortaliza", unit: record.unit || "kg", quantityAvailable: String(record.quantityAvailable ?? ""), priceAmount: String(record.priceAmount ?? ""), currency: record.currency || "COP", availableFrom: record.availableFrom?.slice(0,10) || "", availableUntil: record.availableUntil?.slice(0,10) || "", municipalityName: record.municipalityName || "", notes: record.notes || "", latitude: String(record.latitude ?? ""), longitude: String(record.longitude ?? ""), status: record.status || "draft" });
    setEditError(null); setShowForm(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return;
    setEditLoading(true); setEditError(null);
    const res = await updateOffer(editingId, { ...editForm, quantityAvailable: parseFloat(editForm.quantityAvailable), priceAmount: parseFloat(editForm.priceAmount), latitude: editForm.latitude ? parseFloat(editForm.latitude) : undefined, longitude: editForm.longitude ? parseFloat(editForm.longitude) : undefined });
    setEditLoading(false);
    if (res.ok) { setOffers(u => u.map(x => x.id === editingId ? res.data : x)); setEditingId(null); }
    else setEditError((res as any).message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError(null);
    const res = await registerOffer({
      ...form, tenantId: user?.tenantId ?? "",
      quantityAvailable: parseFloat(form.quantityAvailable),
      priceAmount: parseFloat(form.priceAmount),
      latitude: form.latitude ? parseFloat(form.latitude) : undefined,
      longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      availableUntil: form.availableUntil || undefined,
      notes: form.notes || undefined,
    });
    setLoading(false);
    if (res.ok) { setOffers(u => [res.data, ...u]); setForm({ ...emptyForm }); setShowForm(false); }
    else setError(res.message);
  };

  const ProducerSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select style={inp} value={value} onChange={e => onChange(e.target.value)} required>
      <option value="">— Seleccionar productor —</option>
      {producers.map(p => (
        <option key={p.id} value={p.id}>{p.organizationName} ({p.municipalityName})</option>
      ))}
    </select>
  );

  return (
    <div style={{ color: "#fff", maxWidth: 1150, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#4ade80,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Ofertas de Producción</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{offers.length} ofertas en el sistema · {offers.filter(o => o.status === "published").length} publicadas</p>
        </div>
        <button onClick={() => { setShowForm(v => !v); setEditingId(null); }} style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#4ade80,#22d3ee)", color: showForm ? "rgba(255,255,255,0.6)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
          {showForm ? "✕ Cancelar" : "+ Nueva oferta"}
        </button>
      </div>

      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, producto, productor, municipio o categoría…" style={{ ...inp, paddingLeft: 42, fontSize: 14, borderRadius: 12 }} />
      </div>

      {showForm && (
        <div style={{ background: "rgba(74,222,128,0.04)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#4ade80" }}>Nueva oferta</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Productor *</label>
                <ProducerSelect value={form.producerId} onChange={v => set("producerId", v)} />
              </div>
              <div>
                <label style={lbl}>Municipio *</label>
                <input style={inp} value={form.municipalityName} onChange={e => set("municipalityName", e.target.value)} placeholder="Municipio" required />
              </div>
              <div style={{ gridColumn: "span 3" }}>
                <label style={lbl}>Título *</label>
                <input style={inp} value={form.title} onChange={e => set("title", e.target.value)} placeholder="Ej: Papa criolla fresca lote A" required />
              </div>
              <div>
                <label style={lbl}>Producto *</label>
                <input style={inp} value={form.productName} onChange={e => set("productName", e.target.value)} placeholder="Nombre del producto" required />
              </div>
              <div>
                <label style={lbl}>Categoría *</label>
                <select style={inp} value={form.category} onChange={e => set("category", e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Unidad *</label>
                <input style={inp} value={form.unit} onChange={e => set("unit", e.target.value)} placeholder="kg, lb, und…" required />
              </div>
              <div>
                <label style={lbl}>Cantidad *</label>
                <input style={inp} type="number" min="0.01" step="0.01" value={form.quantityAvailable} onChange={e => set("quantityAvailable", e.target.value)} placeholder="0.00" required />
              </div>
              <div>
                <label style={lbl}>Precio *</label>
                <input style={inp} type="number" min="0" step="0.01" value={form.priceAmount} onChange={e => set("priceAmount", e.target.value)} placeholder="0.00" required />
              </div>
              <div>
                <label style={lbl}>Moneda</label>
                <select style={inp} value={form.currency} onChange={e => set("currency", e.target.value)}>
                  <option value="COP">COP</option><option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Disponible desde *</label>
                <input style={inp} type="date" value={form.availableFrom} onChange={e => set("availableFrom", e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Disponible hasta</label>
                <input style={inp} type="date" value={form.availableUntil} onChange={e => set("availableUntil", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Latitud</label>
                <input style={inp} type="number" step="0.0001" value={form.latitude} onChange={e => set("latitude", e.target.value)} placeholder="6.1549" />
              </div>
              <div>
                <label style={lbl}>Estado</label>
                <select style={inp} value={form.status} onChange={e => set("status", e.target.value)}>
                  <option value="draft">Borrador</option>
                  <option value="published">Publicada</option>
                  <option value="closed">Cerrada</option>
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Notas</label>
                <input style={inp} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observaciones adicionales (opcional)" />
              </div>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ background: "linear-gradient(135deg,#4ade80,#22d3ee)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              {loading ? "Guardando…" : "Registrar oferta"}
            </button>
          </form>
        </div>
      )}

      {/* Edit panel */}
      {editingId && (
        <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>✏️ Editando oferta</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Productor</label>
                <ProducerSelect value={editForm.producerId} onChange={v => setE("producerId", v)} />
              </div>
              <div>
                <label style={lbl}>Municipio</label>
                <input style={inp} value={editForm.municipalityName} onChange={e => setE("municipalityName", e.target.value)} />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Título</label>
                <input style={inp} value={editForm.title} onChange={e => setE("title", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Producto</label>
                <input style={inp} value={editForm.productName} onChange={e => setE("productName", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Categoría</label>
                <select style={inp} value={editForm.category} onChange={e => setE("category", e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Unidad</label>
                <input style={inp} value={editForm.unit} onChange={e => setE("unit", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Cantidad</label>
                <input style={inp} type="number" step="0.01" value={editForm.quantityAvailable} onChange={e => setE("quantityAvailable", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Precio</label>
                <input style={inp} type="number" step="0.01" value={editForm.priceAmount} onChange={e => setE("priceAmount", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Moneda</label>
                <select style={inp} value={editForm.currency} onChange={e => setE("currency", e.target.value)}><option value="COP">COP</option><option value="USD">USD</option></select>
              </div>
              <div>
                <label style={lbl}>Disponible desde</label>
                <input style={inp} type="date" value={editForm.availableFrom} onChange={e => setE("availableFrom", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Disponible hasta</label>
                <input style={inp} type="date" value={editForm.availableUntil} onChange={e => setE("availableUntil", e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Estado</label>
                <select style={inp} value={editForm.status} onChange={e => setE("status", e.target.value)}>
                  <option value="draft">Borrador</option>
                  <option value="published">Publicada</option>
                  <option value="closed">Cerrada</option>
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={lbl}>Notas</label>
                <input style={inp} value={editForm.notes} onChange={e => setE("notes", e.target.value)} />
              </div>
            </div>
            {editError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{editError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={editLoading} style={{ background: "linear-gradient(135deg,#f59e0b,#fb923c)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>{editLoading ? "Guardando…" : "Guardar cambios"}</button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["Productor", "Producto", "Categoría", "Cantidad", "Precio", "Municipio", "Desde", "Estado", "Acciones"].map(h => (
                <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => {
              const [sc, sl] = STATUS_COLOR[o.status] ?? ["#94a3b8", o.status];
              const producerName = producerMap[o.producerId];
              return (
                <tr key={o.id || i}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: editingId === o.id ? "rgba(245,158,11,0.04)" : "transparent", transition: "background 0.15s" }}
                  onMouseEnter={e => { if (editingId !== o.id) e.currentTarget.style.background = "rgba(74,222,128,0.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = editingId === o.id ? "rgba(245,158,11,0.04)" : "transparent"; }}>
                  <td style={{ padding: "13px 16px" }}>
                    {producerName
                      ? <span style={{ fontSize: 12, fontWeight: 600, color: "#22d3ee" }}>{producerName}</span>
                      : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>{o.producerId?.slice(0,8)}…</span>
                    }
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#fff" }}>{o.productName}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{o.title}</div>
                  </td>
                  <td style={{ padding: "13px 16px" }}><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: "rgba(74,222,128,0.1)", color: "#4ade80", fontWeight: 600 }}>{o.category}</span></td>
                  <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 600, color: "#22d3ee" }}>{o.quantityAvailable?.toLocaleString()} <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{o.unit}</span></td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#fff" }}>${o.priceAmount?.toLocaleString()} <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{o.currency}</span></td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{o.municipalityName}</td>
                  <td style={{ padding: "13px 16px", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{o.availableFrom?.slice?.(0, 10)}</td>
                  <td style={{ padding: "13px 16px" }}><span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${sc}18`, color: sc, border: `1px solid ${sc}33` }}>{sl}</span></td>
                  <td style={{ padding: "13px 16px" }}>
                    <button onClick={() => handleEdit(o)} style={{ background: editingId === o.id ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)", color: editingId === o.id ? "#f59e0b" : "rgba(255,255,255,0.5)", border: `1px solid ${editingId === o.id ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️ Editar</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
                {search ? `Sin resultados para "${search}"` : "No hay ofertas registradas."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
