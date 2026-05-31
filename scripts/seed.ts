/**
 * Seed script — populates AgroRed with development/test data.
 * Requires a running PostgreSQL with the schema already applied (npm run migrate).
 *
 * Usage:  npx tsx scripts/seed.ts
 */

import pg from "pg";
import bcrypt from "bcrypt";

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? "agrored",
  user: process.env.POSTGRES_USER ?? "777",
  password: process.env.POSTGRES_PASSWORD ?? "777",
  connectionString: process.env.DATABASE_URL
});

// Fixed UUIDs for idempotent seeding
const TENANT_ID   = "10000000-0000-0000-0000-000000000001";
const PRODUCER_ID = "20000000-0000-0000-0000-000000000001";
const OFFER_ID    = "30000000-0000-0000-0000-000000000001";
const DEMAND_ID   = "40000000-0000-0000-0000-000000000001";

// Antioquia tenants
const TENANT_RIONEGRO_ID     = "10000000-0000-0000-0000-000000000002";
const TENANT_SANTAROSA_ID    = "10000000-0000-0000-0000-000000000003";
const TENANT_SANROQUE_ID     = "10000000-0000-0000-0000-000000000004";

const SALT = 10;

async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log("Seeding AgroRed development data...\n");

    // ── Tenant ──────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO public.tenants (id, name, code, type, status)
      VALUES ($1, 'Bogotá D.C.', 'BOGOTA', 'municipio', 'active')
      ON CONFLICT (id) DO NOTHING
    `, [TENANT_ID]);
    console.log("✓ Tenant: Bogotá D.C.");

    // ── Users ────────────────────────────────────────────────────────────
    const users = [
      { id: "50000000-0000-0000-0000-000000000001", email: "admin@agrored.co",      fullName: "Admin Municipal",       role: "admin_municipal",     password: "Admin@1234!" },
      { id: "50000000-0000-0000-0000-000000000002", email: "productor@agrored.co",  fullName: "Carlos Productor",      role: "producer",            password: "Prod@1234!" },
      { id: "50000000-0000-0000-0000-000000000003", email: "operador@agrored.co",   fullName: "Logística Operacional", role: "logistics_operator",  password: "Oper@1234!" },
      { id: "50000000-0000-0000-0000-000000000004", email: "analista@agrored.co",   fullName: "Ana Territorial",       role: "territorial_analyst", password: "Ana@1234!" },
      { id: "50000000-0000-0000-0000-000000000005", email: "cocina@agrored.co",     fullName: "Cocina Comunitaria 1",  role: "community_kitchen",   password: "Cocina@1234!" },
    ];

    for (const u of users) {
      const hash = await bcrypt.hash(u.password, SALT);
      await client.query(`
        INSERT INTO public.users (id, tenant_id, email, full_name, role, password_hash, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
      `, [u.id, TENANT_ID, u.email, u.fullName, u.role, hash]);
      console.log(`✓ Usuario: ${u.email} (${u.role}) — password: ${u.password}`);
    }

    // ── Producer ─────────────────────────────────────────────────────────
    // Bogotá: Plaza de Mercado de Paloquemao area (lat/lng reales)
    await client.query(`
      INSERT INTO public.producers (
        id, tenant_id, user_id,
        producer_type, organization_name, contact_name, contact_phone,
        municipality_name, zone_type, product_categories,
        status, latitude, longitude, created_at
      ) VALUES (
        $1, $2, $3,
        'individual', 'Finca San Carlos', 'Carlos Productor', '3001234567',
        'Bogotá D.C.', 'rural', ARRAY['tuberculo','hortaliza'],
        'active', 4.6512, -74.0836, NOW()
      ) ON CONFLICT (id) DO UPDATE SET latitude = 4.6512, longitude = -74.0836
    `, [PRODUCER_ID, TENANT_ID, "50000000-0000-0000-0000-000000000002"]);
    console.log("✓ Productor: Finca San Carlos (Bogotá D.C.) lat=4.6512 lng=-74.0836");

    // ── estadisticas_productor — historical production ────────────────────
    type StatRow = [string, string, string, number, number, number, number, string];
    const statRows: StatRow[] = [
      // [id, producer_id, tenant_id, cultivo, temporada, hectareas, toneladas, ingresos, costos, fecha_corte]
      ["60000000-0000-0000-0000-000000000001", PRODUCER_ID, TENANT_ID, "Papa criolla",  "2023-A", 5.0, 12.5, 10000000, 4500000, "2023-06-30"],
      ["60000000-0000-0000-0000-000000000002", PRODUCER_ID, TENANT_ID, "Lechuga",       "2023-A", 2.0,  8.0,  6400000, 2800000, "2023-06-30"],
      ["60000000-0000-0000-0000-000000000003", PRODUCER_ID, TENANT_ID, "Zanahoria",     "2023-A", 1.5,  6.2,  4960000, 1900000, "2023-06-30"],
      ["60000000-0000-0000-0000-000000000004", PRODUCER_ID, TENANT_ID, "Papa criolla",  "2023-B", 5.5, 14.1, 11280000, 4900000, "2023-12-15"],
      ["60000000-0000-0000-0000-000000000005", PRODUCER_ID, TENANT_ID, "Lechuga",       "2023-B", 2.2,  9.3,  7440000, 3100000, "2023-12-15"],
      ["60000000-0000-0000-0000-000000000006", PRODUCER_ID, TENANT_ID, "Zanahoria",     "2024-A", 2.0,  8.7,  6960000, 2600000, "2024-06-28"],
      ["60000000-0000-0000-0000-000000000007", PRODUCER_ID, TENANT_ID, "Papa criolla",  "2024-A", 6.0, 15.8, 12640000, 5300000, "2024-06-28"],
      ["60000000-0000-0000-0000-000000000008", PRODUCER_ID, TENANT_ID, "Tomate chonto", "2024-B", 1.0,  4.5,  5400000, 2100000, "2024-12-20"],
    ];

    try {
      for (const [id, producerId, tenantId, cultivo, temporada, hectareas, toneladas, ingresos, costos, fechaCorte] of statRows) {
        await client.query(`
          INSERT INTO public.estadisticas_productor
            (id, producer_id, tenant_id, cultivo, temporada, hectareas, toneladas, ingresos, costos, fecha_corte, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (producer_id, cultivo, temporada) DO NOTHING
        `, [id, producerId, tenantId, cultivo, temporada, hectareas, toneladas, ingresos, costos, fechaCorte]);
      }
      console.log(`✓ Estadísticas de producción: ${statRows.length} registros históricos`);
    } catch {
      console.warn("⚠ estadisticas_productor no existe aún — corre 'npm run migrate' primero y luego 'npm run seed' de nuevo.");
    }

    // ── Sample offer ──────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO public.offers (
        id, tenant_id, producer_id, title, product_name, category, unit,
        quantity_available, price_amount, currency,
        available_from, municipality_name, status, latitude, longitude, created_at
      ) VALUES (
        $1, $2, $3, 'Papa criolla fresca lote A', 'Papa criolla', 'tuberculo', 'kg',
        500, 800, 'COP',
        NOW(), 'Bogotá D.C.', 'published', 4.6512, -74.0836, NOW()
      ) ON CONFLICT (id) DO UPDATE SET latitude = 4.6512, longitude = -74.0836
    `, [OFFER_ID, TENANT_ID, PRODUCER_ID]);
    console.log("✓ Oferta: Papa criolla (Bogotá)");

    // ── Sample demand ─────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO public.demands (
        id, tenant_id, demand_channel, organization_name, product_name, category, unit,
        quantity_required, needed_by, beneficiary_count, municipality_name, status,
        latitude, longitude, created_at
      ) VALUES (
        $1, $2, 'community_kitchen', 'Comedor Popular Sur', 'Papa criolla', 'tuberculo', 'kg',
        200, NOW() + INTERVAL '7 days', 120, 'Bogotá D.C.', 'open',
        4.5919, -74.1170, NOW()
      ) ON CONFLICT (id) DO UPDATE SET latitude = 4.5919, longitude = -74.1170
    `, [DEMAND_ID, TENANT_ID]);
    console.log("✓ Demanda: Comedor Popular Sur (Bogotá) lat=4.5919 lng=-74.1170");

    // ── Antioquia Tenants ────────────────────────────────────────────────────
    const antioquia = [
      { id: TENANT_RIONEGRO_ID,  name: "Rionegro",          code: "RIONEGRO",   lat: 6.1549,  lng: -75.3747 },
      { id: TENANT_SANTAROSA_ID, name: "Santa Rosa de Osos", code: "SANTAROSA",  lat: 6.6492,  lng: -75.4608 },
      { id: TENANT_SANROQUE_ID,  name: "San Roque",          code: "SANROQUE",   lat: 6.4783,  lng: -74.9944 },
    ];

    for (const t of antioquia) {
      await client.query(`
        INSERT INTO public.tenants (id, name, code, type, status, metadata)
        VALUES ($1, $2, $3, 'municipio', 'active', $4)
        ON CONFLICT (id) DO NOTHING
      `, [t.id, t.name, t.code, JSON.stringify({ department: "Antioquia", lat: t.lat, lng: t.lng })]);
      console.log(`✓ Tenant: ${t.name} (Antioquia)`);
    }

    // ── Usuarios por tenant de Antioquia ─────────────────────────────────────
    const antioquia_users = [
      // Rionegro
      { id: "51000000-0000-0000-0000-000000000001", tenantId: TENANT_RIONEGRO_ID,  email: "admin@rionegro.agrored.co",      fullName: "Admin Rionegro",           role: "admin_municipal",    password: "Admin@1234!" },
      { id: "51000000-0000-0000-0000-000000000002", tenantId: TENANT_RIONEGRO_ID,  email: "productor@rionegro.agrored.co",  fullName: "Pedro Rionegro",           role: "producer",           password: "Prod@1234!"  },
      { id: "51000000-0000-0000-0000-000000000003", tenantId: TENANT_RIONEGRO_ID,  email: "analista@rionegro.agrored.co",   fullName: "Ana Rionegro",             role: "territorial_analyst",password: "Ana@1234!"   },
      // Santa Rosa de Osos
      { id: "52000000-0000-0000-0000-000000000001", tenantId: TENANT_SANTAROSA_ID, email: "admin@santarosa.agrored.co",     fullName: "Admin Santa Rosa",         role: "admin_municipal",    password: "Admin@1234!" },
      { id: "52000000-0000-0000-0000-000000000002", tenantId: TENANT_SANTAROSA_ID, email: "productor@santarosa.agrored.co", fullName: "Luis Santa Rosa",          role: "producer",           password: "Prod@1234!"  },
      { id: "52000000-0000-0000-0000-000000000003", tenantId: TENANT_SANTAROSA_ID, email: "cocina@santarosa.agrored.co",    fullName: "Cocina Comunitaria Rosa",  role: "community_kitchen",  password: "Cocina@1234!"},
      // San Roque
      { id: "53000000-0000-0000-0000-000000000001", tenantId: TENANT_SANROQUE_ID,  email: "admin@sanroque.agrored.co",      fullName: "Admin San Roque",          role: "admin_municipal",    password: "Admin@1234!" },
      { id: "53000000-0000-0000-0000-000000000002", tenantId: TENANT_SANROQUE_ID,  email: "productor@sanroque.agrored.co",  fullName: "Jorge San Roque",          role: "producer",           password: "Prod@1234!"  },
      { id: "53000000-0000-0000-0000-000000000003", tenantId: TENANT_SANROQUE_ID,  email: "operador@sanroque.agrored.co",   fullName: "Logística San Roque",      role: "logistics_operator", password: "Oper@1234!"  },
    ];

    for (const u of antioquia_users) {
      const hash = await bcrypt.hash(u.password, SALT);
      await client.query(`
        INSERT INTO public.users (id, tenant_id, email, full_name, role, password_hash, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
      `, [u.id, u.tenantId, u.email, u.fullName, u.role, hash]);
      console.log(`✓ Usuario: ${u.email} (${u.role})`);
    }

    // ── Productores con coordenadas — Antioquia ──────────────────────────────
    const antioquiaProducers = [
      // Rionegro — Oriente antioqueño, zona frutícola
      { id: "21000000-0000-0000-0000-000000000001", tenantId: TENANT_RIONEGRO_ID,  userId: "51000000-0000-0000-0000-000000000002", org: "Finca La Primavera",   contact: "Pedro Rionegro",  phone: "3101112233", muni: "Rionegro",          cats: ["fruta","tuberculo"],       lat: 6.1549,  lng: -75.3747 },
      { id: "21000000-0000-0000-0000-000000000002", tenantId: TENANT_RIONEGRO_ID,  userId: null,                                   org: "Asociación AgroOriente", contact: "María López",  phone: "3202223344", muni: "Rionegro",          cats: ["hortaliza","leguminosa"],   lat: 6.1780,  lng: -75.3610 },
      // Santa Rosa de Osos — zona lechera y papa
      { id: "22000000-0000-0000-0000-000000000001", tenantId: TENANT_SANTAROSA_ID, userId: "52000000-0000-0000-0000-000000000002", org: "Finca El Paraíso",    contact: "Luis Santa Rosa", phone: "3113334455", muni: "Santa Rosa de Osos", cats: ["tuberculo","leguminosa"],   lat: 6.6492,  lng: -75.4608 },
      { id: "22000000-0000-0000-0000-000000000002", tenantId: TENANT_SANTAROSA_ID, userId: null,                                   org: "Cooperativa Lechera Norte", contact: "Ana Gómez", phone: "3224445566", muni: "Santa Rosa de Osos", cats: ["lacteo","tuberculo"],       lat: 6.6720,  lng: -75.4450 },
      // San Roque — zona cacaotera y plátano
      { id: "23000000-0000-0000-0000-000000000001", tenantId: TENANT_SANROQUE_ID,  userId: "53000000-0000-0000-0000-000000000002", org: "Finca Agua Clara",    contact: "Jorge San Roque", phone: "3135556677", muni: "San Roque",          cats: ["fruta","cacao"],           lat: 6.4783,  lng: -74.9944 },
      { id: "23000000-0000-0000-0000-000000000002", tenantId: TENANT_SANROQUE_ID,  userId: null,                                   org: "Agrogroup Nordeste",  contact: "Elena Torres",    phone: "3246667788", muni: "San Roque",          cats: ["platano","yuca"],          lat: 6.4950,  lng: -74.9800 },
    ];

    for (const p of antioquiaProducers) {
      await client.query(`
        INSERT INTO public.producers (
          id, tenant_id, user_id, producer_type, organization_name, contact_name, contact_phone,
          municipality_name, zone_type, product_categories, status, latitude, longitude, created_at
        ) VALUES (
          $1, $2, $3, 'individual', $4, $5, $6, $7, 'rural', $8, 'active', $9, $10, NOW()
        ) ON CONFLICT (id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
      `, [p.id, p.tenantId, p.userId, p.org, p.contact, p.phone, p.muni, p.cats, p.lat, p.lng]);
      console.log(`✓ Productor: ${p.org} (${p.muni}) lat=${p.lat} lng=${p.lng}`);
    }

    // ── Demandas con coordenadas — Antioquia ─────────────────────────────────
    const antioquiaDemands = [
      { id: "41000000-0000-0000-0000-000000000001", tenantId: TENANT_RIONEGRO_ID,  org: "Comedor Comunitario Rionegro",  product: "Tomate",    cat: "hortaliza", qty: 150, muni: "Rionegro",          lat: 6.1530,  lng: -75.3760 },
      { id: "42000000-0000-0000-0000-000000000001", tenantId: TENANT_SANTAROSA_ID, org: "Escuela Rural Santa Rosa",      product: "Papa",      cat: "tuberculo", qty: 300, muni: "Santa Rosa de Osos", lat: 6.6480,  lng: -75.4620 },
      { id: "43000000-0000-0000-0000-000000000001", tenantId: TENANT_SANROQUE_ID,  org: "Programa PAE San Roque",        product: "Plátano",   cat: "fruta",     qty: 200, muni: "San Roque",          lat: 6.4770,  lng: -74.9960 },
    ];

    for (const d of antioquiaDemands) {
      await client.query(`
        INSERT INTO public.demands (
          id, tenant_id, demand_channel, organization_name, product_name, category, unit,
          quantity_required, needed_by, beneficiary_count, municipality_name, status,
          latitude, longitude, created_at
        ) VALUES (
          $1, $2, 'community_kitchen', $3, $4, $5, 'kg',
          $6, NOW() + INTERVAL '10 days', 80, $7, 'open',
          $8, $9, NOW()
        ) ON CONFLICT (id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
      `, [d.id, d.tenantId, d.org, d.product, d.cat, d.qty, d.muni, d.lat, d.lng]);
      console.log(`✓ Demanda: ${d.org} (${d.muni}) lat=${d.lat} lng=${d.lng}`);
    }

    console.log("\n✓ Seed completado.\n");
    console.log("Usuarios de prueba:");
    for (const u of users) {
      console.log(`  ${u.email.padEnd(40)} | ${u.password}`);
    }
    console.log("\nUsuarios Antioquia:");
    for (const u of antioquia_users) {
      console.log(`  ${u.email.padEnd(40)} | ${u.password}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
