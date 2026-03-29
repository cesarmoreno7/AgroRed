import { useState, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sendBatchPositions } from "../services/tracking.service";
import { GPS_CONFIG } from "../config/api";
import type { TrackingPointData } from "../types";

const BUFFER_KEY = "agrored_gps_buffer";

export function useOfflineBuffer() {
  const [bufferCount, setBufferCount] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addToBuffer = useCallback(async (point: TrackingPointData) => {
    const raw = await AsyncStorage.getItem(BUFFER_KEY);
    const buffer: TrackingPointData[] = raw ? JSON.parse(raw) : [];
    buffer.push(point);

    if (buffer.length >= GPS_CONFIG.batchSize) {
      await flushBuffer(buffer);
    } else {
      await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(buffer));
      setBufferCount(buffer.length);
    }
  }, []);

  const flushBuffer = useCallback(async (preloaded?: TrackingPointData[]) => {
    setIsFlushing(true);
    try {
      const raw = preloaded ?? JSON.parse((await AsyncStorage.getItem(BUFFER_KEY)) ?? "[]");
      const buffer: TrackingPointData[] = Array.isArray(raw) ? raw : [];

      if (buffer.length === 0) {
        setIsFlushing(false);
        return;
      }

      const result = await sendBatchPositions(buffer);
      if (result.ok) {
        await AsyncStorage.removeItem(BUFFER_KEY);
        setBufferCount(0);
      }
    } catch {
      // Keep buffer for next attempt
    } finally {
      setIsFlushing(false);
    }
  }, []);

  const startAutoFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setInterval(() => {
      flushBuffer();
    }, GPS_CONFIG.offlineFlushIntervalMs);
  }, [flushBuffer]);

  const stopAutoFlush = useCallback(() => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const getBufferSize = useCallback(async () => {
    const raw = await AsyncStorage.getItem(BUFFER_KEY);
    const count = raw ? (JSON.parse(raw) as unknown[]).length : 0;
    setBufferCount(count);
    return count;
  }, []);

  return {
    bufferCount,
    isFlushing,
    addToBuffer,
    flushBuffer,
    startAutoFlush,
    stopAutoFlush,
    getBufferSize,
  };
}
