/**
 * Seed script — QA pilot: Rionegro (Oriente Antioqueño).
 *
 * Scope: catalog/reference data only (tenant, role-coverage users, operators/producers,
 * product catalog, demand institutions, baseline logistics orders, one baseline incident).
 * Process flows (offer CRUD, auctions, rescue chain, incident classify->alert, RBAC,
 * IRAT check) are exercised by tests/e2e/**\/rionegro-*.spec.ts against the real API,
 * not pre-seeded here, so they actually validate the running system.
 *
 * All records are prefixed TEST_QA_RIONEGRO so they can be identified/purged later.
 *
 * Usage:
 *   npx tsx scripts/seed_rionegro_pilot.ts
 *
 * Connection env vars (optional; fall back to repo defaults, same as seed_expanded.ts):
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, DATABASE_URL
 */

import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";
import { createHash } from "crypto";

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

const TENANT_CODE = "RIONEGRO";
const TENANT_NAME = "Municipio de Rionegro";
const SALT = Number(process.env.BCRYPT_SALT_ROUNDS ?? "10");
const TAG = "TEST_QA_RIONEGRO";

/** Deterministic UUID (v4-shaped) derived from a stable natural key, so re-runs are idempotent. */
function uuidFromKey(key: string): string {
  const hash = createHash("md5").update(key).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function nowIsoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Roles recognized by RBAC (see apps/api-gateway/.../middlewares/rbac.ts)
const roles = [
  "admin_municipal",
  "producer",
  "supermarket",
  "logistics_operator",
  "territorial_analyst",
  "community_kitchen",
  "monitoring_agent",
];

// Center of Rionegro urban area (matches infra/postgres/029_departamentos_municipios.sql)
const RIONEGRO_CENTER = { lat: 6.1550, lon: -75.3738 };

function jitter(base: number, seedIdx: number, spread = 0.03): number {
  const frac = ((seedIdx * 9301 + 49297) % 233280) / 233280; // deterministic pseudo-random 0..1
  return base + (frac - 0.5) * 2 * spread;
}

// ── Operator/anchor organizations (2-3 distinct, not repeated) ──
const operators = [
  {
    key: "corpoangeles",
    org: `${TAG} Corporación Ángeles de Rionegro (Corpoángeles)`,
    contact: "Marta Lucía Gómez",
    phone: "3011234501",
    vereda: "Vereda Cabeceras",
  },
  {
    key: "apao",
    org: `${TAG} Asociación de Productores Agroecológicos del Oriente (APAO)`,
    contact: "Jhon Fredy Ramírez",
    phone: "3011234502",
    vereda: "Vereda El Tablazo",
  },
  {
    key: "coopagrorio",
    org: `${TAG} Cooperativa Agropecuaria La Cosecha (COOAGRORIO)`,
    contact: "Diana Patricia Osorio",
    phone: "3011234503",
    vereda: "Vereda Chachafruto",
  },
];

// ── Individual producers (10) — real Rionegro veredas ──
const veredas = [
  "Vereda La Mosquita",
  "Vereda Barro Blanco",
  "Vereda Convento",
  "Vereda El Capiro",
  "Vereda Galicia",
  "Vereda La Playa",
  "Vereda Pantanillo",
  "Vereda Guayabito",
  "Vereda Tres Puertas",
  "Vereda Santa Bárbara",
];
const producerNames = [
  { name: "Luz Marina Restrepo", finca: "Finca La Esperanza" },
  { name: "Carlos Alberto Zapata", finca: "Finca El Recreo" },
  { name: "Beatriz Elena Vélez", finca: "Finca Buenavista" },
  { name: "Jorge Iván Correa", finca: "Finca San Isidro" },
  { name: "Sandra Milena Arango", finca: "Finca La Primavera" },
  { name: "Wilmar Andrés Giraldo", finca: "Finca El Porvenir" },
  { name: "Claudia Patricia Henao", finca: "Finca Los Naranjos" },
  { name: "Fabio Alonso Marín", finca: "Finca La Cabaña" },
  { name: "Rocío del Pilar Ospina", finca: "Finca El Retiro Chico" },
  { name: "Édgar Darío Cardona", finca: "Finca Villa Luz" },
];

const productsByCat: Record<string, string[]> = {
  tuberculo: ["Papa criolla", "Yuca", "Papa Suprema"],
  hortaliza: ["Lechuga", "Zanahoria", "Tomate chonto", "Repollo", "Cilantro"],
  fruta: ["Mora", "Fresa", "Tomate de árbol", "Aguacate Hass", "Banano"],
  lacteo: ["Queso campesino", "Leche cruda", "Kumis"],
  carnico: ["Pollo campesino", "Cerdo"],
  huevo: ["Huevo AA", "Huevo campesino"],
};
const categories = Object.keys(productsByCat);

// ── Demand institutions (4) ──
const institutions = [
  {
    key: "hospital",
    type: "hospital",
    name: `${TAG} ESE Hospital San Juan de Dios de Rionegro`,
    contact: "Dra. Ana María Toro",
    phone: "3021234501",
    beneficiaries: 180,
    cats: ["hortaliza", "fruta", "lacteo"],
  },
  {
    key: "comedor",
    type: "community_canteen",
    name: `${TAG} Comedor Comunitario La Convención`,
    contact: "Yolanda Restrepo",
    phone: "3021234502",
    beneficiaries: 220,
    cats: ["tuberculo", "hortaliza", "carnico"],
  },
  {
    key: "icbf",
    type: "educational",
    name: `${TAG} ICBF CDI Pequeños Gigantes Rionegro`,
    contact: "Nataly Muñoz",
    phone: "3021234503",
    beneficiaries: 95,
    cats: ["lacteo", "fruta", "huevo"],
  },
  {
    key: "super",
    type: "other",
    name: `${TAG} Supermercado La Economía Rionegro`,
    contact: "Hernán Darío Ríos",
    phone: "3021234504",
    beneficiaries: 300, // familias atendidas/semana vía canasta solidaria de excedentes
    cats: ["hortaliza", "tuberculo"],
  },
];

async function tableExists(client: pg.PoolClient, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function seed(): Promise<void> {
  const client = await pool.connect();
  const counts = { producers: 0, offers: 0, institutions: 0, demands: 0, logisticsOrders: 0, incidents: 0, users: 0 };

  try {
    console.log(`Seeding AgroRed QA pilot data — tenant ${TENANT_CODE}...\n`);

    // ===== 1) Tenant =====
    // The RIONEGRO tenant may already exist (infra/postgres/028_superadmin_role.sql seeds it
    // with its own fixed id), so upsert by natural key `code` and then re-read the real id
    // instead of assuming our deterministic uuidFromKey() matches an existing row.
    const tenantIdGuess = uuidFromKey(`tenant:${TENANT_CODE}`);
    await client.query(
      `INSERT INTO public.tenants (id, code, name, type, status, metadata)
       VALUES ($1,$2,$3,'municipio','active',$4)
       ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name, status = 'active', updated_at = NOW()`,
      [tenantIdGuess, TENANT_CODE, TENANT_NAME, JSON.stringify({ scope: "qa-pilot", tag: TAG })]
    );
    const tenantRow = await client.query<{ id: string }>(
      `SELECT id FROM public.tenants WHERE code = $1`,
      [TENANT_CODE]
    );
    const tenantId = tenantRow.rows[0].id;

    // ===== 2) Role-coverage users (one per role, fixed credentials for E2E fixtures) =====
    const userIdByRole = new Map<string, string>();
    for (let r = 0; r < roles.length; r++) {
      const role = roles[r];
      const userId = uuidFromKey(`user:${TENANT_CODE}:${role}`);
      const email = `role.${role}.rionegro@agrored.co`;
      const password = `Role@RIONEGRO${r + 1}!`;
      const passwordHash = await bcrypt.hash(password, SALT);

      await client.query(
        `INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, created_at)
         VALUES ($1,$2,$3,$4,$5,'active',$6,NOW())
         ON CONFLICT (email) DO UPDATE
         SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, status = 'active',
             password_hash = EXCLUDED.password_hash`,
        [userId, tenantId, email, `${TAG} Role ${role}`, role, passwordHash]
      );
      userIdByRole.set(role, userId);
      counts.users++;
    }

    // A second producer user, so the "producer cannot see another producer's offers" test has two distinct accounts.
    const producer2UserId = uuidFromKey(`user:${TENANT_CODE}:producer:2`);
    await client.query(
      `INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, created_at)
       VALUES ($1,$2,$3,$4,'producer','active',$5,NOW())
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, status = 'active'`,
      [
        producer2UserId,
        tenantId,
        "role.producer2.rionegro@agrored.co",
        `${TAG} Role producer 2`,
        await bcrypt.hash("Role@RIONEGRO2B!", SALT),
      ]
    );
    counts.users++;

    // ===== 3) Operators (association producers) + individual producers =====
    const producerRefs: { id: string; userId: string; orgName: string }[] = [];

    for (let i = 0; i < operators.length; i++) {
      const op = operators[i];
      const producerId = uuidFromKey(`producer:${TENANT_CODE}:operator:${op.key}`);
      // First operator is linked to the shared "producer" role-coverage user so E2E login works;
      // the other two are catalog-only anchors (no login needed for the pilot).
      const linkedUser = i === 0 ? userIdByRole.get("producer")! : producer2UserId;

      await client.query(
        `INSERT INTO public.producers
         (id, tenant_id, user_id, producer_type, organization_name, contact_name, contact_phone,
          municipality_name, zone_type, product_categories, status, created_at)
         VALUES ($1,$2,$3,'association',$4,$5,$6,$7,'rural',$8,'active',NOW())
         ON CONFLICT (id) DO UPDATE
         SET organization_name = EXCLUDED.organization_name, status = 'active'`,
        [
          producerId,
          tenantId,
          linkedUser,
          op.org,
          op.contact,
          op.phone,
          TENANT_NAME,
          categories.slice(0, 3),
        ]
      );
      producerRefs.push({ id: producerId, userId: linkedUser, orgName: op.org });
      counts.producers++;
    }

    for (let i = 0; i < producerNames.length; i++) {
      const p = producerNames[i];
      const producerId = uuidFromKey(`producer:${TENANT_CODE}:individual:${i}`);
      const orgName = `${TAG} ${p.finca} — ${veredas[i]}`;
      const catA = categories[i % categories.length];
      const catB = categories[(i + 2) % categories.length];

      await client.query(
        `INSERT INTO public.producers
         (id, tenant_id, user_id, producer_type, organization_name, contact_name, contact_phone,
          municipality_name, zone_type, product_categories, status, created_at)
         VALUES ($1,$2,$3,'individual',$4,$5,$6,$7,'rural',$8,'active',NOW())
         ON CONFLICT (id) DO UPDATE
         SET organization_name = EXCLUDED.organization_name, status = 'active'`,
        [
          producerId,
          tenantId,
          producer2UserId,
          orgName,
          p.name,
          `301${String(2000000 + i * 37).padStart(7, "0")}`.slice(0, 10),
          TENANT_NAME,
          [catA, catB],
        ]
      );
      producerRefs.push({ id: producerId, userId: producer2UserId, orgName });
      counts.producers++;
    }

    // ===== 4) Product catalog (offers), 4 per producer, varied categories =====
    const offerRefs: { id: string; producerId: string; category: string; productName: string }[] = [];
    const hasInventory = await tableExists(client, "public.inventory_items");

    for (let pi = 0; pi < producerRefs.length; pi++) {
      const prod = producerRefs[pi];
      for (let o = 0; o < 4; o++) {
        const cat = categories[(pi + o) % categories.length];
        const productName = productsByCat[cat][(pi + o) % productsByCat[cat].length];
        const offerId = uuidFromKey(`offer:${TENANT_CODE}:${pi}:${o}`);
        const qty = 150 + ((pi + o) % 8) * 40;
        const price = 1800 + ((pi + o) % 10) * 700;
        const lat = jitter(RIONEGRO_CENTER.lat, pi);
        const lon = jitter(RIONEGRO_CENTER.lon, pi + 50);

        await client.query(
          `INSERT INTO public.offers
           (id, tenant_id, producer_id, title, product_name, category, unit,
            quantity_available, price_amount, currency,
            available_from, available_until, municipality_name, notes, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,'kg',$7,$8,'COP',$9,$10,$11,$12,'published',NOW())
           ON CONFLICT (id) DO UPDATE SET status = 'published'`,
          [
            offerId,
            tenantId,
            prod.id,
            `${TAG} ${productName} — ${prod.orgName}`,
            productName,
            cat,
            qty,
            price,
            nowIsoPlusDays(-1),
            nowIsoPlusDays(10),
            TENANT_NAME,
            `${TAG} lat:${lat.toFixed(6)} lon:${lon.toFixed(6)}`,
          ]
        );
        offerRefs.push({ id: offerId, producerId: prod.id, category: cat, productName });
        counts.offers++;

        if (hasInventory) {
          const invId = uuidFromKey(`inventory:${TENANT_CODE}:${pi}:${o}`);
          await client.query(
            `INSERT INTO public.inventory_items
             (id, tenant_id, producer_id, offer_id, rescue_id, source_type,
              storage_location_name, product_name, category, unit,
              quantity_on_hand, quantity_reserved, municipality_name, notes, status, created_at)
             VALUES ($1,$2,$3,$4,NULL,'offer',$5,$6,$7,'kg',$8,0,$9,$10,'available',NOW())
             ON CONFLICT (id) DO NOTHING`,
            [
              invId,
              tenantId,
              prod.id,
              offerId,
              `Acopio ${veredas[pi % veredas.length]}`,
              productName,
              cat,
              qty,
              TENANT_NAME,
              `${TAG} inventario para oferta`,
            ]
          );
        }
      }
    }

    // ===== 5) Demand institutions + demands =====
    const institutionRefs: { id: string; name: string; type: string }[] = [];
    const hasInstitutions = await tableExists(client, "public.institutions");

    for (const inst of institutions) {
      const institutionId = uuidFromKey(`institution:${TENANT_CODE}:${inst.key}`);
      if (hasInstitutions) {
        await client.query(
          `INSERT INTO public.institutions
           (id, tenant_id, institution_type, name, contact_name, contact_phone,
            municipality_name, beneficiary_count, product_categories, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',NOW())
           ON CONFLICT (id) DO UPDATE SET status = 'active'`,
          [
            institutionId,
            tenantId,
            inst.type,
            inst.name,
            inst.contact,
            inst.phone,
            TENANT_NAME,
            inst.beneficiaries,
            inst.cats,
          ]
        );
      }
      institutionRefs.push({ id: institutionId, name: inst.name, type: inst.type });
      counts.institutions++;

      for (let d = 0; d < inst.cats.length; d++) {
        const cat = inst.cats[d];
        const productName = productsByCat[cat][d % productsByCat[cat].length];
        const demandId = uuidFromKey(`demand:${TENANT_CODE}:${inst.key}:${d}`);
        await client.query(
          `INSERT INTO public.demands
           (id, tenant_id, responsible_user_id, demand_channel, organization_name,
            product_name, category, unit, quantity_required, needed_by, beneficiary_count,
            municipality_name, institution_id, status, created_at)
           VALUES ($1,$2,$3,'institutional',$4,$5,$6,'kg',$7,$8,$9,$10,$11,'open',NOW())
           ON CONFLICT (id) DO UPDATE SET status = 'open'`,
          [
            demandId,
            tenantId,
            userIdByRole.get("community_kitchen")!,
            inst.name,
            productName,
            cat,
            100 + d * 40,
            nowIsoPlusDays(14),
            inst.beneficiaries,
            TENANT_NAME,
            hasInstitutions ? institutionId : null,
          ]
        );
        counts.demands++;
      }
    }

    // ===== 6) Baseline logistics orders (1-2), linked to real inventory + demand =====
    const hasLogistics = await tableExists(client, "public.logistics_orders");
    if (hasLogistics && hasInventory && offerRefs.length > 0 && institutionRefs.length > 0) {
      for (let i = 0; i < 2 && i < offerRefs.length; i++) {
        const invId = uuidFromKey(`inventory:${TENANT_CODE}:${i}:0`);
        const logisticsOrderId = uuidFromKey(`logistics:${TENANT_CODE}:${i}`);
        const dest = institutionRefs[i % institutionRefs.length];
        await client.query(
          `INSERT INTO public.logistics_orders
           (id, tenant_id, inventory_item_id, demand_id, route_mode,
            origin_location_name, destination_organization_name, destination_address,
            scheduled_pickup_at, scheduled_delivery_at, quantity_assigned,
            municipality_name, notes, status, created_at)
           VALUES ($1,$2,$3,NULL,'municipal_fleet',$4,$5,$6,$7,$8,$9,$10,$11,'scheduled',NOW())
           ON CONFLICT (id) DO UPDATE SET status = 'scheduled'`,
          [
            logisticsOrderId,
            tenantId,
            invId,
            `Centro de acopio ${veredas[i % veredas.length]}`,
            dest.name,
            `${dest.name}, ${TENANT_NAME}`,
            nowIsoPlusDays(1),
            nowIsoPlusDays(2),
            120 + i * 30,
            TENANT_NAME,
            `${TAG} orden logística base`,
          ]
        );
        counts.logisticsOrders++;
      }
    }

    // ===== 7) Baseline incident (low severity, municipio context for IRAT) =====
    const hasIncidents = await tableExists(client, "public.incidents");
    if (hasIncidents) {
      const incidentId = uuidFromKey(`incident:${TENANT_CODE}:baseline`);
      await client.query(
        `INSERT INTO public.incidents
         (id, tenant_id, logistics_order_id, incident_type, severity, title, description,
          location_description, latitude, longitude, occurred_at,
          municipality_name, notes, status, created_at)
         VALUES ($1,$2,NULL,'access_blockage','low',$3,$4,$5,$6,$7,$8,$9,$10,'open',NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'open'`,
        [
          incidentId,
          tenantId,
          `${TAG} Mantenimiento vial parcial vía El Tablazo`,
          `${TAG} Mantenimiento programado reduce a un carril el acceso desde la vereda El Tablazo. Tráfico lento, sin bloqueo total.`,
          "Vía El Tablazo - Rionegro, km 3",
          jitter(RIONEGRO_CENTER.lat, 99),
          jitter(RIONEGRO_CENTER.lon, 100),
          nowIsoPlusDays(0),
          TENANT_NAME,
          `${TAG} incidente base de contexto municipal (no crítico)`,
        ]
      );
      counts.incidents++;
    }

    console.log("Resumen de siembra Rionegro (QA pilot):");
    console.table(counts);
    console.log(`\nTenant id: ${tenantId}`);
    console.log("Credenciales por rol: role.{role}.rionegro@agrored.co / Role@RIONEGRO{n}!");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Fallo al sembrar datos de Rionegro:", err);
  process.exitCode = 1;
});
