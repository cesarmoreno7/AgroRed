import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface Props {
  isOnline: boolean;
  pendingCount: number;
}

export default function OfflineIndicator({ isOnline, pendingCount }: Props) {
  if (isOnline && pendingCount === 0) return null;

  return (
    <View style={[styles.container, isOnline ? styles.syncing : styles.offline]}>
      <Text style={styles.text}>
        {isOnline
          ? `Sincronizando ${pendingCount} puntos GPS...`
          : `Sin conexión · ${pendingCount} puntos pendientes`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  offline: { backgroundColor: "#F44336" },
  syncing: { backgroundColor: "#FF9800" },
  text: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
