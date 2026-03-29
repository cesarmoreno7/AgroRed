import type { __ENTITY_NAME__ } from "../entities/aggregate.template.js";

export interface __ENTITY_NAME__Repository {
  save(entity: __ENTITY_NAME__): Promise<void>;
  findById(id: string): Promise<__ENTITY_NAME__ | null>;
}

