import { randomUUID } from "node:crypto";
import { Institution } from "../../domain/entities/Institution.js";
import type { InstitutionRepository } from "../../domain/ports/InstitutionRepository.js";
import type { InstitutionType } from "../../domain/value-objects/InstitutionType.js";

export interface RegisterInstitutionInput {
  tenantId: string;
  institutionType: InstitutionType;
  name: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  municipalityName: string;
  address?: string | null;
  beneficiaryCount: number;
  productCategories: string[];
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  createdBy?: string | null;
}

export class RegisterInstitution {
  constructor(private readonly repository: InstitutionRepository) {}

  async execute(input: RegisterInstitutionInput): Promise<Institution> {
    const existing = await this.repository.findByName(input.tenantId, input.name);
    if (existing) throw new Error("INSTITUTION_ALREADY_EXISTS");

    const institution = new Institution({
      id: randomUUID(),
      status: "pending_verification",
      createdAt: new Date(),
      ...input
    });

    await this.repository.save(institution);
    return institution;
  }
}
