import { randomUUID } from "node:crypto";
import { __ENTITY_NAME__ } from "../../domain/entities/aggregate.template.js";
import type { __ENTITY_NAME__Repository } from "../../domain/ports/repository.template.js";

export interface Create__ENTITY_NAME__Command {
  tenantId: string;
  name: string;
}

export class Create__ENTITY_NAME__ {
  constructor(private readonly repository: __ENTITY_NAME__Repository) {}

  async execute(command: Create__ENTITY_NAME__Command): Promise<__ENTITY_NAME__> {
    const entity = new __ENTITY_NAME__(randomUUID(), command.tenantId, command.name);
    await this.repository.save(entity);
    return entity;
  }
}

