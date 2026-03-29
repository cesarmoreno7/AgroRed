import { apiRequest } from "./api";
import { ENDPOINTS } from "../config/api";
import type {
  GeoJsonFeatureCollection,
  NearbyProducerProps,
} from "../types";
import type { MapLayerName } from "../config/api";

export async function fetchMapLayer(
  layer: MapLayerName,
  bbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number },
) {
  return apiRequest<GeoJsonFeatureCollection>(ENDPOINTS.mapLayer(layer), {
    params: bbox
      ? {
          minLng: bbox.minLng,
          minLat: bbox.minLat,
          maxLng: bbox.maxLng,
          maxLat: bbox.maxLat,
        }
      : undefined,
  });
}

export async function fetchNearbyProducers(lng: number, lat: number, radiusKm = 10) {
  return apiRequest<GeoJsonFeatureCollection<NearbyProducerProps>>(ENDPOINTS.nearbyProducers, {
    params: { lng, lat, radiusKm },
  });
}

export async function fetchDepartamentos() {
  return apiRequest(ENDPOINTS.hierarchyDepartamentos);
}

export async function fetchMunicipios(departamentoId?: number) {
  return apiRequest(ENDPOINTS.hierarchyMunicipios, {
    params: departamentoId ? { departamentoId } : undefined,
  });
}
