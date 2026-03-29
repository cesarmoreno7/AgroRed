import type { MatchableDemand } from "../entities/MatchableDemand.js";

/**
 * Puerto de consulta para buscar demandas abiertas compatibles con una oferta.
 * Este puerto se implementa consultando directamente la tabla de demandas en PostgreSQL.
 *
 * Estrategia de búsqueda en dos fases:
 * 1. Buscar primero en el municipio de la oferta (local).
 * 2. Si no hay resultados, expandir a otros municipios (regional).
 */
export interface DemandQueryPort {
  /** Busca demandas abiertas por categoría en un municipio específico. */
  findOpenDemandsByCategory(tenantId: string, category: string, municipalityName?: string): Promise<MatchableDemand[]>;
}
