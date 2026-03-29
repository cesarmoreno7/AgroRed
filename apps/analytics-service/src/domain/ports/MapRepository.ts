import type {
  GeoJsonFeatureCollection,
  GeoJsonPoint,
  GeoJsonMultiPolygon,
  MapProducerProperties,
  MapOfferProperties,
  MapCanteenProperties,
  MapRescueProperties,
  MapIncidentProperties,
  MapDemandProperties,
  MapResourceProperties,
  NearbyProducerProperties,
  HierarchyProperties,
  MapBboxFilter,
  NearbyQuery,
} from "../models/GeoTypes.js";

export type MapLayer =
  | "producers"
  | "offers"
  | "canteens"
  | "rescues"
  | "incidents"
  | "demands"
  | "resources";

export interface MapRepository {
  getProducers(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapProducerProperties>>;
  getOffers(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapOfferProperties>>;
  getCanteens(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapCanteenProperties>>;
  getRescues(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapRescueProperties>>;
  getIncidents(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapIncidentProperties>>;
  getDemands(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapDemandProperties>>;
  getResources(bbox?: MapBboxFilter): Promise<GeoJsonFeatureCollection<GeoJsonPoint, MapResourceProperties>>;
  getNearbyProducers(query: NearbyQuery): Promise<GeoJsonFeatureCollection<GeoJsonPoint, NearbyProducerProperties>>;
  getDepartamentos(): Promise<GeoJsonFeatureCollection<GeoJsonMultiPolygon, HierarchyProperties>>;
  getMunicipios(departamentoId?: number): Promise<GeoJsonFeatureCollection<GeoJsonMultiPolygon, HierarchyProperties>>;
}
