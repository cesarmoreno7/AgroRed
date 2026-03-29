import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { fetchDeliveryTimeline, fetchRoute } from "../services/tracking.service";
import { recordDeliveryEvent } from "../services/tracking.service";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "../hooks/useLocation";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList, DeliveryEventRecord, DeliveryEvent } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "DeliveryDetail">;

const EVENT_ICONS: Record<string, string> = {
  asignado: "📋",
  aceptado: "✅",
  rechazado: "❌",
  inicio_ruta: "🚀",
  llegada_origen: "📍",
  recogida: "📦",
  en_transito: "🚚",
  llegada_destino: "🏁",
  entregado: "✅",
  no_entregado: "⚠️",
  cancelado: "🚫",
  pausa: "⏸️",
  reanudacion: "▶️",
};

const NEXT_EVENTS: Record<string, DeliveryEvent> = {
  asignado: "aceptado",
  aceptado: "inicio_ruta",
  inicio_ruta: "llegada_origen",
  llegada_origen: "recogida",
  recogida: "en_transito",
  en_transito: "llegada_destino",
  llegada_destino: "entregado",
};

export default function DeliveryDetailScreen({ route, navigation }: Props) {
  const { ordenId } = route.params;
  const { user } = useAuth();
  const { location, getCurrentLocation } = useLocation();
  const [timeline, setTimeline] = useState<DeliveryEventRecord[]>([]);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [tlResult, routeResult] = await Promise.all([
      fetchDeliveryTimeline(ordenId),
      fetchRoute(ordenId),
    ]);

    if (tlResult.ok) {
      setTimeline(Array.isArray(tlResult.data) ? tlResult.data : []);
    }
    if (routeResult.ok && Array.isArray(routeResult.data)) {
      setRouteCoords(
        routeResult.data.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [ordenId]);

  const lastEvent = timeline.length > 0 ? timeline[timeline.length - 1].evento : null;
  const nextEvent = lastEvent ? NEXT_EVENTS[lastEvent] ?? null : null;

  const handleNextEvent = async () => {
    if (!nextEvent) return;

    const loc = location ?? (await getCurrentLocation());

    const result = await recordDeliveryEvent({
      ordenId,
      recursoId: user?.id ?? "",
      evento: nextEvent,
      latitude: loc?.latitude,
      longitude: loc?.longitude,
    });

    if (result.ok) {
      Alert.alert("Evento registrado", `${nextEvent} enviado.`);
      loadData();
    } else {
      Alert.alert("Error", "No se pudo registrar el evento.");
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2E7D32" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Route map */}
      {routeCoords.length > 0 && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: routeCoords[0].latitude,
              longitude: routeCoords[0].longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            <Polyline
              coordinates={routeCoords}
              strokeColor="#2196F3"
              strokeWidth={3}
            />
            {/* Start marker */}
            <Marker
              coordinate={routeCoords[0]}
              pinColor="#4CAF50"
              title="Inicio"
            />
            {/* End marker */}
            <Marker
              coordinate={routeCoords[routeCoords.length - 1]}
              pinColor="#F44336"
              title="Última posición"
            />
          </MapView>
        </View>
      )}

      {/* Order header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orden de entrega</Text>
        <Text style={styles.orderId}>{ordenId.slice(0, 8)}...</Text>
        {lastEvent && (
          <View style={styles.currentStatus}>
            <Text style={styles.currentStatusIcon}>{EVENT_ICONS[lastEvent] ?? "📋"}</Text>
            <Text style={styles.currentStatusText}>{lastEvent.replace(/_/g, " ")}</Text>
          </View>
        )}
      </View>

      {/* Next action */}
      {nextEvent && (
        <TouchableOpacity
          style={styles.nextActionButton}
          onPress={handleNextEvent}
          activeOpacity={0.8}
        >
          <Text style={styles.nextActionText}>
            {EVENT_ICONS[nextEvent] ?? "➡️"} Registrar: {nextEvent.replace(/_/g, " ")}
          </Text>
        </TouchableOpacity>
      )}

      {/* Timeline */}
      <Text style={styles.sectionTitle}>Línea de tiempo</Text>
      {timeline.length === 0 ? (
        <Text style={styles.emptyText}>Sin eventos registrados.</Text>
      ) : (
        <View style={styles.timeline}>
          {timeline.map((event, i) => (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View
                  style={[
                    styles.timelineDot,
                    i === timeline.length - 1 && styles.timelineDotActive,
                  ]}
                >
                  <Text style={styles.timelineDotIcon}>
                    {EVENT_ICONS[event.evento] ?? "📋"}
                  </Text>
                </View>
                {i < timeline.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineEvent}>
                  {event.evento.replace(/_/g, " ")}
                </Text>
                <Text style={styles.timelineTime}>
                  {new Date(event.registradoAt).toLocaleString("es-CO")}
                </Text>
                {event.recursoNombre && (
                  <Text style={styles.timelineMeta}>{event.recursoNombre}</Text>
                )}
                {event.notas && (
                  <Text style={styles.timelineNotes}>{event.notas}</Text>
                )}
                {event.latitude != null && (
                  <Text style={styles.timelineCoords}>
                    📍 {event.latitude.toFixed(5)}, {event.longitude?.toFixed(5)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  mapContainer: { height: 200 },
  map: { flex: 1 },
  header: {
    backgroundColor: "#fff",
    padding: 16,
    margin: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: { fontSize: 13, color: "#888", fontWeight: "600" },
  orderId: { fontSize: 18, fontWeight: "700", color: "#333", marginTop: 4 },
  currentStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "#E8F5E9",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  currentStatusIcon: { fontSize: 16, marginRight: 6 },
  currentStatusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2E7D32",
    textTransform: "capitalize",
  },
  nextActionButton: {
    backgroundColor: "#2E7D32",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  nextActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
    paddingHorizontal: 16,
    fontStyle: "italic",
  },
  timeline: {
    paddingHorizontal: 16,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 0,
  },
  timelineLeft: {
    width: 40,
    alignItems: "center",
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  timelineDotActive: {
    backgroundColor: "#C8E6C9",
  },
  timelineDotIcon: { fontSize: 14 },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E0E0E0",
    minHeight: 30,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginLeft: 8,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  timelineEvent: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    textTransform: "capitalize",
  },
  timelineTime: { fontSize: 12, color: "#888", marginTop: 2 },
  timelineMeta: { fontSize: 12, color: "#666", marginTop: 2 },
  timelineNotes: {
    fontSize: 12,
    color: "#555",
    marginTop: 4,
    fontStyle: "italic",
  },
  timelineCoords: { fontSize: 11, color: "#999", marginTop: 4 },
});
