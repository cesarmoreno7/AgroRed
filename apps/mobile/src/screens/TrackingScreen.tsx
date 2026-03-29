import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  AppState,
} from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import { useLocation } from "../hooks/useLocation";
import { useOfflineBuffer } from "../hooks/useOfflineBuffer";
import { useAuth } from "../context/AuthContext";
import {
  sendPosition,
  fetchActiveResources,
  fetchCurrentPosition,
} from "../services/tracking.service";
import type { CurrentPosition, TrackingPointData, TrackingEvent } from "../types";

const DELIVERY_EVENTS: { key: TrackingEvent; label: string; icon: string }[] = [
  { key: "inicio_ruta", label: "Inicio ruta", icon: "🚀" },
  { key: "llegada_origen", label: "En origen", icon: "📍" },
  { key: "recogida", label: "Recogido", icon: "📦" },
  { key: "en_transito", label: "En tránsito", icon: "🚚" },
  { key: "llegada_destino", label: "En destino", icon: "🏁" },
  { key: "entregado", label: "Entregado", icon: "✅" },
  { key: "pausa", label: "Pausar", icon: "⏸️" },
  { key: "reanudacion", label: "Reanudar", icon: "▶️" },
];

export default function TrackingScreen() {
  const { user } = useAuth();
  const { location, tracking, startTracking, stopTracking } = useLocation();
  const { bufferCount, isFlushing, addToBuffer, flushBuffer, startAutoFlush, stopAutoFlush } =
    useOfflineBuffer();

  const mapRef = useRef<MapView>(null);
  const [activeResources, setActiveResources] = useState<CurrentPosition[]>([]);
  const [routePoints, setRoutePoints] = useState<{ latitude: number; longitude: number }[]>([]);
  const [recursoId, setRecursoId] = useState<string | null>(null);
  const [currentOrdenId, setCurrentOrdenId] = useState<string | null>(null);
  const [positionCount, setPositionCount] = useState(0);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);

  // Load user's resource ID from profile
  useEffect(() => {
    if (!user) return;
    // Use the user ID as a proxy to find their resource
    // In production, this would come from user profile/resource assignment
    setRecursoId(user.id);
  }, [user]);

  // Send position when location changes and tracking is active
  useEffect(() => {
    if (!tracking || !location || !recursoId) return;

    const point: TrackingPointData = {
      recursoId,
      ordenId: currentOrdenId ?? undefined,
      latitude: location.latitude,
      longitude: location.longitude,
      velocidad: location.speed ?? undefined,
      precisionGps: location.accuracy ?? undefined,
      bearing: location.heading ?? undefined,
      evento: "posicion",
    };

    (async () => {
      const result = await sendPosition(point);
      if (result.ok) {
        setPositionCount((c) => c + 1);
        setLastSentAt(new Date().toLocaleTimeString());
        setRoutePoints((prev) => [
          ...prev,
          { latitude: location.latitude, longitude: location.longitude },
        ]);
      } else {
        // Offline: buffer the point
        await addToBuffer(point);
      }
    })();
  }, [location, tracking, recursoId, currentOrdenId]);

  // Load active resources periodically
  const loadActive = useCallback(async () => {
    const result = await fetchActiveResources(user?.tenantId);
    if (result.ok && Array.isArray(result.data)) {
      setActiveResources(result.data);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    loadActive();
    const timer = setInterval(loadActive, 10000);
    return () => clearInterval(timer);
  }, [loadActive]);

  // Handle app state changes (flush buffer when coming to foreground)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && bufferCount > 0) {
        flushBuffer();
      }
    });
    return () => sub.remove();
  }, [bufferCount, flushBuffer]);

  const handleToggleTracking = async () => {
    if (tracking) {
      stopTracking();
      stopAutoFlush();
      if (bufferCount > 0) {
        await flushBuffer();
      }
    } else {
      await startTracking();
      startAutoFlush();
      setRoutePoints([]);
      setPositionCount(0);
    }
  };

  const handleEventPress = async (evento: TrackingEvent) => {
    if (!location || !recursoId) {
      Alert.alert("Error", "Ubicación no disponible.");
      return;
    }

    const result = await sendPosition({
      recursoId,
      ordenId: currentOrdenId ?? undefined,
      latitude: location.latitude,
      longitude: location.longitude,
      velocidad: location.speed ?? undefined,
      bearing: location.heading ?? undefined,
      evento,
    });

    if (result.ok) {
      Alert.alert("Evento registrado", `${evento} enviado correctamente.`);
    } else {
      Alert.alert("Error", "No se pudo enviar el evento.");
    }
  };

  const centerOnLocation = () => {
    if (location) {
      mapRef.current?.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Map section */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          showsUserLocation
          initialRegion={{
            latitude: location?.latitude ?? 4.6,
            longitude: location?.longitude ?? -74.08,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Other active resources */}
          {activeResources
            .filter((r) => r.recursoId !== recursoId)
            .map((r) => (
              <Marker
                key={r.recursoId}
                coordinate={{ latitude: r.latitude, longitude: r.longitude }}
                pinColor="#00BCD4"
                title={r.nombre}
                description={`${r.tipo} · ${r.estado}`}
              />
            ))}

          {/* Route polyline */}
          {routePoints.length > 1 && (
            <Polyline
              coordinates={routePoints}
              strokeColor="#2196F3"
              strokeWidth={3}
            />
          )}
        </MapView>

        {/* Status overlay */}
        <View style={styles.statusOverlay}>
          <View style={[styles.statusDot, { backgroundColor: tracking ? "#4CAF50" : "#F44336" }]} />
          <Text style={styles.statusText}>
            {tracking ? "Tracking activo" : "Tracking inactivo"}
          </Text>
          {bufferCount > 0 && (
            <View style={styles.bufferBadge}>
              <Text style={styles.bufferText}>
                {isFlushing ? "Enviando..." : `${bufferCount} pendientes`}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.centerBtn} onPress={centerOnLocation}>
          <Text style={styles.centerBtnText}>📍</Text>
        </TouchableOpacity>
      </View>

      {/* Controls section */}
      <ScrollView style={styles.controls}>
        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{positionCount}</Text>
            <Text style={styles.statLabel}>Puntos GPS</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {location?.speed ? `${(location.speed * 3.6).toFixed(0)}` : "—"}
            </Text>
            <Text style={styles.statLabel}>km/h</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {location?.accuracy ? `${location.accuracy.toFixed(0)}m` : "—"}
            </Text>
            <Text style={styles.statLabel}>Precisión</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{lastSentAt ?? "—"}</Text>
            <Text style={styles.statLabel}>Último envío</Text>
          </View>
        </View>

        {/* Start/Stop button */}
        <TouchableOpacity
          style={[styles.mainButton, tracking ? styles.stopButton : styles.startButton]}
          onPress={handleToggleTracking}
          activeOpacity={0.8}
        >
          <Text style={styles.mainButtonText}>
            {tracking ? "⏹️  Detener tracking" : "▶️  Iniciar tracking"}
          </Text>
        </TouchableOpacity>

        {/* Event buttons */}
        {tracking && (
          <>
            <Text style={styles.sectionTitle}>Registrar evento</Text>
            <View style={styles.eventsGrid}>
              {DELIVERY_EVENTS.map(({ key, label, icon }) => (
                <TouchableOpacity
                  key={key}
                  style={styles.eventButton}
                  onPress={() => handleEventPress(key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eventIcon}>{icon}</Text>
                  <Text style={styles.eventLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Active resources list */}
        {activeResources.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Recursos activos ({activeResources.length})
            </Text>
            {activeResources.map((r) => (
              <View key={r.recursoId} style={styles.resourceRow}>
                <Text style={styles.resourceIcon}>
                  {r.tipo === "vehiculo" ? "🚛" : r.tipo === "moto" ? "🏍️" : "🚴"}
                </Text>
                <View style={styles.resourceInfo}>
                  <Text style={styles.resourceName}>{r.nombre}</Text>
                  <Text style={styles.resourceMeta}>
                    {r.evento}
                    {r.velocidad ? ` · ${r.velocidad.toFixed(0)} km/h` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  mapContainer: { height: "40%", position: "relative" },
  map: { flex: 1 },
  statusOverlay: {
    position: "absolute",
    top: 60,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffffee",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: { fontSize: 13, fontWeight: "600", color: "#333" },
  bufferBadge: {
    marginLeft: 8,
    backgroundColor: "#FFF3E0",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bufferText: { fontSize: 11, color: "#E65100", fontWeight: "600" },
  centerBtn: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  centerBtnText: { fontSize: 20 },
  controls: { flex: 1, padding: 16 },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: { fontSize: 16, fontWeight: "700", color: "#333" },
  statLabel: { fontSize: 10, color: "#888", marginTop: 2 },
  mainButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  startButton: { backgroundColor: "#2E7D32" },
  stopButton: { backgroundColor: "#D32F2F" },
  mainButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  eventsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  eventButton: {
    width: "23%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  eventIcon: { fontSize: 22, marginBottom: 4 },
  eventLabel: { fontSize: 10, color: "#555", textAlign: "center" },
  resourceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resourceIcon: { fontSize: 24, marginRight: 12 },
  resourceInfo: { flex: 1 },
  resourceName: { fontSize: 14, fontWeight: "600", color: "#333" },
  resourceMeta: { fontSize: 12, color: "#888", marginTop: 2 },
});
