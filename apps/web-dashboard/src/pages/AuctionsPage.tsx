import { useEffect, useState, useMemo } from "react";
import { api } from "../services/api";
import { fetchProducers } from "../services/producers";
import type { ProducerRecord } from "../services/producers";
import { useAuth } from "../hooks/useAuth";

interface Auction {
  id: string;
  productName: string;
  category: string;
  unit: string;
  quantityKg: number;
  auctionType: string;
  basePrice: number;
  reservePrice: number;
  currentPrice: number;
  currency: string;
  status: string;
  endsAt: string;
  municipalityName: string;
  latitude: number;
  longitude: number;
  producerId: string;
  shelfLifeHours: number;
  durationMinutes: number;
  dutchStepPercent: number | null;
  dutchStepMinutes: number | null;
  winnerId?: string | null;
  remainingMinutes?: number;
  isUrgent?: boolean;
}

// ── Palettes ───────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, [string, string]> = {
  active:                ["#4ade80",  "Activa"],
  closed_with_winner:    ["#60a5fa",  "Con ganador"],
  closed_no_winner:      ["#94a3b8",  "Sin ganador"],
  cancelled:             ["#f87171",  "Cancelada"],
  extended:              ["#facc15",  "Extendida"],
  draft:                 ["#a78bfa",  "Borrador"],
};
const TYPE_LABEL: Record<string, string> = {
  ascending: "Ascendente",
  dutch:     "Holandesa",
};
const TYPE_COLOR: Record<string, string> = {
  ascending: "#60a5fa",
  dutch:     "#f59e0b",
};

const CATEGORIES = [
  "tuberculo", "hortaliza", "fruta", "leguminosa", "cereal",
  "cacao", "lacteo", "platano", "yuca", "otro",
];
const UNITS = ["kg", "ton", "unidad", "bulto", "canastilla"];
const DURATION_OPTIONS = [
  { value: 120,  label: "2 horas" },
  { value: 240,  label: "4 horas" },
  { value: 360,  label: "6 horas" },
  { value: 480,  label: "8 horas" },
  { value: 720,  label: "12 horas" },
  { value: 1440, label: "24 horas" },
];

// ── Styles ─────────────────────────────────────────────────────────────────
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
  producerId:       "",
  productName:      "",
  category:         "tuberculo",
  unit:             "kg",
  quantityKg:       "",
  harvestDate:      "",
  auctionType:      "ascending",
  basePrice:        "",
  reservePrice:     "0",
  durationMinutes:  "240",
  municipalityName: "",
  latitude:         "",
  longitude:        "",
  dutchStepPercent: "5",
  dutchStepMinutes: "15",
};

