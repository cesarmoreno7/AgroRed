import { useState, useEffect, useRef, useCallback } from "react";
import * as Location from "expo-location";
import { GPS_CONFIG } from "../config/api";

export interface LocationState {
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  heading: number | null;
  timestamp: number;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== "granted") {
      setError("Se requiere permiso de ubicación para usar esta función.");
      return false;
    }

    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== "granted") {
      setError("Se recomienda el permiso de ubicación en segundo plano para seguimiento continuo.");
    }

    return true;
  }, []);

  const startTracking = useCallback(async () => {
    const granted = await requestPermissions();
    if (!granted) return;

    if (subscriptionRef.current) return;

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: GPS_CONFIG.intervalMs,
        distanceInterval: GPS_CONFIG.distanceIntervalMeters,
      },
      (loc) => {
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          speed: loc.coords.speed,
          accuracy: loc.coords.accuracy,
          heading: loc.coords.heading,
          timestamp: loc.timestamp,
        });
      },
    );

    subscriptionRef.current = sub;
    setTracking(true);
    setError(null);
  }, [requestPermissions]);

  const stopTracking = useCallback(() => {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setTracking(false);
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<LocationState | null> => {
    const granted = await requestPermissions();
    if (!granted) return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const state: LocationState = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      speed: loc.coords.speed,
      accuracy: loc.coords.accuracy,
      heading: loc.coords.heading,
      timestamp: loc.timestamp,
    };

    setLocation(state);
    return state;
  }, [requestPermissions]);

  useEffect(() => {
    return () => {
      subscriptionRef.current?.remove();
    };
  }, []);

  return {
    location,
    error,
    tracking,
    startTracking,
    stopTracking,
    getCurrentLocation,
  };
}
