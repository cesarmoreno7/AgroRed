import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_GATEWAY_PORT: z.coerce.number().int().positive().default(8080),
  API_GATEWAY_CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(32).default("change_me_in_production_min_32_chars!!"),
  USER_SERVICE_URL: z.string().url().default("http://localhost:3001"),
  PRODUCER_SERVICE_URL: z.string().url().default("http://localhost:3002"),
  OFFER_SERVICE_URL: z.string().url().default("http://localhost:3003"),
  RESCUE_SERVICE_URL: z.string().url().default("http://localhost:3004"),
  DEMAND_SERVICE_URL: z.string().url().default("http://localhost:3005"),
  INVENTORY_SERVICE_URL: z.string().url().default("http://localhost:3006"),
  LOGISTICS_SERVICE_URL: z.string().url().default("http://localhost:3007"),
  INCIDENT_SERVICE_URL: z.string().url().default("http://localhost:3008"),
  ANALYTICS_SERVICE_URL: z.string().url().default("http://localhost:3009"),
  NOTIFICATION_SERVICE_URL: z.string().url().default("http://localhost:3010"),
  ML_SERVICE_URL: z.string().url().default("http://localhost:3011"),
  AUTOMATION_SERVICE_URL: z.string().url().default("http://localhost:3012"),
  AUCTION_SERVICE_URL: z.string().url().default("http://localhost:3013"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().default("agrored"),
  POSTGRES_USER: z.string().default("777"),
  POSTGRES_PASSWORD: z.string().default("777")
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const env = parsed.data;

  if (env.NODE_ENV === "production") {
    if (env.JWT_SECRET.includes("change_me")) {
      throw new Error("JWT_SECRET must be changed for production.");
    }
    if (env.POSTGRES_PASSWORD === "777") {
      throw new Error("POSTGRES_PASSWORD must be changed for production.");
    }
  }

  return env;
}

