import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { UserRepository } from "../../domain/ports/UserRepository.js";
import { MODULE_ACCESS } from "../../domain/value-objects/UserRole";

export interface LoginUserCommand {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    tenantId: string;
    email: string;
    fullName: string;
    role: string;
  };
}

export class LoginUser {
  constructor(
    private readonly repository: UserRepository,
    private readonly jwtSecret: string,
    private readonly jwtExpiresIn: string
  ) {}

  async execute(command: LoginUserCommand): Promise<{ token: string; modules: string[] }> {
    const email = command.email.trim().toLowerCase();
    const user = await this.repository.findByEmail(email);

    if (!user || !(await bcrypt.compare(command.password, user.passwordHash))) {
      throw new Error("INVALID_CREDENTIALS");
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );

    const accessibleModules = Object.keys(MODULE_ACCESS).filter(module =>
      MODULE_ACCESS[module].includes(user.role)
    );

    return { token, modules: accessibleModules };
  }
}
