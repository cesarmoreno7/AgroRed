import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CurrentPosition } from "../types";

interface Props {
  resources: CurrentPosition[];
}

const STATUS_COLOR: Record<string, string> = {
  en_ruta: "#4ade80",
  disponible: "#60a5fa",
  inactivo: "#6b7280",
  mantenimiento: "#f59e0b",
};

function makeIcon(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="${color}"/>
    <circle cx="14" cy="14" r="6" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36],
  });
}

// Auto-fit bounds when resources change
function FitBounds({ resources }: { resources: CurrentPosition[] }) {
  const map = useMap();
  useEffect(() => {
    if (resources.length === 0) return;
    const bounds = L.latLngBounds(resources.map(r => [r.latitude, r.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, resources]);
  return null;
}

export function FleetMap({ resources }: Props) {
  const positioned = useMemo(
    () => resources.filter(r => r.latitude != null && r.longitude != null),
    [resources]
  );

  // Default center: Colombia
  const center: [number, number] = positioned.length > 0
    ? [positioned[0].latitude, positioned[0].longitude]
    : [4.6, -74.1];

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16,
      overflow: "hidden",
      height: 420,
    }}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds resources={positioned} />
        {positioned.map(r => (
          <Marker
            key={r.recursoId}
            position={[r.latitude, r.longitude]}
            icon={makeIcon(STATUS_COLOR[r.estado] ?? "#6b7280")}
          >
            <Popup>
              <div style={{ fontFamily: "system-ui", minWidth: 160 }}>
                <strong>{r.nombre}</strong>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  {r.tipo} · {r.estado.replace("_", " ")}
                </div>
                {r.velocidad != null && (
                  <div style={{ fontSize: 12, marginTop: 2 }}>{r.velocidad.toFixed(0)} km/h</div>
                )}
                {r.evento && (
                  <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{r.evento}</div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
