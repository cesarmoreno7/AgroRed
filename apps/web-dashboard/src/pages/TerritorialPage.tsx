import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { api } from "../services/api";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ProducerProperties {
  id: string;
  nombre: string;
  tipo: string;
  contactName: string;
  contactPhone: string;
  productCategories: string[];
  status: string;
  zona: string | null;
  comuna: string | null;
  municipio: string | null;
  departamento: string | null;
}

interface DemandProperties {
  id: string;
  organizationName: string;
  productName: string;
  quantityRequired: number;
  unit: string;
  status: string;
  requiredBy: string | null;
  beneficiaryCount: number;
  municipio: string | null;
}

interface Feature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: ProducerProperties | DemandProperties;
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: Feature[];
}

interface SpatialDetails {
  type: "producer" | "client";
  name: string;
  offers?: { title: string; productName: string; category: string; unit: string; quantityAvailable: number; priceAmount: number; status: string }[];
  demands?: { productName: string; category: string; unit: string; quantityRequired: number; status: string; neededBy: string }[];
  inventory?: { productName: string; category: string; unit: string; quantityOnHand: number }[];
}

interface SearchResult {
  id: string;
  type: "producer" | "client";
  name: string;
  sub: string;
  coords: [number, number];
}

// Componente que centra el mapa en los marcadores al cargar
function FitBounds({ producers, demands }: { producers: Feature[]; demands: Feature[] }) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = [];
    producers.forEach(f => coords.push([f.geometry.coordinates[1], f.geometry.coordinates[0]]));
    demands.forEach(f => coords.push([f.geometry.coordinates[1], f.geometry.coordinates[0]]));
    if (coords.length > 0) {
      map.fitBounds(L.latLngBounds(coords), { padding: [50, 50], maxZoom: 14 });
    }
  }, [map, producers, demands]);
  return null;
}

// Componente que anima el mapa hacia un punto seleccionado
function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 15, { duration: 1.2 });
  }, [map, target]);
  return null;
}

