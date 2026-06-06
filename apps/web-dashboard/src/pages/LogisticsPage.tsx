import { useEffect, useState, useMemo } from "react";
import { fetchGeofences, registerGeofence, updateGeofence, registerLogisticsOrder } from "../services/logistics";
import { GeofenceMap } from "../components/GeofenceMap";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";

const ZONE_TYPES = [
  { value: "delivery",   label: "Punto de entrega" },
  { value: "restricted", label: "Zona restringida" },
  { value: "warehouse",  label: "Bodega / Depósito" },
  { value: "critical",   label: "Zona crítica" },
];
const ZONE_COLOR: Record<string, string> = {
  delivery: "#4ade80", restricted: "#f87171",
  warehouse: "#60a5fa", critical: "#f59e0b",
};
const ZONE_ICON: Record<string, string> = {
  delivery: "📦", restricted: "🚫", warehouse: "🏭", critical: "⚠️",
};

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };
const lbl: React.CSSProperties = { display: "block", fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" };
const empty = { zoneName: "", zoneType: "delivery", centerLat: "", centerLng: "", radiusM: "", metadata: "" };
const emptyOrder = { inventoryItemId: "", routeMode: "road", originLocationName: "", destinationOrganizationName: "", destinationAddress: "", scheduledPickupAt: "", scheduledDeliveryAt: "", quantityAssigned: "", municipalityName: "", notes: "" };

const ORDER_STATUS_COLOR: Record<string, [string, string]> = {
  scheduled:  ["#60a5fa", "Programada"],
  in_transit: ["#facc15", "En tránsito"],
  delivered:  ["#4ade80", "Entregada"],
  failed:     ["#f87171", "Fallida"],
  cancelled:  ["#94a3b8", "Cancelada"],
};

export function LogisticsPage() {
  const { user } = useAuth();
  const [zones, setZones]             = useState<any[]>([]);
  const [orders, setOrders]           = useState<any[]>([]);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [search, setSearch]           = useState("");
  const [showForm, setShowForm]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [form, setForm]               = useState({ ...empty });
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editForm, setEditForm]       = useState({ ...empty });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError]     = useState<string | null>(null);
  const [selectedId, setSelectedId]   = useState<string | null>(null);

  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm]         = useState({ ...emptyOrder });
  const [orderLoading, setOrderLoading]   = useState(false);
  const [orderError, setOrderError]       = useState<string | null>(null);

  useEffect(() => {
    fetchGeofences().then(r => { if (r.ok) setZones(r.data); });
    api<any>("/api/v1/logistics?limit=50").then(r => {
      if (r.ok) {
        const list = Array.isArray(r.data) ? r.data : (r.data as any).data ?? [];
        setOrders(list);
      }
    });
    api<any>("/api/v1/inventory?limit=100").then(r => {
      if (r.ok) {
        const list = Array.isArray(r.data) ? r.data : (r.data as any).data ?? [];
        setInventoryList(list);
      }
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return zones.filter(z =>
      z.zoneName?.toLowerCase().includes(q) ||
      z.zoneType?.toLowerCase().includes(q)
    );
  }, [zones, search]);

  const set  = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setE = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));
  const setO = (k: string, v: string) => setOrderForm(f => ({ ...f, [k]: v }));

  const handleEdit = (record: any) => {
    setEditingId(record.id);
    setEditForm({
      zoneName:  record.zoneName  || "",
      zoneType:  record.zoneType  || "delivery",
      centerLat: String(record.centerLat ?? ""),
      centerLng: String(record.centerLng ?? ""),
      radiusM:   String(record.radiusM   ?? ""),
      metadata:  record.metadata ? JSON.stringify(record.metadata) : "",
    });
    setEditError(null); setShowForm(false);
  };

  const parseMetadata = (s: string) => {
    try { return s ? JSON.parse(s) : {}; } catch { return null; }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingId) return;
    const meta = parseMetadata(editForm.metadata);
    if (meta === null) { setEditError("Metadata debe ser JSON válido o vacío."); return; }
    setEditLoading(true); setEditError(null);
    const res = await updateGeofence(editingId, {
      zoneName:  editForm.zoneName,
      zoneType:  editForm.zoneType,
      centerLat: parseFloat(editForm.centerLat),
      centerLng: parseFloat(editForm.centerLng),
      radiusM:   parseFloat(editForm.radiusM),
      metadata:  meta,
    });
    setEditLoading(false);
    if (res.ok) { setZones(u => u.map(x => x.id === editingId ? res.data : x)); setEditingId(null); }
    else setEditError((res as any).message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const meta = parseMetadata(form.metadata);
    if (meta === null) { setError("Metadata debe ser JSON válido o vacío."); return; }
    setLoading(true); setError(null);
    const res = await registerGeofence({
      tenantId:  user?.tenantId ?? "",
      zoneName:  form.zoneName,
      zoneType:  form.zoneType,
      centerLat: parseFloat(form.centerLat),
      centerLng: parseFloat(form.centerLng),
      radiusM:   parseFloat(form.radiusM),
      metadata:  meta,
    });
    setLoading(false);
    if (res.ok) { setZones(u => [res.data, ...u]); setForm({ ...empty }); setShowForm(false); }
    else setError((res as any).message);
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderLoading(true); setOrderError(null);
    const res = await registerLogisticsOrder({
      tenantId: user?.tenantId ?? "",
      inventoryItemId: orderForm.inventoryItemId,
      routeMode: orderForm.routeMode,
      originLocationName: orderForm.originLocationName,
      destinationOrganizationName: orderForm.destinationOrganizationName,
      destinationAddress: orderForm.destinationAddress,
      scheduledPickupAt: new Date(orderForm.scheduledPickupAt).toISOString(),
      scheduledDeliveryAt: new Date(orderForm.scheduledDeliveryAt).toISOString(),
      quantityAssigned: parseFloat(orderForm.quantityAssigned),
      municipalityName: orderForm.municipalityName,
      notes: orderForm.notes || undefined,
    });
    setOrderLoading(false);
    if (res.ok) { 
      setOrders(u => [res.data, ...u]); 
      setOrderForm({ ...emptyOrder }); 
      setShowOrderForm(false); 
    } else {
      setOrderError((res as any).message);
    }
  };

  return (
    <div style={{ color: "#fff", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#fb923c,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Geocercas Logísticas
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {zones.length} zonas definidas
            {zones.filter(z => z.centerLat != null).length > 0 && ` · ${zones.filter(z => z.centerLat != null).length} en mapa`}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setEditingId(null); }}
          style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#fb923c,#f59e0b)", color: showForm ? "rgba(255,255,255,0.6)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
          {showForm ? "✕ Cancelar" : "+ Nueva geocerca"}
        </button>
      </div>

      {/* Mapa de geocercas */}
      {zones.length > 0 && (
        <GeofenceMap zones={zones} selectedId={selectedId} />
      )}

      {/* Búsqueda */}
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>🔍</span>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre de zona o tipo…"
          style={{ ...inp, paddingLeft: 42, fontSize: 14, borderRadius: 12 }} />
      </div>

      {/* Formulario nueva geocerca */}
      {showForm && (
        <div style={{ background: "rgba(251,146,60,0.04)", border: "1px solid rgba(251,146,60,0.15)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#fb923c" }}>Nueva geocerca</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Nombre *</label><input style={inp} value={form.zoneName} onChange={e => set("zoneName", e.target.value)} required /></div>
              <div><label style={lbl}>Tipo *</label><select style={inp} value={form.zoneType} onChange={e => set("zoneType", e.target.value)}>{ZONE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              <div><label style={lbl}>Latitud centro *</label><input style={inp} type="number" step="0.0001" value={form.centerLat} onChange={e => set("centerLat", e.target.value)} required /></div>
              <div><label style={lbl}>Longitud centro *</label><input style={inp} type="number" step="0.0001" value={form.centerLng} onChange={e => set("centerLng", e.target.value)} required /></div>
              <div><label style={lbl}>Radio (metros) *</label><input style={inp} type="number" min="10" value={form.radiusM} onChange={e => set("radiusM", e.target.value)} required /></div>
              <div style={{ gridColumn: "span 3" }}><label style={lbl}>Metadata (JSON)</label><input style={inp} value={form.metadata} onChange={e => set("metadata", e.target.value)} placeholder='{"prioridad": 1}' /></div>
            </div>
            {error && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ background: "linear-gradient(135deg,#fb923c,#f59e0b)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              {loading ? "Guardando…" : "Registrar geocerca"}
            </button>
          </form>
        </div>
      )}

      {/* Formulario edición */}
      {editingId && (
        <div style={{ background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 16, padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>✏️ Editando geocerca</h3>
            <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 18 }}>✕</button>
          </div>
          <form onSubmit={handleUpdate}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Nombre</label><input style={inp} value={editForm.zoneName} onChange={e => setE("zoneName", e.target.value)} /></div>
              <div><label style={lbl}>Tipo</label><select style={inp} value={editForm.zoneType} onChange={e => setE("zoneType", e.target.value)}>{ZONE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              <div><label style={lbl}>Latitud centro</label><input style={inp} type="number" step="0.0001" value={editForm.centerLat} onChange={e => setE("centerLat", e.target.value)} /></div>
              <div><label style={lbl}>Longitud centro</label><input style={inp} type="number" step="0.0001" value={editForm.centerLng} onChange={e => setE("centerLng", e.target.value)} /></div>
              <div><label style={lbl}>Radio (metros)</label><input style={inp} type="number" min="10" value={editForm.radiusM} onChange={e => setE("radiusM", e.target.value)} /></div>
              <div style={{ gridColumn: "span 3" }}><label style={lbl}>Metadata (JSON)</label><input style={inp} value={editForm.metadata} onChange={e => setE("metadata", e.target.value)} /></div>
            </div>
            {editError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{editError}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={editLoading} style={{ background: "linear-gradient(135deg,#fb923c,#f59e0b)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {editLoading ? "Guardando…" : "Guardar cambios"}
              </button>
              <button type="button" onClick={() => setEditingId(null)} style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 20px", cursor: "pointer", fontSize: 14 }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {filtered.map((z, i) => {
          const color   = ZONE_COLOR[z.zoneType] ?? "#94a3b8";
          const icon    = ZONE_ICON[z.zoneType]  ?? "📍";
          const zt      = ZONE_TYPES.find(t => t.value === z.zoneType);
          const isSel   = selectedId === z.id;
          const isEdit  = editingId  === z.id;
          return (
            <div
              key={z.id || i}
              onClick={() => setSelectedId(isSel ? null : z.id)}
              style={{
                background: isSel ? `${color}08` : "rgba(255,255,255,0.02)",
                border: `1px solid ${isEdit ? "rgba(245,158,11,0.4)" : isSel ? color + "55" : color + "22"}`,
                borderRadius: 14, padding: 18, cursor: "pointer",
                transition: "transform 0.15s, box-shadow 0.15s",
                boxShadow: isSel ? `0 0 0 1px ${color}33` : "none",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${color}18`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = isSel ? `0 0 0 1px ${color}33` : "none"; }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{icon}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${color}18`, color, border: `1px solid ${color}33` }}>{zt?.label ?? z.zoneType}</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleEdit(z); }}
                    style={{ background: isEdit ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)", color: isEdit ? "#f59e0b" : "rgba(255,255,255,0.4)", border: `1px solid ${isEdit ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                    ✏️
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{z.zoneName}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>📍 {z.centerLat?.toFixed?.(4)}, {z.centerLng?.toFixed?.(4)}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>⊙ Radio: <span style={{ color: "#fff", fontWeight: 600 }}>{z.radiusM?.toLocaleString()} m</span></div>
              </div>

              {isSel && (
                <div style={{ marginTop: 10, fontSize: 11, color, fontWeight: 600 }}>
                  → Marcada en el mapa ↑
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
            {search ? `Sin resultados para "${search}"` : "No hay geocercas definidas."}
          </div>
        )}
      </div>

      {/* ── Sección: Órdenes logísticas ── */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
            <span>🚛</span> Órdenes logísticas
            <span style={{ fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.3)", marginLeft: 6 }}>{orders.length} registros</span>
          </h2>
          <button 
            onClick={() => setShowOrderForm(v => !v)}
            style={{ background: showOrderForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#fb923c,#f59e0b)", color: showOrderForm ? "rgba(255,255,255,0.6)" : "#0a0a12", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6, transition: "transform 0.1s" }}>
            {showOrderForm ? "✕ Cancelar" : "+ Crear nueva orden"}
          </button>
        </div>

        {showOrderForm && (
          <div style={{ background: "rgba(251,146,60,0.04)", border: "1px solid rgba(251,146,60,0.15)", borderRadius: 16, padding: 24, marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#fb923c" }}>Nueva Orden Logística</h3>
            <form onSubmit={handleOrderSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Inventario / Producto *</label>
                  <select style={inp} value={orderForm.inventoryItemId} onChange={e => setO("inventoryItemId", e.target.value)} required>
                    <option value="">Selecciona un producto disponible...</option>
                    {inventoryList.filter(i => Number(i.quantityOnHand) > 0).map(i => (
                      <option key={i.id} value={i.id}>{i.productName} ({i.quantityOnHand} {i.unit})</option>
                    ))}
                  </select>
                </div>
                <div><label style={lbl}>Cantidad a enviar (kg) *</label><input style={inp} type="number" min="1" value={orderForm.quantityAssigned} onChange={e => setO("quantityAssigned", e.target.value)} required /></div>
                <div>
                  <label style={lbl}>Modo de ruta *</label>
                  <select style={inp} value={orderForm.routeMode} onChange={e => setO("routeMode", e.target.value)} required>
                    <option value="road">Terrestre (Camión)</option>
                    <option value="drone">Dron aéreo</option>
                    <option value="river">Fluvial</option>
                  </select>
                </div>
                <div><label style={lbl}>Origen (Nombre) *</label><input style={inp} value={orderForm.originLocationName} onChange={e => setO("originLocationName", e.target.value)} required placeholder="Ej. Bodega Central" /></div>
                <div><label style={lbl}>Destino (Organización) *</label><input style={inp} value={orderForm.destinationOrganizationName} onChange={e => setO("destinationOrganizationName", e.target.value)} required placeholder="Ej. Comedor Escolar" /></div>
                <div><label style={lbl}>Dirección de Destino *</label><input style={inp} value={orderForm.destinationAddress} onChange={e => setO("destinationAddress", e.target.value)} required placeholder="Ej. Calle 123 #45-67" /></div>
                <div><label style={lbl}>Municipio *</label><input style={inp} value={orderForm.municipalityName} onChange={e => setO("municipalityName", e.target.value)} required placeholder="Ej. Bogotá" /></div>
                <div><label style={lbl}>Fecha/Hora Recogida *</label><input style={inp} type="datetime-local" value={orderForm.scheduledPickupAt} onChange={e => setO("scheduledPickupAt", e.target.value)} required /></div>
                <div><label style={lbl}>Fecha/Hora Entrega *</label><input style={inp} type="datetime-local" value={orderForm.scheduledDeliveryAt} onChange={e => setO("scheduledDeliveryAt", e.target.value)} required /></div>
                <div style={{ gridColumn: "span 3" }}><label style={lbl}>Notas</label><input style={inp} value={orderForm.notes} onChange={e => setO("notes", e.target.value)} placeholder="Instrucciones de entrega..." /></div>
              </div>
              {orderError && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: "rgba(248,113,113,0.08)", borderRadius: 8 }}>{orderError}</div>}
              <button type="submit" disabled={orderLoading} style={{ background: "linear-gradient(135deg,#fb923c,#f59e0b)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "11px 28px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
                {orderLoading ? "Creando..." : "Crear orden"}
              </button>
            </form>
          </div>
        )}

        {!showOrderForm && orders.length === 0 ? (
          <div style={{ padding: "48px 20px", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 16, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 220 }}>
            <div style={{ width: 68, height: 68, background: "rgba(251,146,60,0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, marginBottom: 18, border: "1px solid rgba(251,146,60,0.2)" }}>
              🚛
            </div>
            <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 700, color: "#fff" }}>Sin órdenes logísticas activas</h3>
            <p style={{ margin: "0 0 24px", fontSize: 13, color: "rgba(255,255,255,0.45)", maxWidth: 420, lineHeight: 1.5 }}>
              Aún no se han registrado órdenes de transporte o envíos en el sistema. Las órdenes aparecerán aquí una vez que se programen despachos o recogidas.
            </p>
            <button 
              onClick={() => setShowOrderForm(true)}
              style={{ background: "linear-gradient(135deg,#fb923c,#f59e0b)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "12px 28px", fontWeight: 700, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 8, transition: "transform 0.1s", boxShadow: "0 4px 12px rgba(245,158,11,0.2)" }}>
              <span>+</span> Crear nueva orden
            </button>
          </div>
        ) : (
          orders.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["Origen → Destino", "Producto", "Cantidad", "Recogida", "Entrega", "Modo", "Estado"].map(h => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 20).map((o, i) => {
                  const [sc, sl] = ORDER_STATUS_COLOR[o.status] ?? ["#94a3b8", o.status];
                  return (
                    <tr key={o.id || i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ color: "#fff", fontWeight: 600, fontSize: 12 }}>{o.originLocationName ?? "—"}</div>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>→ {o.destinationOrganizationName ?? "—"}</div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{o.municipalityName ?? "—"}</td>
                      <td style={{ padding: "10px 14px", color: "#fff", fontWeight: 600 }}>{o.quantityAssigned?.toLocaleString?.() ?? "—"} kg</td>
                      <td style={{ padding: "10px 14px", color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
                        {o.scheduledPickupAt ? new Date(o.scheduledPickupAt).toLocaleDateString("es-CO") : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
                        {o.scheduledDeliveryAt ? new Date(o.scheduledDeliveryAt).toLocaleDateString("es-CO") : "—"}
                      </td>
                      <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{o.routeMode ?? "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${sc}18`, color: sc, border: `1px solid ${sc}33` }}>{sl}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )
        )}
      </div>
    </div>
  );
}
