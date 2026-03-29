import { LoginUser } from "./LoginUser.js";
import { RegisterUser } from "./RegisterUser.js";
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
});
