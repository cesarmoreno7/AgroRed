import { RegisterUser } from "./RegisterUser.js";
import { InMemoryUserRepository } from "../../infrastructure/repositories/InMemoryUserRepository.js";

describe("RegisterUser use-case", () => {
  let repository: InMemoryUserRepository;
  let useCase: RegisterUser;

  beforeEach(() => {
    repository = new InMemoryUserRepository();
    useCase = new RegisterUser(repository);
  });

  const validCommand = {
    tenantId: "t-1",
    email: "nuevo@example.com",
    fullName: "Nuevo Usuario",
    role: "producer" as const,
    password: "securePass123"
  };

  it("registers a new user successfully", async () => {
    const user = await useCase.execute(validCommand);

    expect(user.id).toBeDefined();
    expect(user.email).toBe("nuevo@example.com");
    expect(user.fullName).toBe("Nuevo Usuario");
    expect(user.role).toBe("producer");
    expect(user.tenantId).toBe("t-1");
    expect(user.passwordHash).not.toBe(validCommand.password);
    expect(user.passwordHash.startsWith("$2")).toBe(true);
  });

  it("saves the user to the repository", async () => {
    const user = await useCase.execute(validCommand);
    const found = await repository.findById(user.id);
    expect(found).not.toBeNull();
    expect(found!.email).toBe("nuevo@example.com");
  });

  it("normalizes email to lowercase", async () => {
    const user = await useCase.execute({ ...validCommand, email: "  UPPER@EXAMPLE.COM  " });
    expect(user.email).toBe("upper@example.com");
  });

  it("throws USER_EMAIL_ALREADY_EXISTS for duplicate email", async () => {
    await useCase.execute(validCommand);
    await expect(useCase.execute(validCommand)).rejects.toThrow("USER_EMAIL_ALREADY_EXISTS");
  });

  it("allows different emails for different users", async () => {
    await useCase.execute(validCommand);
    const second = await useCase.execute({ ...validCommand, email: "otro@example.com" });
    expect(second.email).toBe("otro@example.com");
  });
});
