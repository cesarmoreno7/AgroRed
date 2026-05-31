import { MapContainer, TileLayer, Circle, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface GeofenceZone {
  id: string;
  zoneName: string;
  zoneType: string;
  centerLat: number | null;
  centerLng: number | null;
  radiusM: number;
  isActive: boolean;
}

interface Props {
  zones: GeofenceZone[];
  selectedId?: string | null;
}

const ZONE_COLOR: Record<string, string> = {
  delivery:   "#4ade80",
  restricted: "#f87171",
  warehouse:  "#60a5fa",
  critical:   "#f59e0b",
};

const ZONE_LABEL: Record<string, string> = {
  delivery:   "Punto de entrega",
  restricted: "Zona restringida",
  warehouse:  "Bodega / Depósito",
  critical:   "Zona crítica",
};

function FitToZones({ zones }: { zones: GeofenceZone[] }) {
  const map = useMap();
  useEffect(() => {
    const withCoords = zones.filter(z => z.centerLat != null && z.centerLng != null);
    if (withCoords.length === 0) return;
    if (withCoords.length === 1) {
      const z = withCoords[0];
      if (!z) return;
      map.setView([z.centerLat!, z.centerLng!], 14);
      return;
    }
    const bounds = L.latLngBounds(withCoords.map(z => [z.centerLat!, z.centerLng!]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
  }, [map, zones]);
  return null;
}

export function GeofenceMap({ zones, selectedId }: Props) {
  const mapped = zones.filter(z => z.centerLat != null && z.centerLng != null);
  const center: [number, number] = mapped[0]
    ? [mapped[0].centerLat!, mapped[0].centerLng!]
    : [4.6, -74.1];

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 16,
      overflow: "hidden",
      height: 400,
    }}>
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }} zoomControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToZones zones={mapped} />
        {mapped.map(z => {
          const color = ZONE_COLOR[z.zoneType] ?? "#94a3b8";
          const isSelected = z.id === selectedId;
          return (
            <Circle
              key={z.id}
              center={[z.centerLat!, z.centerLng!]}
              radius={z.radiusM}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: isSelected ? 0.30 : 0.12,
                weight: isSelected ? 3 : 1.5,
                dashArray: z.zoneType === "restricted" ? "6 4" : undefined,
              }}
            >
              <Popup>
                <div style={{ fontFamily: "system-ui", minWidth: 160 }}>
                  <strong style={{ fontSize: 13 }}>{z.zoneName}</strong>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    {ZONE_LABEL[z.zoneType] ?? z.zoneType}
                  </div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                    Radio: {z.radiusM.toLocaleString()} m
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {z.centerLat?.toFixed(4)}, {z.centerLng?.toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Circle>
          );
        })}
      </MapContainer>
    </div>
  );
}
