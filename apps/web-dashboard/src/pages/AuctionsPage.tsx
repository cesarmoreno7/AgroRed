import { useEffect, useState, useMemo } from "react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";

interface Auction {
  id: string;
  productName: string;
  category: string;
  unit: string;
  quantityKg: number;
  auctionType: string;
  basePrice: number;
  currentPrice: number;
  currency: string;
  status: string;
  endsAt: string;
  municipalityName: string;
  winnerId?: string;
}

const STATUS_COLOR: Record<string, [string, string]> = {
  active:    ["#4ade80",  "Activa"],
  closed:    ["#94a3b8",  "Cerrada"],
  cancelled: ["#f87171",  "Cancelada"],
  extended:  ["#facc15",  "Extendida"],
};
const TYPE_LABEL: Record<string, string> = {
  standard: "Estándar",
  dutch:    "Holandesa",
  sealed:   "Sellada",
};
const TYPE_COLOR: Record<string, string> = {
  standard: "#60a5fa",
  dutch:    "#f59e0b",
  sealed:   "#a78bfa",
};

const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" };

export function AuctionsPage() {
  const { user } = useAuth();
  const [auctions, setAuctions] = useState<Auction[]>([]);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bidding, setBidding] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [bidError, setBidError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await api<{ data: Auction[]; total: number }>("/api/v1/auctions");
    if (res.ok) setAuctions(Array.isArray(res.data) ? res.data : (res.data as any).data ?? []);
    else setError(res.message);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return auctions.filter(a => {
      const matchSearch = a.productName?.toLowerCase().includes(q) || a.municipalityName?.toLowerCase().includes(q) || a.category?.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || a.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [auctions, search, filterStatus]);

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

  const canBid = ["community_kitchen", "logistics_operator", "admin_municipal"].includes(user?.role ?? "");
  const canPublish = ["producer", "admin_municipal"].includes(user?.role ?? "");

  return (
    <div style={{ color: "#fff", maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800, background: "linear-gradient(to right,#facc15,#fb923c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Subastas</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{auctions.length} subastas · {auctions.filter(a => a.status === "active").length} activas ahora</p>
        </div>
        <button onClick={load} style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "11px 20px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
          ↺ Actualizar
        </button>
      </div>

      {/* Search + filter row */}
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.4 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por producto, municipio o categoría…" style={{ ...inp, paddingLeft: 42, fontSize: 14, borderRadius: 12 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 160, borderRadius: 12 }}>
          <option value="all">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="closed">Cerradas</option>
          <option value="cancelled">Canceladas</option>
          <option value="extended">Extendidas</option>
        </select>
      </div>

      {canPublish && (
        <div style={{ padding: "14px 18px", background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.15)", borderRadius: 12, fontSize: 13, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>💡</span>
          Para publicar una subasta usa el endpoint <code style={{ background: "rgba(255,255,255,0.08)", padding: "2px 8px", borderRadius: 6, color: "#facc15", fontSize: 12 }}>POST /api/v1/auctions/publish</code>
        </div>
      )}

      {error && <div style={{ padding: "14px 18px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 12, color: "#f87171" }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.3)" }}>Cargando subastas…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(a => {
            const [sc, sl] = STATUS_COLOR[a.status] ?? ["#94a3b8", a.status];
            const tc = TYPE_COLOR[a.auctionType] ?? "#94a3b8";
            const isActive = a.status === "active";
            const isBidding = bidding === a.id;
            const endsAt = new Date(a.endsAt);
            const hoursLeft = Math.max(0, Math.round((endsAt.getTime() - Date.now()) / 3600000));

            return (
              <div key={a.id} style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${isActive ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.07)"}`, borderRadius: 16, padding: "18px 20px", transition: "transform 0.15s" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.transform = "translateY(-1px)")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = "none")}>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 16, alignItems: "center" }}>

                  {/* Product info */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 18 }}>🌾</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{a.productName}</span>
                      <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${tc}18`, color: tc, border: `1px solid ${tc}33` }}>{TYPE_LABEL[a.auctionType] ?? a.auctionType}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{a.category} · {a.quantityKg?.toLocaleString()} {a.unit} · 📍 {a.municipalityName}</div>
                  </div>

                  {/* Price */}
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Precio actual</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#facc15" }}>${a.currentPrice?.toLocaleString("es-CO")}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Base: ${a.basePrice?.toLocaleString("es-CO")} {a.currency}</div>
                  </div>

                  {/* Time */}
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Cierre</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isActive && hoursLeft < 24 ? "#f59e0b" : "rgba(255,255,255,0.7)" }}>
                      {endsAt.toLocaleDateString("es-CO")}
                    </div>
                    {isActive && <div style={{ fontSize: 11, color: hoursLeft < 6 ? "#f87171" : "rgba(255,255,255,0.3)" }}>{hoursLeft}h restantes</div>}
                  </div>

                  {/* Status */}
                  <div>
                    <span style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: `${sc}18`, color: sc, border: `1px solid ${sc}33` }}>{sl}</span>
                  </div>

                  {/* Bid action */}
                  <div>
                    {canBid && isActive && (
                      <button onClick={() => { setBidding(isBidding ? null : a.id); setBidAmount(""); setBidError(null); }}
                        style={{ background: isBidding ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#facc15,#fb923c)", color: isBidding ? "rgba(255,255,255,0.5)" : "#0a0a12", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>
                        {isBidding ? "✕ Cancelar" : "Pujar 💰"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Bid panel */}
                {isBidding && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>$</span>
                      <input type="number" min="1" step="100" value={bidAmount} onChange={e => { setBidAmount(e.target.value); setBidError(null); }}
                        placeholder={`Mínimo $${(a.currentPrice + 100).toLocaleString("es-CO")}`}
                        style={{ ...inp, paddingLeft: 28, maxWidth: 280 }} />
                    </div>
                    <button onClick={() => handleBid(a.id)} style={{ background: "linear-gradient(135deg,#facc15,#fb923c)", color: "#0a0a12", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                      Confirmar puja
                    </button>
                    {bidError && <span style={{ fontSize: 12, color: "#f87171" }}>{bidError}</span>}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
              {search || filterStatus !== "all" ? "Sin resultados para la búsqueda actual." : "No hay subastas disponibles."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
