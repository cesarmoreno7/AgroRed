import type { MapRepository, MapLayer } from "../../domain/ports/MapRepository.js";
import type {
  GeoJsonFeatureCollection,
  GeoJsonPoint,
  MapProducerProperties,
  MapOfferProperties,
  MapCanteenProperties,
  MapRescueProperties,
  MapIncidentProperties,
  MapDemandProperties,
  MapResourceProperties,
  MapBboxFilter,
} from "../../domain/models/GeoTypes.js";

type LayerResult =
  | GeoJsonFeatureCollection<GeoJsonPoint, MapProducerProperties>
  | GeoJsonFeatureCollection<GeoJsonPoint, MapOfferProperties>
  | GeoJsonFeatureCollection<GeoJsonPoint, MapCanteenProperties>
  | GeoJsonFeatureCollection<GeoJsonPoint, MapRescueProperties>
  | GeoJsonFeatureCollection<GeoJsonPoint, MapIncidentProperties>
  | GeoJsonFeatureCollection<GeoJsonPoint, MapDemandProperties>
  | GeoJsonFeatureCollection<GeoJsonPoint, MapResourceProperties>;

export class GetMapLayer {
  constructor(private readonly repository: MapRepository) {}

  async execute(layer: MapLayer, bbox?: MapBboxFilter): Promise<LayerResult> {
    switch (layer) {
      case "producers":
        return this.repository.getProducers(bbox);
      case "offers":
        return this.repository.getOffers(bbox);
      case "canteens":
        return this.repository.getCanteens(bbox);
      case "rescues":
        return this.repository.getRescues(bbox);
      case "incidents":
        return this.repository.getIncidents(bbox);
      case "demands":
        return this.repository.getDemands(bbox);
      case "resources":
        return this.repository.getResources(bbox);
    }
  }
}
