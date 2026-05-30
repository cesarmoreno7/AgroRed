import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { User } from "../domain/entities/User.js";
import { InMemoryUserRepository } from "../infrastructure/repositories/InMemoryUserRepository.js";

const SALT_ROUNDS = 10;

async function addTestUsers() {
  const repository = new InMemoryUserRepository();

  const testUsers = [
    {
      tenantId: "tenant1",
      email: "admin@example.com",
      fullName: "Admin User",
      role: "ADMIN" as const,
      password: "admin1234"
    },
    {
      tenantId: "tenant1",
      email: "user@example.com",
      fullName: "Regular User",
      role: "OPERATOR" as const,
      password: "user1234"
    },
    {
      tenantId: "tenant2",
      email: "manager@example.com",
      fullName: "Manager User",
      role: "TERRITORIAL_MANAGER" as const,
      password: "manager1234"
    }
  ];

  for (const user of testUsers) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

    const newUser = new User({
      id: randomUUID(),
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      passwordHash
    });

    await repository.save(newUser);
    console.log(`User ${user.email} added successfully.`);
  }
}

addTestUsers().catch((error) => {
  console.error("Error adding test users:", error);
});