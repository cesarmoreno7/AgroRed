/**
 * Migration runner — executes all SQL files in infra/postgres in numeric order.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts
 *   npx tsx scripts/migrate.ts --dry-run   (list files without executing)
 *
 * Requires DATABASE_URL or individual POSTGRES_* env vars.
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const MIGRATIONS_DIRS = [
  join(ROOT, "infra", "postgres", "init"),
  join(ROOT, "infra", "postgres")
];
const MIGRATION_TABLE = "schema_migrations";

const DRY_RUN = process.argv.includes("--dry-run");

async function getSortedSqlFiles(dir: string): Promise<string[]> {
  let files: string[] = [];
  try {
    const entries = await readdir(dir);
    files = entries
      .filter((f) => f.endsWith(".sql") && /^\d+/.test(f))
      .sort()
      .map((f) => join(dir, f));
  } catch {
    // Directory may not exist — skip
  }
  return files;
}

async function run(): Promise<void> {
  const host = process.env.POSTGRES_HOST ?? "localhost";
  const isRemote =
    Boolean(process.env.DATABASE_URL) ||
    process.env.NODE_ENV === "production" ||
    host.includes("neon.tech");
  const pool = new pg.Pool({
    host,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? "agrored",
    user: process.env.POSTGRES_USER ?? "777",
    password: process.env.POSTGRES_PASSWORD ?? "777",
    connectionString: process.env.DATABASE_URL,
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();

  try {
    // Ensure tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
        id         SERIAL PRIMARY KEY,
        filename   TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Collect applied migrations
    const { rows } = await client.query<{ filename: string }>(
      `SELECT filename FROM ${MIGRATION_TABLE} ORDER BY id`
    );
    const applied = new Set(rows.map((r) => r.filename));

    // Gather all SQL files in order
    const allFiles: string[] = [];
    for (const dir of MIGRATIONS_DIRS) {
      allFiles.push(...(await getSortedSqlFiles(dir)));
    }

    // Deduplicate by basename (init/ files first, then outer files)
    const seen = new Set<string>();
    const toRun: string[] = [];
    for (const filePath of allFiles) {
      const basename = filePath.split(/[\\/]/).pop()!;
      if (!seen.has(basename) && !applied.has(basename)) {
        seen.add(basename);
        toRun.push(filePath);
      }
    }

    if (toRun.length === 0) {
      console.log("✓ All migrations are up to date.");
      return;
    }

    console.log(`Found ${toRun.length} pending migration(s):\n`);

    for (const filePath of toRun) {
      const basename = filePath.split(/[\\/]/).pop()!;
      console.log(`  → ${basename}`);

      if (DRY_RUN) continue;

      const sql = await readFile(filePath, "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO ${MIGRATION_TABLE} (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
          [basename]
        );
        await client.query("COMMIT");
        console.log(`    ✓ Applied`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`    ✗ Failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    }

    if (DRY_RUN) {
      console.log("\n[dry-run] No changes made.");
    } else {
      console.log("\n✓ All migrations applied successfully.");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
