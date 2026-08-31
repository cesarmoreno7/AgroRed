/**
 * Crea/actualiza UN acceso integral de demostración que cubre el alcance de:
 *   - Secretaría de Desarrollo Económico / Agricultura
 *   - Secretaría de Planeación
 *   - Operador PAE — Coordinación de Calidad / Interventoría
 *   - Operador PAE — Gerencia / Representante Legal
 *
 * Los cuatro usan el mismo perfil (territorial_analyst = "Analista Territorial"),
 * así que un solo usuario con ese rol tiene el alcance combinado. Vive en el
 * tenant DEMO, con vigencia de 30 días.  NO rota las claves de los demás demo.
 *
 * Uso:  npx tsx scripts/seed_demo_integral.ts
 * Env:  DEMO_INTEGRAL_PASSWORD (default: Demo-Integral-2026!), DEMO_ACCESS_DAYS (30)
 */

import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";

const host = process.env.POSTGRES_HOST ?? "localhost";
const isRemote =
  Boolean(process.env.DATABASE_URL) || process.env.NODE_ENV === "production" || host.includes("neon.tech");

const pool = new pg.Pool({
  host,
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? "agrored",
  user: process.env.POSTGRES_USER ?? "777",
  password: process.env.POSTGRES_PASSWORD ?? "777",
  connectionString: process.env.DATABASE_URL,
  ssl: isRemote ? { rejectUnauthorized: false } : false
});

const EMAIL = "demo.integral@agrored.co";
const PASSWORD = process.env.DEMO_INTEGRAL_PASSWORD ?? "Demo-Integral-2026!";
const DAYS = Number(process.env.DEMO_ACCESS_DAYS ?? "30");
const TENANT_CODE = (process.env.DEMO_TENANT_CODE ?? "DEMO").toUpperCase();

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    const t = await client.query<{ id: string }>(`SELECT id FROM public.tenants WHERE code = $1`, [TENANT_CODE]);
    if (!t.rows[0]) {
      throw new Error(`No existe el tenant ${TENANT_CODE}. Corre antes: npm run seed:demo`);
    }
    const tenantId = t.rows[0].id;
    const hash = await bcrypt.hash(PASSWORD, Number(process.env.BCRYPT_SALT_ROUNDS ?? "10"));

    const hasExpires = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='users' AND column_name='expires_at') AS exists`
    );

    if (hasExpires.rows[0]?.exists) {
      await client.query(
        `INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, expires_at, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'territorial_analyst', 'active', $4, NOW() + ($5 || ' days')::interval, NOW())
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash, role = 'territorial_analyst', status = 'active',
               tenant_id = EXCLUDED.tenant_id, full_name = EXCLUDED.full_name,
               expires_at = NOW() + ($5 || ' days')::interval, deleted_at = NULL, updated_at = NOW()`,
        [tenantId, EMAIL, "DEMO_ Acceso integral (4 actores del guion)", hash, String(DAYS)]
      );
    } else {
      await client.query(
        `INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'territorial_analyst', 'active', $4, NOW())
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash, role = 'territorial_analyst', status = 'active',
               tenant_id = EXCLUDED.tenant_id, full_name = EXCLUDED.full_name, deleted_at = NULL, updated_at = NOW()`,
        [tenantId, EMAIL, "DEMO_ Acceso integral (4 actores del guion)", hash]
      );
    }

    const row = await client.query(
      `SELECT email, role, to_char(expires_at,'YYYY-MM-DD') AS expira FROM public.users WHERE email = $1`,
      [EMAIL]
    );
    console.log("\n================  ACCESO INTEGRAL DE DEMOSTRACION  ================");
    console.log("URL:      https://web-dashboard-production-c9b4.up.railway.app");
    console.log(`Usuario:  ${EMAIL}`);
    console.log(`Clave:    ${PASSWORD}`);
    console.log(`Perfil:   Analista Territorial (territorial_analyst) - solo consulta`);
    console.log(`Tenant:   ${TENANT_CODE}`);
    console.log(`Vigencia: ${row.rows[0]?.expira ?? `${DAYS} dias`}`);
    console.log("Alcance:  Desarrollo Economico + Planeacion + Operador PAE Calidad + Operador PAE Gerencia");
    console.log("==================================================================\n");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("seed_demo_integral failed:", e);
  process.exit(1);
});
