import express from "express";
import request from "supertest";
import type { Server } from "node:http";
import { buildApp } from "../../apps/api-gateway/src/app.js";
import { createUsersRouter } from "../../apps/user-service/src/interface/http/routes/users.js";
import { InMemoryUserRepository } from "../../apps/user-service/src/infrastructure/repositories/InMemoryUserRepository.js";

class FakeRedis {
  private readonly store = new Map<string, string>();

  async set(key: string, value: string): Promise<"OK"> {
    this.store.set(key, value);
    return "OK";
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  findFirstKeyByPrefix(prefix: string): string | null {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        return key;
      }
    }
    return null;
  }
}

describe("Gateway + UserService password recovery flow", () => {
  const gatewayJwtSecret = "test_secret_must_be_at_least_32_characters_long!!";
  const userJwtSecret = "user_service_test_secret_at_least_32!!";

  const repository = new InMemoryUserRepository();
  const fakeRedis = new FakeRedis();

  let userServiceServer: Server;
  let userServiceBaseUrl = "";

  beforeAll(async () => {
    const userApp = express();
    userApp.use(express.json());
    userApp.use(
      createUsersRouter({
        repository,
        redis: fakeRedis as any,
        jwtSecret: userJwtSecret,
        jwtExpiresIn: "1h",
        emailUser: "",
        emailPass: "",
        frontendUrl: "http://localhost:5173"
      })
    );

    await new Promise<void>((resolve) => {
      userServiceServer = userApp.listen(0, "127.0.0.1", () => {
        const address = userServiceServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Unable to resolve dynamic user-service port");
        }
        userServiceBaseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      userServiceServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  // Escrito para la arquitectura de microservicios (gateway proxy → USER_SERVICE_URL).
  // Desde la consolidación en monolito, buildApp() solo monta las rutas de negocio
  // (incluida /api/v1/users/*) cuando recibe un Pool real — ver el guard `if (pool)`
  // en apps/api-gateway/src/app.ts. Esta prueba no provee Pool, así que
  // /api/v1/users/register nunca se monta y el flujo 404 sin importar que
  // USER_SERVICE_URL apunte a un userApp real levantado aparte (ese valor ya solo
  // se usa como metadata descriptiva en /api/v1/catalog/services, no para proxy).
  // Requiere una Postgres real o mockeada para revivir esta prueba end-to-end.
  it.skip("recovers and resets password through gateway public routes", async () => {
    const app = await buildApp({
      NODE_ENV: "test",
      API_GATEWAY_PORT: 0,
      API_GATEWAY_CORS_ORIGIN: "*",
      JWT_SECRET: gatewayJwtSecret,
      USER_SERVICE_URL: userServiceBaseUrl,
      PRODUCER_SERVICE_URL: "http://127.0.0.1:39002",
      OFFER_SERVICE_URL: "http://127.0.0.1:39003",
      RESCUE_SERVICE_URL: "http://127.0.0.1:39004",
      DEMAND_SERVICE_URL: "http://127.0.0.1:39005",
      INVENTORY_SERVICE_URL: "http://127.0.0.1:39006",
      LOGISTICS_SERVICE_URL: "http://127.0.0.1:39007",
      INCIDENT_SERVICE_URL: "http://127.0.0.1:39008",
      ANALYTICS_SERVICE_URL: "http://127.0.0.1:39009",
      NOTIFICATION_SERVICE_URL: "http://127.0.0.1:39010",
      ML_SERVICE_URL: "http://127.0.0.1:39011",
      AUTOMATION_SERVICE_URL: "http://127.0.0.1:39012",
      AUCTION_SERVICE_URL: "http://127.0.0.1:39013",
      REDIS_URL: "redis://127.0.0.1:6379",
      POSTGRES_HOST: "127.0.0.1",
      POSTGRES_PORT: 5432,
      POSTGRES_DB: "agrored",
      POSTGRES_USER: "777",
      POSTGRES_PASSWORD: "777"
    });

    const email = "recover.flow@agrored.co";
    const oldPassword = "StrongOld1!";
    const newPassword = "NewStrong1!";

    const registerResponse = await request(app)
      .post("/api/v1/users/register")
      .send({
        tenantId: "tenant-test",
        email,
        fullName: "Recovery Flow User",
        role: "PRODUCER",
        password: oldPassword
      });

    expect(registerResponse.status).toBe(201);

    const recoverResponse = await request(app)
      .post("/api/v1/users/recover-password")
      .send({ email });

    expect(recoverResponse.status).toBe(200);
    expect(recoverResponse.body.success).toBe(true);

    const recoveryKey = fakeRedis.findFirstKeyByPrefix("pwd_recovery:");
    expect(recoveryKey).toBeTruthy();
    const token = recoveryKey!.replace("pwd_recovery:", "");

    const resetResponse = await request(app)
      .post("/api/v1/users/reset-password")
      .send({ token, newPassword });

    expect(resetResponse.status).toBe(200);
    expect(resetResponse.body.success).toBe(true);

    const oldLoginResponse = await request(app)
      .post("/api/v1/users/login")
      .send({ email, password: oldPassword });

    expect(oldLoginResponse.status).toBe(401);

    const newLoginResponse = await request(app)
      .post("/api/v1/users/login")
      .send({ email, password: newPassword });

    expect(newLoginResponse.status).toBe(200);
    expect(newLoginResponse.body.success).toBe(true);
    expect(typeof newLoginResponse.body.data.token).toBe("string");
  });

  it("returns 503 for recover and reset when Redis-backed recovery is unavailable", async () => {
    const userApp = express();
    userApp.use(express.json());
    userApp.use(
      createUsersRouter({
        repository,
        jwtSecret: userJwtSecret,
        jwtExpiresIn: "1h",
        emailUser: "",
        emailPass: "",
        frontendUrl: "http://localhost:5173"
      })
    );

    const recoverResponse = await request(userApp)
      .post("/api/v1/users/recover-password")
      .send({ email: "recover.flow@agrored.co" });

    expect(recoverResponse.status).toBe(503);
    expect(recoverResponse.body.success).toBe(false);
    expect(recoverResponse.body.error.code).toBe("PASSWORD_RECOVERY_TEMPORARILY_UNAVAILABLE");

    const resetResponse = await request(userApp)
      .post("/api/v1/users/reset-password")
      .send({ token: "some-token", newPassword: "NewStrong1!" });

    expect(resetResponse.status).toBe(503);
    expect(resetResponse.body.success).toBe(false);
    expect(resetResponse.body.error.code).toBe("PASSWORD_RECOVERY_TEMPORARILY_UNAVAILABLE");
  });
});
