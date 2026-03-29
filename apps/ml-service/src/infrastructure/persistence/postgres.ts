import { Pool } from "pg";
import type { AppEnv } from "../../config/env.js";
import { logError } from "../../shared/logger.js";

export function createPostgresPool(env: AppEnv): Pool {
  const pool = new Pool({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30_000
  });

  pool.on("error", (error: Error) => {
    logError("postgres.pool_error", { message: error.message });
  });

  return pool;
}

export async function checkPostgres(pool: Pool): Promise<void> {
  await pool.query("SELECT 1");
}