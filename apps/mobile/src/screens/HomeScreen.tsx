import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { fetchActiveResources } from "../services/tracking.service";
import { fetchAnalyticsSummary } from "../services/analytics.service";
import type { CurrentPosition, AnalyticsSummary } from "../types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../types";

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

export default function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [activeResources, setActiveResources] = useState<CurrentPosition[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const [resResult, summaryResult] = await Promise.all([
      fetchActiveResources(user?.tenantId),
      fetchAnalyticsSummary(user?.tenantId),
    ]);
    if (resResult.ok) {
      setActiveResources(Array.isArray(resResult.data) ? resResult.data : []);
    }
    if (summaryResult.ok) {
      setSummary(summaryResult.data);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Hola, {user?.fullName ?? "Usuario"}</Text>
        <Text style={styles.role}>{user?.role ?? ""}</Text>
        {summary?.tenantName && (
          <Text style={styles.tenant}>{summary.tenantName}</Text>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* KPI Cards */}
          <Text style={styles.sectionTitle}>Resumen operativo</Text>
          <View style={styles.kpiGrid}>
            <KpiCard value={summary?.totals.producers ?? 0} label="Productores" icon="🌾" color="#4CAF50" />
            <KpiCard value={summary?.totals.offers ?? 0} label="Ofertas" icon="📦" color="#FF9800" />
            <KpiCard value={summary?.operations.openDemands ?? 0} label="Demandas abiertas" icon="🍽️" color="#2196F3" />
            <KpiCard value={summary?.operations.scheduledRescues ?? 0} label="Rescates prog." icon="♻️" color="#9C27B0" />
            <KpiCard value={summary?.operations.availableInventoryUnits ?? 0} label="Inv. disponible" icon="📊" color="#00BCD4" />
            <KpiCard value={activeResources.length} label="En ruta" icon="🚚" color="#E91E63" />
            <KpiCard value={summary?.operations.openIncidents ?? 0} label="Incidentes" icon="⚠️" color="#F44336" />
            <KpiCard value={summary?.operations.scheduledLogistics ?? 0} label="Logística prog." icon="📍" color="#795548" />
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Acciones rápidas</Text>
          <View style={styles.actionsGrid}>
            <QuickAction icon="🗺️" label="Ver mapa" color="#4CAF50" onPress={() => navigation.navigate("Main" as never)} />
            <QuickAction icon="📍" label="Iniciar tracking" color="#2196F3" onPress={() => navigation.navigate("Main" as never)} />
            <QuickAction icon="🚚" label="Entregas" color="#FF9800" onPress={() => navigation.navigate("Main" as never)} />
            <QuickAction icon="👤" label="Perfil" color="#9C27B0" onPress={() => navigation.navigate("Main" as never)} />
          </View>

          {/* Active Resources */}
          {activeResources.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recursos en ruta</Text>
              {activeResources.map((r) => (
                <View key={r.recursoId} style={styles.resourceCard}>
                  <View style={styles.resourceInfo}>
                    <Text style={styles.resourceName}>{r.nombre}</Text>
                    <Text style={styles.resourceMeta}>
                      {r.tipo} · {r.evento}
                      {r.velocidad ? ` · ${r.velocidad.toFixed(0)} km/h` : ""}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: "#4CAF50" }]}>
                    <Text style={styles.statusText}>{r.estado}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Totals footer */}
          {summary && (
            <>
              <Text style={styles.sectionTitle}>Totales del sistema</Text>
              <View style={styles.totalsCard}>
                <TotalRow label="Usuarios" value={summary.totals.users} />
                <TotalRow label="Productores" value={summary.totals.producers} />
                <TotalRow label="Ofertas" value={summary.totals.offers} />
                <TotalRow label="Rescates" value={summary.totals.rescues} />
                <TotalRow label="Demandas" value={summary.totals.demands} />
                <TotalRow label="Inventario" value={summary.totals.inventoryItems} />
                <TotalRow label="Logística" value={summary.totals.logisticsOrders} />
                <TotalRow label="Incidentes" value={summary.totals.incidents} />
                <TotalRow label="Notificaciones" value={summary.totals.notifications} />
              </View>
              <Text style={styles.footerText}>
                Actualizado: {new Date(summary.generatedAt).toLocaleTimeString()}
              </Text>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function KpiCard({
  value,
  label,
  icon,
  color,
}: {
  value: number;
  label: string;
  icon: string;
  color: string;
}) {
  return (
    <View style={[styles.kpiCard, { borderLeftColor: color }]}>
      <Text style={styles.kpiIcon}>{icon}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{value}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.actionIcon, { backgroundColor: color + "22" }]}>
        <Text style={styles.actionEmoji}>{icon}</Text>
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  header: {
    backgroundColor: "#2E7D32",
    padding: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: { fontSize: 22, fontWeight: "700", color: "#fff" },
  role: { fontSize: 14, color: "#C8E6C9", marginTop: 4, textTransform: "capitalize" },
  tenant: { fontSize: 12, color: "#A5D6A7", marginTop: 2 },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
  },
  kpiCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiIcon: { fontSize: 20, marginBottom: 4 },
  kpiValue: { fontSize: 26, fontWeight: "700", color: "#1a1a1a" },
  kpiLabel: { fontSize: 11, color: "#888", marginTop: 2 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
  },
  actionCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionEmoji: { fontSize: 24 },
  actionLabel: { fontSize: 13, fontWeight: "600", color: "#333" },
  resourceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  resourceInfo: { flex: 1 },
  resourceName: { fontSize: 15, fontWeight: "600", color: "#333" },
  resourceMeta: { fontSize: 12, color: "#888", marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 11, fontWeight: "600", color: "#fff" },
  totalsCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  totalLabel: { fontSize: 14, color: "#555" },
  totalValue: { fontSize: 14, fontWeight: "600", color: "#1a1a1a" },
  footerText: {
    fontSize: 11,
    color: "#aaa",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
});
