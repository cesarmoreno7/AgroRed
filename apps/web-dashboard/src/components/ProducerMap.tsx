import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { fetchProducersGeoJSON } from "../services/producers";
import type { ProducerMapProperties, BboxParams } from "../services/producers";

const STATUS_COLOR: Record<string, string> = {
  active:               "#4ade80",
  pending_verification: "#facc15",
  inactive:             "#6b7280",
};

const TIPO_ICON: Record<string, string> = {
  individual:   "👨‍🌾",
  association:  "🤝",
  cooperative:  "🌐",
};

// Construye el SVG del marcador: pin de ubicación con emoji del tipo de productor
function makeIcon(color: string, emoji: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z"
          fill="${color}" stroke="rgba(0,0,0,0.25)" stroke-width="1.5"/>
    <circle cx="18" cy="18" r="12" fill="rgba(0,0,0,0.15)"/>
    <text x="18" y="23" text-anchor="middle" font-size="13">${emoji}</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize:    [36, 48],
    iconAnchor:  [18, 48],
    popupAnchor: [0, -44],
  });
}

// Popup HTML con datos completos del predio / productor
function buildPopup(props: ProducerMapProperties): string {
  const color   = STATUS_COLOR[props.status] ?? "#6b7280";
  const stLabel = props.status === "active" ? "Activo"
                : props.status === "pending_verification" ? "Pendiente verificación"
                : "Inactivo";
  const cats = props.productCategories.length
    ? props.productCategories.slice(0, 5).map(c =>
        `<span style="background:rgba(99,102,241,0.2);color:#a5b4fc;padding:1px 7px;border-radius:999px;font-size:10px;">${c}</span>`
      ).join(" ")
    : '<span style="color:#475569;font-size:10px;">Sin categorías</span>';
  const loc = [props.municipio, props.departamento].filter(Boolean).join(", ") || "—";
  const zona = [props.zona, props.comuna].filter(Boolean).join(" · ") || null;

  return `
  <div style="font-family:system-ui;min-width:200px;max-width:260px;padding:2px 0">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span style="font-size:20px">${TIPO_ICON[props.tipo] ?? "🌾"}</span>
      <div>
        <div style="font-weight:700;font-size:13px;color:#1e293b;line-height:1.3">${props.nombre}</div>
        <div style="font-size:10px;color:#64748b;text-transform:capitalize">${props.tipo}</div>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
      <span style="font-size:11px;color:${color};font-weight:600">${stLabel}</span>
    </div>

    <div style="margin-bottom:8px">
      <div style="font-size:10px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">📍 Predio</div>
      <div style="font-size:12px;color:#374151">${loc}</div>
      ${zona ? `<div style="font-size:11px;color:#6b7280">${zona}</div>` : ""}
    </div>

    <div style="margin-bottom:8px">
      <div style="font-size:10px;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">🌱 Cultivos</div>
      <div style="display:flex;flex-wrap:wrap;gap:3px">${cats}</div>
    </div>

    <div style="border-top:1px solid #f1f5f9;padding-top:8px;font-size:11px;color:#6b7280">
      ${props.contactName}<br/>
      📞 ${props.contactPhone}
    </div>
  </div>`;
}

interface MapLayerProps {
  onProducerClick: (p: ProducerMapProperties) => void;
  selectedProducerId?: string;
}

function MapLayer({ onProducerClick, selectedProducerId }: MapLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onClickRef = useRef(onProducerClick);
  useEffect(() => { onClickRef.current = onProducerClick; }, [onProducerClick]);

  useEffect(() => {
    async function loadFeatures() {
      const bounds = map.getBounds();
      const bbox: BboxParams = {
        minLng: bounds.getWest(),  minLat: bounds.getSouth(),
        maxLng: bounds.getEast(),  maxLat: bounds.getNorth(),
      };

      const result = await fetchProducersGeoJSON(bbox);
      if (!result.ok) return;

      if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }

      const { features } = result.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layer: L.LayerGroup = features.length > 200
        ? (L as any).markerClusterGroup({ maxClusterRadius: 60, showCoverageOnHover: false })
        : L.layerGroup();

      for (const feature of features) {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;
        const color  = STATUS_COLOR[props.status] ?? "#6b7280";
        const emoji  = TIPO_ICON[props.tipo] ?? "🌾";
        const marker = L.marker([lat, lng], { icon: makeIcon(color, emoji) });

        // Rich popup
        marker.bindPopup(buildPopup(props), { maxWidth: 280, className: "agrored-popup" });

        // Click → open side panel
        marker.on("click", () => {
          onClickRef.current(props);
          marker.openPopup();
        });

        // Auto-open popup for the selected producer
        if (props.id === selectedProducerId) {
          marker.openPopup();
        }

        layer.addLayer(marker);
      }

      layer.addTo(map);
      layerRef.current = layer;
    }

    loadFeatures();
    map.on("moveend", loadFeatures);

    return () => {
      map.off("moveend", loadFeatures);
      if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

interface Props {
  onProducerClick: (p: ProducerMapProperties) => void;
  selectedProducerId?: string;
}

export function ProducerMap({ onProducerClick, selectedProducerId }: Props) {
  return (
    <>
      <style>{`
        .agrored-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18);
          padding: 0;
        }
        .agrored-popup .leaflet-popup-content { margin: 14px; }
        .agrored-popup .leaflet-popup-tip { background: #fff; }
      `}</style>
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16, overflow: "hidden", height: 500,
      }}>
        <MapContainer center={[4.6, -74.1]} zoom={7} style={{ height: "100%", width: "100%" }} zoomControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapLayer onProducerClick={onProducerClick} selectedProducerId={selectedProducerId} />
        </MapContainer>
      </div>
    </>
  );
}