// ── Component ──────────────────────────────────────────────────────────────
export function AuctionsPage() {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [producers, setProducers] = useState<ProducerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Publish form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Bid state
  const [bidding, setBidding] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidError, setBidError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const canPublish = ["producer", "admin_municipal"].includes(user?.role ?? "");
  const canBid     = ["community_kitchen", "logistics_operator", "admin_municipal"].includes(user?.role ?? "");
  const isProducer = user?.role === "producer";

  // ── Data loading ─────────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await api<{ data: Auction[]; total: number } | Auction[]>("/api/v1/auctions?limit=100");
    if (res.ok) {
      const data = Array.isArray(res.data) ? res.data : (res.data as any).data ?? [];
      setAuctions(data);
    } else {
      setError(res.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!canPublish) return;
    fetchProducers().then(res => {
      if (res.ok) setProducers(res.data);
    });
  }, [canPublish]);

  // Auto-select producer for producer role
  useEffect(() => {
    if (!isProducer || producers.length === 0) return;
    const mine = producers.find(p => p.userId === user?.id);
    if (mine) setForm(f => ({ ...f, producerId: mine.id, municipalityName: mine.municipalityName, latitude: String(mine.latitude ?? ""), longitude: String(mine.longitude ?? "") }));
    else if (producers.length === 1) { const p0 = producers[0]; if (p0) setForm(f => ({ ...f, producerId: p0.id, municipalityName: p0.municipalityName, latitude: String(p0.latitude ?? ""), longitude: String(p0.longitude ?? "") })); }
  }, [producers, isProducer, user?.id]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleProducerChange = (producerId: string) => {
    const p = producers.find(x => x.id === producerId);
    setForm(f => ({
      ...f,
      producerId,
      municipalityName: p?.municipalityName ?? f.municipalityName,
      latitude:  p?.latitude  != null ? String(p.latitude)  : f.latitude,
      longitude: p?.longitude != null ? String(p.longitude) : f.longitude,
    }));
  };

  // ── Publish handler ───────────────────────────────────────────────────────
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setPublishError(null);
    setPublishSuccess(false);

    if (!form.producerId) { setPublishError("Selecciona un productor."); return; }
    if (!form.productName.trim()) { setPublishError("Ingresa el nombre del producto."); return; }
    if (!form.harvestDate) { setPublishError("Ingresa la fecha de cosecha."); return; }
    if (parseFloat(form.basePrice) <= 0) { setPublishError("El precio base debe ser mayor que 0."); return; }
    if (!form.latitude || !form.longitude) { setPublishError("Ingresa las coordenadas del predio."); return; }

    const reservePrice = parseFloat(form.reservePrice);
    const basePrice = parseFloat(form.basePrice);
    if (reservePrice > basePrice) { setPublishError("El precio de reserva no puede superar el precio base."); return; }

    const payload: Record<string, unknown> = {
      tenantId:        user?.tenantId,
      producerId:      form.producerId,
      productName:     form.productName.trim(),
      category:        form.category,
      unit:            form.unit,
      quantityKg:      parseFloat(form.quantityKg),
      harvestDate:     new Date(form.harvestDate).toISOString(),
      auctionType:     form.auctionType,
      basePrice,
      reservePrice,
      currency:        "COP",
      durationMinutes: parseInt(form.durationMinutes),
      latitude:        parseFloat(form.latitude),
      longitude:       parseFloat(form.longitude),
      municipalityName: form.municipalityName.trim(),
    };

    if (form.auctionType === "dutch") {
      payload.dutchStepPercent = parseFloat(form.dutchStepPercent);
      payload.dutchStepMinutes = parseInt(form.dutchStepMinutes);
    }

    setPublishing(true);
    const res = await api("/api/v1/auctions/publish", { method: "POST", body: payload });
    setPublishing(false);

    if (res.ok) {
      setPublishSuccess(true);
      setForm({ ...emptyForm });
      setShowForm(false);
      await load();
    } else {
      setPublishError((res as any).message ?? "Error al publicar la subasta.");
    }
  };

  // ── Bid handler ───────────────────────────────────────────────────────────
  const handleBid = async (auctionId: string) => {
    const amount = parseFloat(bidAmount);
    if (isNaN(amount) || amount <= 0) { setBidError("Ingresa un monto válido."); return; }
    if (!user?.id) { setBidError("Debes iniciar sesión para pujar."); return; }
    setBidError(null);
    const res = await api(`/api/v1/auctions/${auctionId}/bid`, {
      method: "POST",
      body: { amount, bidderId: user.id, bidderType: user.role ?? "community_kitchen" },
    });
    if (res.ok) { setBidding(null); setBidAmount(""); load(); }
    else setBidError((res as any).message ?? "Error al pujar.");
  };

  // ── Filters ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return auctions.filter(a => {
      const matchSearch = a.productName?.toLowerCase().includes(q)
        || a.municipalityName?.toLowerCase().includes(q)
        || a.category?.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || a.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [auctions, search, filterStatus]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ color: "#fff", maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#facc15,#fb923c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Subastas
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            {auctions.length} subastas · {auctions.filter(a => a.status === "active").length} activas ahora
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {canPublish && (
            <button
              onClick={() => { setShowForm(f => !f); setPublishError(null); setPublishSuccess(false); }}
              style={{ background: showForm ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#facc15,#fb923c)", color: showForm ? "rgba(255,255,255,0.6)" : "#0a0a12", border: "none", borderRadius: 12, padding: "11px 22px", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
            >
              {showForm ? "✕ Cancelar" : "🔨 Publicar subasta"}
            </button>
          )}
          <button
            onClick={load}
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 20px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
          >
            ↺ Actualizar
          </button>
        </div>
      </div>

      {/* ── Publish success banner ── */}
      {publishSuccess && (
        <div style={{ padding: "14px 18px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 12, color: "#4ade80", fontSize: 13, display: "flex", alignItems: "center", gap: 10 }}>
          ✅ Subasta publicada exitosamente. Aparece activa en la lista.
        </div>
      )}

      {/* ── Publish form ── */}
      {showForm && (
        <div style={{ background: "rgba(250,204,21,0.04)", border: "1px solid rgba(250,204,21,0.18)", borderRadius: 16, padding: 24 }}>
          <h3 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 700, color: "#facc15", display: "flex", alignItems: "center", gap: 8 }}>
            🔨 Nueva subasta
          </h3>
          <form onSubmit={handlePublish}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>

              {/* Producer select (admin sees all, producer auto-selected) */}
              <div style={{ gridColumn: isProducer ? "span 1" : "span 3" }}>
                <label style={lbl}>Productor *</label>
                {isProducer ? (
                  <input style={inp} readOnly
                    value={producers.find(p => p.id === form.producerId)?.organizationName ?? "Cargando…"}
                  />
                ) : (
                  <select style={inp} value={form.producerId} onChange={e => handleProducerChange(e.target.value)} required>
                    <option value="">— Selecciona un productor —</option>
                    {producers.map(p => (
                      <option key={p.id} value={p.id}>{p.organizationName} ({p.municipalityName})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Row: product name | category | unit */}
              <div style={{ gridColumn: "span 1" }}>
                <label style={lbl}>Producto *</label>
                <input style={inp} value={form.productName} onChange={e => set("productName", e.target.value)}
                  placeholder="Ej: Papa criolla, Tomate chonto" required />
              </div>
              <div>
                <label style={lbl}>Categoría</label>
                <select style={inp} value={form.category} onChange={e => set("category", e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Unidad</label>
                <select style={inp} value={form.unit} onChange={e => set("unit", e.target.value)}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              {/* Row: quantity | harvest date | auction type */}
              <div>
                <label style={lbl}>Cantidad *</label>
                <input style={inp} type="number" min="1" step="0.5" value={form.quantityKg}
                  onChange={e => set("quantityKg", e.target.value)} placeholder="Ej: 500" required />
              </div>
              <div>
                <label style={lbl}>Fecha de cosecha *</label>
                <input style={inp} type="date" value={form.harvestDate}
                  max={new Date().toISOString().slice(0,10)}
                  onChange={e => set("harvestDate", e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Tipo de subasta</label>
                <select style={inp} value={form.auctionType} onChange={e => set("auctionType", e.target.value)}>
                  <option value="ascending">Ascendente — precio sube con pujas</option>
                  <option value="dutch">Holandesa — precio baja por pasos</option>
                </select>
              </div>

              {/* Row: base price | reserve price | duration */}
              <div>
                <label style={lbl}>Precio base COP *</label>
                <input style={inp} type="number" min="1" step="100" value={form.basePrice}
                  onChange={e => set("basePrice", e.target.value)} placeholder="Ej: 2000" required />
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Por {form.unit}</div>
              </div>
              <div>
                <label style={lbl}>Precio de reserva COP</label>
                <input style={inp} type="number" min="0" step="100" value={form.reservePrice}
                  onChange={e => set("reservePrice", e.target.value)} placeholder="0 = sin reserva" />
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>Mínimo aceptable</div>
              </div>
              <div>
                <label style={lbl}>Duración</label>
                <select style={inp} value={form.durationMinutes} onChange={e => set("durationMinutes", e.target.value)}>
                  {DURATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              {/* Dutch auction extra fields */}
              {form.auctionType === "dutch" && (
                <>
                  <div>
                    <label style={lbl}>% bajada por paso (1-50)</label>
                    <input style={inp} type="number" min="1" max="50" step="1" value={form.dutchStepPercent}
                      onChange={e => set("dutchStepPercent", e.target.value)} />
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>El precio baja este % cada paso</div>
                  </div>
                  <div>
                    <label style={lbl}>Minutos entre pasos (1-60)</label>
                    <input style={inp} type="number" min="1" max="60" step="1" value={form.dutchStepMinutes}
                      onChange={e => set("dutchStepMinutes", e.target.value)} />
                  </div>
                  <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, fontSize: 12, color: "#f59e0b", display: "flex", alignItems: "flex-start", gap: 8, alignSelf: "end" }}>
                    <span>⚡</span>
                    <span>Subasta de urgencia: el precio comienza en el precio base y baja automáticamente hasta llegar a reserva.</span>
                  </div>
                </>
              )}

              {/* Row: municipality | lat | lng */}
              <div>
                <label style={lbl}>Municipio *</label>
                <input style={inp} value={form.municipalityName}
                  onChange={e => set("municipalityName", e.target.value)}
                  placeholder="Ej: Bogotá D.C." required />
              </div>
              <div>
                <label style={lbl}>Latitud</label>
                <input style={inp} type="number" step="0.0001" value={form.latitude}
                  onChange={e => set("latitude", e.target.value)} placeholder="4.6097" required />
              </div>
              <div>
                <label style={lbl}>Longitud</label>
                <input style={inp} type="number" step="0.0001" value={form.longitude}
                  onChange={e => set("longitude", e.target.value)} placeholder="-74.0817" required />
              </div>
            </div>

            {/* Error */}
            {publishError && (
              <div style={{ color: "#f87171", fontSize: 13, marginBottom: 14, padding: "10px 14px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10 }}>
                {publishError}
              </div>
            )}

            {/* Summary preview */}
            {form.basePrice && form.quantityKg && (
              <div style={{ marginBottom: 14, padding: "12px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 10, fontSize: 12, color: "rgba(255,255,255,0.5)", display: "flex", gap: 24, flexWrap: "wrap" }}>
                <span>🌾 {form.productName || "Producto"}</span>
                <span>📦 {form.quantityKg} {form.unit}</span>
                <span>💰 Base: ${parseFloat(form.basePrice || "0").toLocaleString("es-CO")} COP</span>
                <span>⏱ {DURATION_OPTIONS.find(d => d.value === parseInt(form.durationMinutes))?.label}</span>
                <span>🔨 {form.auctionType === "ascending" ? "Ascendente" : "Holandesa"}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={publishing}
              style={{ background: publishing ? "rgba(250,204,21,0.3)" : "linear-gradient(135deg,#facc15,#fb923c)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "12px 32px", fontWeight: 700, cursor: publishing ? "not-allowed" : "pointer", fontSize: 14 }}
            >
              {publishing ? "Publicando…" : "🔨 Publicar subasta"}
            </button>
          </form>
        </div>
      )}

      {/* ── Search + filter ── */}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por producto, municipio o categoría…"
            style={{ ...inp, paddingLeft: 42, fontSize: 14, borderRadius: 12 }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ ...inp, width: 180, borderRadius: 12 }}
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="extended">Extendidas</option>
          <option value="closed_with_winner">Con ganador</option>
          <option value="closed_no_winner">Sin ganador</option>
          <option value="cancelled">Canceladas</option>
        </select>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ padding: "14px 18px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 12, color: "#f87171" }}>
          {error}
        </div>
      )}

      {/* ── Auction list ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.3)" }}>Cargando subastas…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(a => {
            const [sc, sl]  = STATUS_COLOR[a.status] ?? ["#94a3b8", a.status];
            const tc        = TYPE_COLOR[a.auctionType] ?? "#94a3b8";
            const isActive  = a.status === "active" || a.status === "extended";
            const isBidding = bidding === a.id;
            const endsAt    = new Date(a.endsAt);
            const hoursLeft = Math.max(0, Math.round((endsAt.getTime() - Date.now()) / 3600000));

            return (
              <div
                key={a.id}
                style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${isActive ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.07)"}`, borderRadius: 16, padding: "18px 20px", transition: "transform 0.15s" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.transform = "translateY(-1px)")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = "none")}
              >
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 16, alignItems: "center" }}>

                  {/* Product */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>🌾</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{a.productName}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${tc}18`, color: tc, border: `1px solid ${tc}33` }}>
                        {TYPE_LABEL[a.auctionType] ?? a.auctionType}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                      {a.category} · {a.quantityKg?.toLocaleString()} {a.unit} · 📍 {a.municipalityName}
                    </div>
                    {a.shelfLifeHours && (
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>
                        Vida útil: {a.shelfLifeHours}h
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Precio actual</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#facc15" }}>
                      ${a.currentPrice?.toLocaleString("es-CO")}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                      Base: ${a.basePrice?.toLocaleString("es-CO")} {a.currency}
                    </div>
                  </div>

                  {/* Time */}
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Cierre</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isActive && hoursLeft < 24 ? "#f59e0b" : "rgba(255,255,255,0.7)" }}>
                      {endsAt.toLocaleDateString("es-CO")}
                    </div>
                    {isActive && (
                      <div style={{ fontSize: 11, color: hoursLeft < 6 ? "#f87171" : "rgba(255,255,255,0.3)" }}>
                        {hoursLeft}h restantes
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <span style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${sc}18`, color: sc, border: `1px solid ${sc}33` }}>
                      {sl}
                    </span>
                  </div>

                  {/* Bid action */}
                  <div>
                    {canBid && isActive && (
                      <button
                        onClick={() => { setBidding(isBidding ? null : a.id); setBidAmount(""); setBidError(null); }}
                        style={{ background: isBidding ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#facc15,#fb923c)", color: isBidding ? "rgba(255,255,255,0.5)" : "#0a0a12", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}
                      >
                        {isBidding ? "✕ Cancelar" : "Pujar 💰"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Bid panel */}
                {isBidding && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>$</span>
                      <input
                        type="number" min="1" step="100" value={bidAmount}
                        onChange={e => { setBidAmount(e.target.value); setBidError(null); }}
                        placeholder={`Mínimo $${(a.currentPrice + 100).toLocaleString("es-CO")}`}
                        style={{ ...inp, paddingLeft: 28, width: 280 }}
                      />
                    </div>
                    <button
                      onClick={() => handleBid(a.id)}
                      style={{ background: "linear-gradient(135deg,#facc15,#fb923c)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                    >
                      Confirmar puja
                    </button>
                    {bidError && <span style={{ fontSize: 12, color: "#f87171" }}>{bidError}</span>}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && !loading && (
            <div style={{ textAlign: "center", padding: 60, color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
              {search || filterStatus !== "all"
                ? "Sin resultados para la búsqueda actual."
                : "No hay subastas disponibles. ¡Sé el primero en publicar una!"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
