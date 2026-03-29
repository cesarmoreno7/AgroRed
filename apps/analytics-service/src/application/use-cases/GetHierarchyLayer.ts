import type { MapRepository } from "../../domain/ports/MapRepository.js";
import type {
  GeoJsonFeatureCollection,
  GeoJsonMultiPolygon,
  HierarchyProperties,
} from "../../domain/models/GeoTypes.js";

export class GetHierarchyLayer {
  constructor(private readonly repository: MapRepository) {}

  async departamentos(): Promise<GeoJsonFeatureCollection<GeoJsonMultiPolygon, HierarchyProperties>> {
    return this.repository.getDepartamentos();
  }

  async municipios(departamentoId?: number): Promise<GeoJsonFeatureCollection<GeoJsonMultiPolygon, HierarchyProperties>> {
    return this.repository.getMunicipios(departamentoId);
  }
}
