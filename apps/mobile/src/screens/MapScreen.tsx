import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import MapView, { Marker, Region, Callout } from "react-native-maps";
import { fetchMapLayer, fetchNearbyProducers } from "../services/map.service";
import { useLocation } from "../hooks/useLocation";
import { MAP_LAYERS, LAYER_LABELS, LAYER_COLORS } from "../config/api";
import type { MapLayerName } from "../config/api";
import type { GeoJsonFeature, GeoJsonFeatureCollection } from "../types";

const { width } = Dimensions.get("window");

// Colombia center
const INITIAL_REGION: Region = {
  latitude: 4.6,
  longitude: -74.08,
  latitudeDelta: 6,
  longitudeDelta: 6,
};

// Icons for each layer
const LAYER_ICONS: Record<MapLayerName, string> = {
  producers: "🌾",
  offers: "📦",
  canteens: "🍽️",
  rescues: "♻️",
  incidents: "⚠️",
  demands: "📋",
  resources: "🚚",
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { location, getCurrentLocation } = useLocation();
  const [activeLayers, setActiveLayers] = useState<Set<MapLayerName>>(new Set(["producers"]));
  const [layerData, setLayerData] = useState<
    Partial<Record<MapLayerName, GeoJsonFeatureCollection>>
  >({});
  const [loading, setLoading] = useState(false);
  const [showLayers, setShowLayers] = useState(false);

  const toggleLayer = useCallback((layer: MapLayerName) => {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  }, []);

  const loadLayers = useCallback(async () => {
    setLoading(true);
    const results: Partial<Record<MapLayerName, GeoJsonFeatureCollection>> = {};

    const promises = Array.from(activeLayers).map(async (layer) => {
      const result = await fetchMapLayer(layer);
      if (result.ok) {
        results[layer] = result.data;
      }
    });

    await Promise.all(promises);
    setLayerData(results);
    setLoading(false);
  }, [activeLayers]);

  useEffect(() => {
    loadLayers();
  }, [loadLayers]);

  const handleNearby = async () => {
    const loc = location ?? (await getCurrentLocation());
    if (!loc) {
      Alert.alert("Ubicación", "No se pudo obtener la ubicación actual.");
      return;
    }

    setLoading(true);
    const result = await fetchNearbyProducers(loc.longitude, loc.latitude, 10);
    setLoading(false);

    if (result.ok) {
      setLayerData((prev) => ({ ...prev, producers: result.data }));
      setActiveLayers((prev) => new Set([...prev, "producers"]));

      mapRef.current?.animateToRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    }
  };

  const goToMyLocation = async () => {
    const loc = location ?? (await getCurrentLocation());
    if (loc) {
      mapRef.current?.animateToRegion({
        latitude: loc.latitude,
        longitude: loc.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    }
  };

  const getMarkerTitle = (layer: MapLayerName, props: Record<string, unknown>): string => {
    switch (layer) {
      case "producers":
        return (props.nombre as string) ?? "Productor";
      case "offers":
        return (props.title as string) ?? "Oferta";
      case "canteens":
        return (props.nombre as string) ?? "Comedor";
      case "rescues":
        return (props.productName as string) ?? "Rescate";
      case "incidents":
        return (props.title as string) ?? "Incidente";
      case "demands":
        return (props.productName as string) ?? "Demanda";
      case "resources":
        return (props.nombre as string) ?? "Recurso";
    }
  };

  const getMarkerDescription = (layer: MapLayerName, props: Record<string, unknown>): string => {
    switch (layer) {
      case "producers":
        return `${props.tipo ?? ""} · ${props.status ?? ""}`;
      case "offers":
        return `${props.productName ?? ""} · ${props.quantityAvailable ?? ""} ${props.unit ?? ""}`;
      case "canteens":
        return `${props.tipo ?? ""} · Cap: ${props.capacidadDiaria ?? "N/A"}`;
      case "rescues":
        return `${props.quantity ?? ""} ${props.unit ?? ""} · ${props.status ?? ""}`;
      case "incidents":
        return `${props.category ?? ""} · ${props.severity ?? ""}`;
      case "demands":
        return `${props.quantityRequired ?? ""} ${props.unit ?? ""} · ${props.status ?? ""}`;
      case "resources":
        return `${props.tipo ?? ""} · ${props.estado ?? ""}${props.velocidad ? ` · ${props.velocidad} km/h` : ""}`;
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {Array.from(activeLayers).map((layer) => {
          const data = layerData[layer];
          if (!data) return null;

          return data.features.map((feature: GeoJsonFeature, index: number) => {
            const [lng, lat] = feature.geometry.coordinates;
            const props = feature.properties as Record<string, unknown>;

            return (
              <Marker
                key={`${layer}-${index}`}
                coordinate={{ latitude: lat, longitude: lng }}
                pinColor={LAYER_COLORS[layer]}
                tracksViewChanges={false}
              >
                <Callout>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>
                      {LAYER_ICONS[layer]} {getMarkerTitle(layer, props)}
                    </Text>
                    <Text style={styles.calloutDesc}>
                      {getMarkerDescription(layer, props)}
                    </Text>
                  </View>
                </Callout>
              </Marker>
            );
          });
        })}
      </MapView>

      {/* Floating controls */}
      <View style={styles.floatingControls}>
        <TouchableOpacity style={styles.fab} onPress={goToMyLocation}>
          <Text style={styles.fabIcon}>📍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={handleNearby}>
          <Text style={styles.fabIcon}>🔍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={loadLayers}>
          <Text style={styles.fabIcon}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Layer selector toggle */}
      <TouchableOpacity
        style={styles.layerToggle}
        onPress={() => setShowLayers(!showLayers)}
      >
        <Text style={styles.layerToggleText}>
          🗂️ Capas ({activeLayers.size})
        </Text>
      </TouchableOpacity>

      {/* Layer selector panel */}
      {showLayers && (
        <View style={styles.layerPanel}>
          <ScrollView>
            {MAP_LAYERS.map((layer) => {
              const active = activeLayers.has(layer);
              return (
                <TouchableOpacity
                  key={layer}
                  style={[styles.layerItem, active && styles.layerItemActive]}
                  onPress={() => toggleLayer(layer)}
                >
                  <View
                    style={[
                      styles.layerDot,
                      { backgroundColor: active ? LAYER_COLORS[layer] : "#ccc" },
                    ]}
                  />
                  <Text style={[styles.layerLabel, active && styles.layerLabelActive]}>
                    {LAYER_ICONS[layer]} {LAYER_LABELS[layer]}
                  </Text>
                  <Text style={styles.layerCount}>
                    {layerData[layer]?.features.length ?? "—"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#2E7D32" size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  floatingControls: {
    position: "absolute",
    right: 16,
    bottom: 100,
    gap: 10,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  fabIcon: { fontSize: 22 },
  layerToggle: {
    position: "absolute",
    top: 60,
    left: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  layerToggleText: { fontSize: 14, fontWeight: "600", color: "#333" },
  layerPanel: {
    position: "absolute",
    top: 110,
    left: 16,
    width: width * 0.6,
    maxHeight: 340,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  layerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  layerItemActive: {
    backgroundColor: "#E8F5E9",
  },
  layerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  layerLabel: {
    flex: 1,
    fontSize: 14,
    color: "#666",
  },
  layerLabelActive: {
    color: "#2E7D32",
    fontWeight: "600",
  },
  layerCount: {
    fontSize: 12,
    color: "#999",
    minWidth: 24,
    textAlign: "right",
  },
  callout: {
    padding: 8,
    maxWidth: 200,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  calloutDesc: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  loadingOverlay: {
    position: "absolute",
    top: 60,
    right: 16,
    backgroundColor: "#ffffffdd",
    borderRadius: 20,
    padding: 8,
  },
});
