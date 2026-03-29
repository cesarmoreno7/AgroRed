import type { MapRepository } from "../../domain/ports/MapRepository.js";
import type {
  GeoJsonFeatureCollection,
  GeoJsonPoint,
  NearbyProducerProperties,
  NearbyQuery,
} from "../../domain/models/GeoTypes.js";

export class GetNearbyProducers {
  constructor(private readonly repository: MapRepository) {}

  async execute(query: NearbyQuery): Promise<GeoJsonFeatureCollection<GeoJsonPoint, NearbyProducerProperties>> {
    return this.repository.getNearbyProducers(query);
  }
}
