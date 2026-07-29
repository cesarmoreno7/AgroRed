import type { Producer } from "../../domain/entities/Producer.js";
import type {
  ProducerRepository,
  PaginationParams,
  PaginatedResult,
  ProducerStats
} from "../../domain/ports/ProducerRepository.js";

function buildKey(tenantId: string, organizationName: string): string {
  return `${tenantId}::${organizationName.trim().toLowerCase()}`;
}

export class InMemoryProducerRepository implements ProducerRepository {
  private readonly producersById = new Map<string, Producer>();
  private readonly producersByOrganization = new Map<string, Producer>();

  async save(producer: Producer): Promise<void> {
    this.producersById.set(producer.id, producer);
    this.producersByOrganization.set(
      buildKey(producer.tenantId, producer.organizationName),
      producer
    );
  }

  async saveBatch(producers: Producer[]): Promise<void> {
    for (const p of producers) {
      this.producersById.set(p.id, p);
      this.producersByOrganization.set(buildKey(p.tenantId, p.organizationName), p);
    }
  }

  async update(producer: Producer): Promise<void> {
    const existing = this.producersById.get(producer.id);
    if (existing) {
      this.producersByOrganization.delete(buildKey(existing.tenantId, existing.organizationName));
    }
    this.producersById.set(producer.id, producer);
    this.producersByOrganization.set(buildKey(producer.tenantId, producer.organizationName), producer);
  }

  async softDelete(id: string): Promise<boolean> {
    const producer = this.producersById.get(id);
    if (!producer) return false;
    this.producersById.delete(id);
    this.producersByOrganization.delete(buildKey(producer.tenantId, producer.organizationName));
    return true;
  }

  async findById(id: string): Promise<Producer | null> {
    return this.producersById.get(id) ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<Producer>> {
    const all = Array.from(this.producersById.values());
    const start = (params.page - 1) * params.limit;
    return {
      data: all.slice(start, start + params.limit),
      total: all.length,
      page: params.page,
      limit: params.limit
    };
  }

  async findByOrganizationName(
    tenantId: string,
    organizationName: string
  ): Promise<Producer | null> {
    return this.producersByOrganization.get(buildKey(tenantId, organizationName)) ?? null;
  }

  async findByUserId(userId: string): Promise<Producer | null> {
    for (const producer of this.producersById.values()) {
      if (producer.userId === userId) return producer;
    }
    return null;
  }

  async findStats(producerId: string): Promise<ProducerStats | null> {
    const producer = this.producersById.get(producerId);
    if (!producer) return null;
    return {
      producer,
      totalOffers: 0,
      activeOffers: 0,
      totalRescues: 0,
      totalKgRescued: 0,
      lastActivityAt: null,
      historicalProduction: []
    };
  }
}
