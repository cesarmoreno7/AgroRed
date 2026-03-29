import type { User } from "../../domain/entities/User.js";
import type { UserRepository, PaginationParams, PaginatedResult } from "../../domain/ports/UserRepository.js";

export class InMemoryUserRepository implements UserRepository {
  private readonly usersById = new Map<string, User>();
  private readonly usersByEmail = new Map<string, User>();

  async save(user: User): Promise<void> {
    this.usersById.set(user.id, user);
    this.usersByEmail.set(user.email, user);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersById.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersByEmail.get(email.trim().toLowerCase()) ?? null;
  }

  async list(params: PaginationParams): Promise<PaginatedResult<User>> {
    const all = Array.from(this.usersById.values());
    const start = (params.page - 1) * params.limit;
    return {
      data: all.slice(start, start + params.limit),
      total: all.length,
      page: params.page,
      limit: params.limit
    };
  }
}

