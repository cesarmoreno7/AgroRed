import { spawnSync } from "node:child_process";
import pg from "pg";
import { LoginUser } from "../../apps/user-service/src/application/use-cases/LoginUser.js";
import { PostgresUserRepository } from "../../apps/user-service/src/infrastructure/repositories/PostgresUserRepository.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "test_secret_key_at_least_32_characters_long!!";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "1h";

function runSeedExpandedWithMinimalVolume(): void {
  const result = spawnSync("npm exec tsx scripts/seed_expanded.ts", {
    shell: true,
    cwd: process.cwd(),
    env: {
      ...process.env,
      SEED_TENANTS: "1",
      USERS_PER_TENANT: "1",
      PRODUCERS_PER_TENANT: "1",
      OFFERS_PER_PRODUCER: "1",
      DEMANDS_PER_TENANT: "1",
      INVENTORY_ITEMS_PER_OFFER: "1",
      LOGISTICS_ORDERS_PER_DEMAND: "1",
      INCIDENCE_NOTIFICATIONS_FACTOR: "1"
    },
    encoding: "utf-8"
  });

  if (result.status !== 0) {
    const spawnError = result.error ? `spawnError=${result.error.message}` : "spawnError=none";
    throw new Error(
      `seed_expanded execution failed (exit=${result.status}): ${spawnError}\n${result.stdout}\n${result.stderr}`
    );
  }
}

describe("Seed expanded integrity: seeded user can login", () => {
  jest.setTimeout(120000);

  it("executes seed_expanded and authenticates a seeded user with real Postgres repository", async () => {
    runSeedExpandedWithMinimalVolume();

    const pool = new pg.Pool({
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      database: process.env.POSTGRES_DB ?? "agrored",
      user: process.env.POSTGRES_USER ?? "777",
      password: process.env.POSTGRES_PASSWORD ?? "777",
      connectionString: process.env.DATABASE_URL
    });

    try {
      const repository = new PostgresUserRepository(pool);
      const loginUser = new LoginUser(repository, JWT_SECRET, JWT_EXPIRES_IN);

      const result = await loginUser.execute({
        email: "seed.bogota.1@agrored.co",
        password: "Seed@BOGOTA1!"
      });

      expect(result.user.email).toBe("seed.bogota.1@agrored.co");
      expect(result.user.id).toBeDefined();
      expect(result.token.split(".")).toHaveLength(3);
    } finally {
      await pool.end();
    }
  });
});
