import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().default("agrored"),
  POSTGRES_USER: z.string().default("777"),
  POSTGRES_PASSWORD: z.string().default("777"),
  JWT_SECRET: z.string().min(32).default("change_me_in_production_min_32_chars!!"),
  JWT_EXPIRES_IN: z.string().default("8h")
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
