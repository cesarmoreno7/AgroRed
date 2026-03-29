import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { User } from "../../domain/entities/User.js";
import type { UserRepository } from "../../domain/ports/UserRepository.js";
import type { UserRole } from "../../domain/value-objects/UserRole.js";

const SALT_ROUNDS = 10;

export interface RegisterUserCommand {
  tenantId: string;
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
}

export class RegisterUser {
  constructor(private readonly repository: UserRepository) {}

  async execute(command: RegisterUserCommand): Promise<User> {
    const email = command.email.trim().toLowerCase();
    const existingUser = await this.repository.findByEmail(email);

    if (existingUser) {
      throw new Error("USER_EMAIL_ALREADY_EXISTS");
    }

    const passwordHash = await bcrypt.hash(command.password, SALT_ROUNDS);

    const user = new User({
      id: randomUUID(),
      tenantId: command.tenantId,
      email,
      fullName: command.fullName,
      role: command.role,
      passwordHash
    });

    await this.repository.save(user);

    return user;
  }
}