export function TerritorialPage() {
  const [producers, setProducers] = useState<Feature[]>([]);
  const [demands, setDemands] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProducers, setShowProducers] = useState(true);
  const [showClients, setShowClients] = useState(true);
  const [selectedItem, setSelectedItem] = useState<{ id: string; type: "producer" | "client"; name: string } | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [details, setDetails] = useState<SpatialDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState<[number, number] | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const loadGISData = useCallback(async () => {
    setLoading(true);
    const [resProd, resDem] = await Promise.all([
      api<FeatureCollection>("/api/v1/analytics/map/producers"),
      api<FeatureCollection>("/api/v1/analytics/map/demands"),
    ]);
    if (resProd.ok) setProducers(resProd.data.features || []);
    if (resDem.ok) setDemands(resDem.data.features || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadGISData(); }, [loadGISData]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Resultados de búsqueda filtrados en tiempo real
  const searchResults = useMemo<SearchResult[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const prodResults: SearchResult[] = producers
      .filter(p => {
        const pp = p.properties as ProducerProperties;
        return (pp.nombre || "").toLowerCase().includes(q) ||
               (pp.municipio || "").toLowerCase().includes(q) ||
               (pp.tipo || "").toLowerCase().includes(q);
      })
      .slice(0, 6)
      .map(p => {
        const pp = p.properties as ProducerProperties;
        return {
          id: pp.id,
          type: "producer" as const,
          name: pp.nombre || "Productor",
          sub: pp.municipio || "",
          coords: [p.geometry.coordinates[1], p.geometry.coordinates[0]] as [number, number],
        };
      });

    const clientResults: SearchResult[] = demands
      .filter(d => {
        const dp = d.properties as DemandProperties;
        return (dp.organizationName || "").toLowerCase().includes(q) ||
               (dp.municipio || "").toLowerCase().includes(q);
      })
      .slice(0, 6)
      .map(d => {
        const dp = d.properties as DemandProperties;
        return {
          id: dp.id,
          type: "client" as const,
          name: dp.organizationName || "Institución",
          sub: dp.municipio || "",
          coords: [d.geometry.coordinates[1], d.geometry.coordinates[0]] as [number, number],
        };
      });

    return [...prodResults, ...clientResults];
  }, [searchQuery, producers, demands]);

  const handleSearchSelect = (result: SearchResult) => {
    setSearchQuery(result.name);
    setShowDropdown(false);
    setFlyToTarget(result.coords);
    const feature = result.type === "producer"
      ? producers.find(p => (p.properties as ProducerProperties).id === result.id)
      : demands.find(d => (d.properties as DemandProperties).id === result.id);
    handleMarkerClick(result.id, result.type, result.name, feature ?? null);
    if (result.type === "producer") setShowProducers(true);
    else setShowClients(true);
  };

  const handleMarkerClick = async (id: string, type: "producer" | "client", name: string, feature: Feature | null = null) => {
    setSelectedItem({ id, type, name });
    setSelectedFeature(feature);
    setLoadingDetails(true);
    setDetails(null);
    const res = await api<SpatialDetails>("/api/v1/analytics/spatial/details", { params: { type, id } });
    if (res.ok) setDetails(res.data);
    setLoadingDetails(false);
  };

  const producerIcon = useMemo(() => L.divIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:rgba(16,185,129,0.85);border:2.5px solid #059669;border-radius:50%;box-shadow:0 2px 8px rgba(16,185,129,0.5);font-size:16px;">🌾</div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  }), []);

  const clientIcon = useMemo(() => L.divIcon({
    html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:rgba(6,182,212,0.85);border:2.5px solid #0891b2;border-radius:50%;box-shadow:0 2px 8px rgba(6,182,212,0.5);font-size:16px;">🏢</div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  }), []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 15 }}>Cargando mapa territorial…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", animation: "fadeIn 0.5s ease-out" }}>

      {/* ── Panel de cabecera + búsqueda ── */}
      <div style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 16,
        padding: "20px 24px",
        marginBottom: 20,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          {/* Título */}
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, color: "#fff", background: "linear-gradient(to right, #4ade80, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Inteligencia Territorial
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              {producers.length} predios productores · {demands.length} instituciones clientes
            </p>
          </div>

          {/* Controles de capa */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {[
              { label: `Predios (${producers.length})`, icon: "🌾", active: showProducers, color: "#10b981", toggle: () => setShowProducers(v => !v) },
              { label: `Instituciones (${demands.length})`, icon: "🏢", active: showClients, color: "#06b6d4", toggle: () => setShowClients(v => !v) },
            ].map(btn => (
              <button key={btn.label} onClick={btn.toggle} style={{
                background: btn.active ? `${btn.color}22` : "rgba(255,255,255,0.03)",
                border: `1px solid ${btn.active ? btn.color + "55" : "rgba(255,255,255,0.08)"}`,
                color: btn.active ? btn.color : "rgba(255,255,255,0.4)",
                padding: "8px 14px", borderRadius: 30, fontSize: 12, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
              }}>
                <span>{btn.icon}</span> {btn.label}
              </button>
            ))}
            <button onClick={loadGISData} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.5)", padding: "8px 14px", borderRadius: 30,
              fontSize: 12, cursor: "pointer",
            }}>↺ Actualizar</button>
          </div>
        </div>

        {/* ── Barra de búsqueda ── */}
        <div ref={searchRef} style={{ marginTop: 16, position: "relative" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, pointerEvents: "none" }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => searchQuery && setShowDropdown(true)}
              placeholder="Buscar predio productor o institución cliente…"
              style={{
                width: "100%", padding: "11px 16px 11px 42px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10, color: "#fff", fontSize: 14,
                outline: "none", boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocusCapture={e => (e.currentTarget.style.borderColor = "#4ade80")}
              onBlurCapture={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setShowDropdown(false); }} style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "rgba(255,255,255,0.4)",
                cursor: "pointer", fontSize: 16, padding: 0,
              }}>✕</button>
            )}
          </div>

          {/* Dropdown de resultados */}
          {showDropdown && searchResults.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: "#111827", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, zIndex: 9999, overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}>
              {searchResults.map((r, i) => (
                <button
                  key={r.id + r.type}
                  onMouseDown={() => handleSearchSelect(r)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    width: "100%", padding: "11px 16px",
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                    border: "none", borderBottom: i < searchResults.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    cursor: "pointer", textAlign: "left", transition: "background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(74,222,128,0.07)")}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)")}
                >
                  <span style={{
                    width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 14, flexShrink: 0,
                    background: r.type === "producer" ? "rgba(16,185,129,0.2)" : "rgba(6,182,212,0.2)",
                  }}>
                    {r.type === "producer" ? "🌾" : "🏢"}
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
                      {r.type === "producer" ? "Predio productor" : "Institución cliente"}{r.sub ? ` · ${r.sub}` : ""}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {showDropdown && searchQuery.trim() && searchResults.length === 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: "#111827", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10, zIndex: 9999, padding: "16px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center",
            }}>
              Sin resultados para "<strong style={{ color: "#fff" }}>{searchQuery}</strong>"
            </div>
          )}
        </div>
      </div>

      {/* ── Mapa + panel de detalle ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, height: 580 }}>

        {/* Mapa */}
        <div style={{
          borderRadius: 16, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}>
          <MapContainer center={[5.5, -75.0]} zoom={7} style={{ height: "100%", width: "100%" }} zoomControl>
            {/* Tile claro CARTO Voyager — colores vibrantes, sin exceso de oscuridad */}
            <TileLayer
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

            <FitBounds producers={showProducers ? producers : []} demands={showClients ? demands : []} />
            <FlyTo target={flyToTarget} />

            {showProducers && producers.map(p => {
              const pp = p.properties as ProducerProperties;
              return (
                <Marker
                  key={`prod-${pp.id}`}
                  position={[p.geometry.coordinates[1], p.geometry.coordinates[0]]}
                  icon={producerIcon}
                  eventHandlers={{ click: () => handleMarkerClick(pp.id, "producer", pp.nombre, p) }}
                />
              );
            })}

            {showClients && demands.map(d => {
              const dp = d.properties as DemandProperties;
              return (
                <Marker
                  key={`dem-${dp.id}`}
                  position={[d.geometry.coordinates[1], d.geometry.coordinates[0]]}
                  icon={clientIcon}
                  eventHandlers={{ click: () => handleMarkerClick(dp.id, "client", dp.organizationName, d) }}
                />
              );
            })}
          </MapContainer>
        </div>

        {/* Panel de detalle */}
        <div style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16, padding: 22,
          backdropFilter: "blur(16px)",
          display: "flex", flexDirection: "column", overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}>
          {selectedItem ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn 0.3s ease-out" }}>

              {/* ── Productor ── */}
              {selectedItem.type === "producer" && selectedFeature && (() => {
                const p = selectedFeature.properties as ProducerProperties;
                const tipoLabel: Record<string, string> = { individual: "Individual", association: "Asociación", cooperative: "Cooperativa" };
                const statusColor: Record<string, string> = { active: "#10b981", pending_verification: "#f59e0b", inactive: "#6b7280" };
                const statusLabel: Record<string, string> = { active: "Activo", pending_verification: "Pendiente", inactive: "Inactivo" };
                return (
                  <>
                    {/* Cabecera */}
                    <div style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 100%)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 14, padding: "16px 16px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#10b981" }}>🌾 Predio Productor</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: `${statusColor[p.status] ?? "#6b7280"}22`, color: statusColor[p.status] ?? "#6b7280" }}>
                          {statusLabel[p.status] ?? p.status}
                        </span>
                      </div>
                      <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{p.nombre}</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                        <span style={{ background: "rgba(16,185,129,0.1)", color: "#34d399", padding: "2px 8px", borderRadius: 20, fontWeight: 600, fontSize: 11 }}>{tipoLabel[p.tipo] ?? p.tipo}</span>
                        {p.municipio && <span>📍 {p.municipio}{p.departamento ? `, ${p.departamento}` : ""}</span>}
                        {p.zona && <span>· {p.zona === "rural" ? "Zona rural" : "Periferia urbana"}</span>}
                      </div>
                    </div>

                    {/* Contacto */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Contacto</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>👤</span>
                        <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{p.contactName}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>📞</span>
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>{p.contactPhone}</span>
                      </div>
                    </div>

                    {/* Cultivos */}
                    {p.productCategories && p.productCategories.length > 0 && (
                      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>🌱 Cultivos registrados</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {p.productCategories.map((cat, i) => (
                            <span key={i} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80" }}>
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ofertas activas (de la API) */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>📈 Cosechas publicadas</div>
                      {loadingDetails ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
                          <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)", borderTop: "2px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Cargando…</span>
                        </div>
                      ) : details?.offers && details.offers.length > 0 ? (
                        details.offers.map((o, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < details.offers!.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{o.productName}</div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{o.category} · {o.status === "published" ? "Publicada" : o.status}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#10b981" }}>{o.quantityAvailable}<span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginLeft: 3 }}>{o.unit}</span></div>
                              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>${o.priceAmount.toLocaleString()} c/u</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "12px 0", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 8 }}>
                          Sin cosechas publicadas aún
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

              {/* ── Institución cliente ── */}
              {selectedItem.type === "client" && selectedFeature && (() => {
                const d = selectedFeature.properties as DemandProperties;
                return (
                  <>
                    {/* Cabecera */}
                    <div style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(6,182,212,0.04) 100%)", border: "1px solid rgba(6,182,212,0.25)", borderRadius: 14, padding: "16px 16px 14px" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#06b6d4", marginBottom: 8 }}>🏢 Institución Cliente</div>
                      <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{d.organizationName}</h3>
                      {d.municipio && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>📍 {d.municipio}</div>}
                    </div>

                    {/* Detalle de la demanda */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>🍽️ Demanda activa</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{d.productName}</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>{d.quantityRequired} <span style={{ fontSize: 11, fontWeight: 400, color: "rgba(255,255,255,0.4)" }}>{d.unit}</span></span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                        {d.requiredBy && <span>📅 Límite: <strong style={{ color: "#e2e8f0" }}>{new Date(d.requiredBy).toLocaleDateString("es-CO")}</strong></span>}
                        <span>👥 <strong style={{ color: "#e2e8f0" }}>{d.beneficiaryCount}</strong> beneficiarios</span>
                      </div>
                    </div>

                    {/* Inventario en sitio (API) */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>📦 Inventario en sitio</div>
                      {loadingDetails ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
                          <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.1)", borderTop: "2px solid #06b6d4", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Cargando…</span>
                        </div>
                      ) : details?.inventory && details.inventory.length > 0 ? (
                        details.inventory.map((inv, i) => (
                          <div key={i} style={{ marginBottom: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{inv.productName}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#06b6d4" }}>{inv.quantityOnHand} <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{inv.unit}</span></span>
                            </div>
                            <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(100, (inv.quantityOnHand / 500) * 100)}%`, height: "100%", background: "linear-gradient(to right, #0891b2, #06b6d4)", borderRadius: 2 }} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "12px 0", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: 8 }}>
                          Sin inventario registrado
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}

            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1, textAlign: "center", color: "rgba(255,255,255,0.25)", padding: "40px 0" }}>
              <span style={{ fontSize: 44, marginBottom: 14, display: "block", animation: "bounce 2s infinite" }}>🗺️</span>
              <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Explorar estadísticas</h4>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, maxWidth: 200 }}>
                Usa la búsqueda o haz clic en un marcador del mapa para ver estadísticas en tiempo real.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div style={{ display: "flex", gap: 20, marginTop: 14, fontSize: 12, color: "rgba(255,255,255,0.4)", alignItems: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />Predio productor</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: "#06b6d4", display: "inline-block" }} />Institución cliente</span>
        <span style={{ marginLeft: "auto" }}>Haz clic en cualquier marcador para ver detalles</span>
      </div>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        .leaflet-container { font-family: inherit; }
      `}</style>
    </div>
  );
}
