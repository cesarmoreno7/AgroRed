import bcrypt from "bcrypt";
import { LoginUser } from "./LoginUser.js";
import { RegisterUser } from "./RegisterUser.js";
import { User } from "../../domain/entities/User.js";
import { InMemoryUserRepository } from "../../infrastructure/repositories/InMemoryUserRepository.js";

describe("LoginUser use-case", () => {
  let repository: InMemoryUserRepository;
  let loginUser: LoginUser;

  const jwtSecret = "test-secret-key-for-jest";
  const jwtExpiresIn = "1h";
  const password = "securePass123";

  beforeEach(async () => {
    repository = new InMemoryUserRepository();
    loginUser = new LoginUser(repository, jwtSecret, jwtExpiresIn);

    const registerUser = new RegisterUser(repository);
    await registerUser.execute({
      tenantId: "t-1",
      email: "alice@example.com",
      fullName: "Alice López",
      role: "PRODUCER",
      password
    });
  });

  it("returns a JWT token on valid credentials", async () => {
    const result = await loginUser.execute({ email: "alice@example.com", password });

    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe("string");
    expect(result.token.split(".")).toHaveLength(3);
  });

  it("returns accessible modules on successful login", async () => {
    const result = await loginUser.execute({ email: "alice@example.com", password });

    expect(result.modules).toBeDefined();
    expect(Array.isArray(result.modules)).toBe(true);
    expect(result.modules).toContain("producer-service");
  });

  it("throws INVALID_CREDENTIALS for unknown email", async () => {
    await expect(
      loginUser.execute({ email: "nobody@example.com", password })
    ).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("throws INVALID_CREDENTIALS for wrong password", async () => {
    await expect(
      loginUser.execute({ email: "alice@example.com", password: "wrongPassword" })
    ).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("normalizes email before lookup", async () => {
    const result = await loginUser.execute({ email: "  ALICE@EXAMPLE.COM  ", password });
    expect(result.token).toBeDefined();
    expect(result.modules).toContain("producer-service");
  });

  it("throws ACCESS_EXPIRED when the account expiry is in the past", async () => {
    await repository.save(
      new User({
        id: "u-expired",
        tenantId: "t-1",
        email: "demo.expired@agrored.co",
        fullName: "Demo Expirado",
        role: "PRODUCER",
        passwordHash: await bcrypt.hash(password, 10),
        expiresAt: new Date(Date.now() - 60_000)
      })
    );

    await expect(
      loginUser.execute({ email: "demo.expired@agrored.co", password })
    ).rejects.toThrow("ACCESS_EXPIRED");
  });

  it("allows login when the account expiry is still in the future", async () => {
    await repository.save(
      new User({
        id: "u-valid",
        tenantId: "t-1",
        email: "demo.valid@agrored.co",
        fullName: "Demo Vigente",
        role: "PRODUCER",
        passwordHash: await bcrypt.hash(password, 10),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      })
    );

    const result = await loginUser.execute({ email: "demo.valid@agrored.co", password });
    expect(result.token).toBeDefined();
  });
});
