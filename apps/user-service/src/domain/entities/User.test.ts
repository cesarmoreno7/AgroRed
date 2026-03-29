import { User } from "./User.js";

describe("User entity", () => {
  const baseProps = {
    id: "u-1",
    tenantId: "t-1",
    email: "  ALICE@Example.COM  ",
    fullName: "  Alice López  ",
    role: "producer" as const,
    passwordHash: "$2b$10$hashedvalue"
  };

  it("normalizes email to lowercase and trims whitespace", () => {
    const user = new User(baseProps);
    expect(user.email).toBe("alice@example.com");
  });

  it("trims fullName whitespace", () => {
    const user = new User(baseProps);
    expect(user.fullName).toBe("Alice López");
  });

  it("assigns a default createdAt when not provided", () => {
    const before = new Date();
    const user = new User(baseProps);
    expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("preserves an explicit createdAt", () => {
    const fixed = new Date("2025-01-01T00:00:00Z");
    const user = new User({ ...baseProps, createdAt: fixed });
    expect(user.createdAt).toBe(fixed);
  });

  it("stores all provided properties", () => {
    const user = new User(baseProps);
    expect(user.id).toBe("u-1");
    expect(user.tenantId).toBe("t-1");
    expect(user.role).toBe("producer");
    expect(user.passwordHash).toBe("$2b$10$hashedvalue");
  });
});
