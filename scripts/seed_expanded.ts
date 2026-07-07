/**
 * Seed script — AgroRed development/test data (expanded).
 *
 * Goals:
 * - Load more records across core operational tables (tenants/users/producers/offers/demands, etc.)
 * - Keep idempotency where possible (fixed UUIDs + ON CONFLICT)
 * - Generate coherent relationships to support robust module tests.
 *
 * Usage:
 *   npx tsx scripts/seed_expanded.ts
 *
 * Connection env vars (optional; fall back to repo defaults):
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, DATABASE_URL
 */

import pg from "pg";
import bcrypt from "bcrypt";

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
  ssl: isRemote ? { rejectUnauthorized: false } : false
});

// ===== Config knobs =====
const SEED_TENANTS = Number(process.env.SEED_TENANTS ?? "3");
const USERS_PER_TENANT = Number(process.env.USERS_PER_TENANT ?? "6");
const PRODUCERS_PER_TENANT = Number(process.env.PRODUCERS_PER_TENANT ?? "12");
const OFFERS_PER_PRODUCER = Number(process.env.OFFERS_PER_PRODUCER ?? "3");
const DEMANDS_PER_TENANT = Number(process.env.DEMANDS_PER_TENANT ?? "15");
const INVENTORY_ITEMS_PER_OFFER = Number(process.env.INVENTORY_ITEMS_PER_OFFER ?? "1");
const LOGISTICS_ORDERS_PER_DEMAND = Number(process.env.LOGISTICS_ORDERS_PER_DEMAND ?? "1");
const INCIDENTAL_NOTIFICATIONS_FACTOR = Number(process.env.INCIDENCE_NOTIFICATIONS_FACTOR ?? "1");

const SALT = Number(process.env.BCRYPT_SALT_ROUNDS ?? "10");

// ===== UUID generation (deterministic) =====
// We create deterministic UUIDs from a namespace + integer index.
// This keeps inserts idempotent across repeated seed runs.
function makeUuid(prefixHexByte: number, tenantIndex: number, localIndex: number): string {
  // UUID v4-ish formatting but deterministic.
  // Format: 8-4-4-4-12
  const a = (0x10000000 + prefixHexByte * 0x10000 + tenantIndex * 0x100 + localIndex) >>> 0;
  const b = (0x2000 + tenantIndex * 0x10 + (localIndex % 0x100)) & 0xffff;
  const c = ((0x3000 | 0x0000) + (tenantIndex % 0x100)) & 0xffff;
  const d = ((0x4000 | 0x0000) + (localIndex % 0x100)) & 0xffff;
  const e = (0x500000000000 + tenantIndex * 0x1000000 + localIndex * 0x1000) >>> 0;
  // Build hex pieces
  const hexA = a.toString(16).padStart(8, "0");
  const hexB = b.toString(16).padStart(4, "0");
  const hexC = c.toString(16).padStart(4, "0");
  const hexD = d.toString(16).padStart(4, "0");
  const hexE = e.toString(16).padStart(8, "0").padEnd(12, "0");
  return `${hexA}-${hexB}-${hexC}-${hexD}-${hexE}`;
}

function nowIsoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function pick<T>(arr: T[], idx: number): T {
  return arr[idx % arr.length];
}

async function tableExists(client: pg.PoolClient, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function columnExists(client: pg.PoolClient, tableName: string, columnName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = $2
     ) AS exists`,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log("Seeding AgroRed expanded data...\n");

    // ===== Domain fixtures =====
    const tenantDefs = [
      { code: "BOGOTA", name: "Bogotá D.C.", type: "municipio" },
      { code: "MEDELLIN", name: "Medellín", type: "municipio" },
      { code: "CALI", name: "Cali", type: "municipio" },
      { code: "ENVIGADO", name: "Envigado", type: "municipio" },
      { code: "BUCARAMANGA", name: "Bucaramanga", type: "municipio" },
      { code: "PASTO", name: "Pasto", type: "municipio" },
    ];

    const roles = [
      "admin_municipal",
      "producer",
      "supermarket",
      "logistics_operator",
      "territorial_analyst",
      "community_kitchen",
      "monitoring_agent",
    ];

    const legacyRoles = ["ADMIN", "PRODUCER", "OPERATOR", "MUNICIPALITY", "TERRITORIAL_MANAGER"];

    const producerTypes = ["individual", "association"] as const;

    const productCats = [
      "tuberculo",
      "hortaliza",
      "cereal",
      "leguminosa",
      "fruta",
      "lácteo",
      "cárnico",
    ];

    const productsByCat: Record<string, string[]> = {
      tuberculo: ["Papa criolla", "Yuca"],
      hortaliza: ["Lechuga", "Zanahoria", "Tomate chonto"],
      cereal: ["Maíz"],
      leguminosa: ["Fríjol"],
      fruta: ["Banano"],
      "lácteo": ["Queso"],
      "cárnico": ["Pollo"],
    };

      // const rescueChannels = ["kitchen_dropoff", "direct_pickup", "community_center"];
    const notificationChannels = ["sms", "email", "whatsapp"];
    const incidentTypes = ["overdue_delivery", "quality_issue", "route_blockage"];
    const severities = ["low", "medium", "high"];

    // ===== 1) Tenants =====
    // Insert tenants by code (idempotent) and then re-read their ids.
    for (let t = 0; t < SEED_TENANTS; t++) {
      const td = tenantDefs[t % tenantDefs.length];
      const tenantId = makeUuid(1, t, 1);

      await client.query(
        `INSERT INTO public.tenants (id, code, name, type, status, metadata)
VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name,
             type = EXCLUDED.type,
             status = EXCLUDED.status,
             metadata = EXCLUDED.metadata,
             updated_at = NOW()`,
        [tenantId, td.code, td.name, td.type, "active", JSON.stringify({ scope: "expanded-seed", tenant: td.code })]
      );
    }

    const tenantsByCode = new Map<string, string>();
    const tenantNameById = new Map<string, string>();
    const tenantCodes = Array.from({ length: SEED_TENANTS }, (_, t) => tenantDefs[t % tenantDefs.length].code);

    // Evita inferencia problemática de tipos con arrays ($1::varchar[]) en algunos entornos.
    const placeholders = tenantCodes.map((_, i) => `$${i + 1}`).join(',');
    const rowsTenants = await client.query<{ code: string; id: string }>(
      `SELECT code, id FROM public.tenants WHERE code IN (${placeholders})`,
      tenantCodes
    );

    for (const r of rowsTenants.rows) {
      tenantsByCode.set(r.code, r.id);
      const tenantDef = tenantDefs.find((td) => td.code === r.code);
      if (tenantDef) {
        tenantNameById.set(r.id, tenantDef.name);
      }
    }

    // Fallback: if any tenant code missing, stop early with a clear message.
    for (const code of tenantCodes) {
      if (!tenantsByCode.has(code)) {
        throw new Error(`No se pudo insertar/leer tenant con code=${code}.`);
      }
    }

    // ===== 2) Users + Producers =====
    // We'll create USERS_PER_TENANT users per tenant.
    // Producers will be created for subset of users.
    const userIds: string[][] = [];
    const producerIds: string[][] = [];

    let producerGlobalCounter = 0;

    for (let t = 0; t < SEED_TENANTS; t++) {
      const tenantCode = tenantDefs[t % tenantDefs.length].code;
      const tenantId = tenantsByCode.get(tenantCode)!;
      userIds[t] = [];
      producerIds[t] = [];

      for (let u = 0; u < USERS_PER_TENANT; u++) {
        const role = pick(roles, u + t * 7);
        const userId = makeUuid(2, t, u + 1);
        userIds[t].push(userId);

        const email = `seed.${tenantDefs[t % tenantDefs.length].code}.${u + 1}@agrored.co`.toLowerCase();
        const password = `Seed@${tenantDefs[t % tenantDefs.length].code}${u + 1}!`;
        const fullName = `${role.replaceAll("_", " ")} ${u + 1}`;
        const passwordHash = await bcrypt.hash(password, SALT);

        await client.query(
          `INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, created_at)
VALUES ($1,$2,$3,$4,$5,'active',$6,NOW())
           ON CONFLICT (email) DO UPDATE
           SET full_name = EXCLUDED.full_name,
               role = EXCLUDED.role,
               status = EXCLUDED.status,
               password_hash = EXCLUDED.password_hash`,
          [userId, tenantId, email, fullName, role, passwordHash]
        );



        // Create producers for some users (not all): we map producers by index below.
      }

      // Ensure one user per role family (gateway + legacy) for role-based end-to-end tests.
      const roleCoverage = [...new Set([...roles, ...legacyRoles])];
      for (let r = 0; r < roleCoverage.length; r++) {
        const role = roleCoverage[r];
        const isLegacyRole = legacyRoles.includes(role);
        const coverageUserId = makeUuid(isLegacyRole ? 0x23 : 0x22, t, r + 1);
        const coverageEmail = isLegacyRole
          ? `role.legacy_${role.toLowerCase()}.${tenantCode.toLowerCase()}@agrored.co`
          : `role.${role.toLowerCase()}.${tenantCode.toLowerCase()}@agrored.co`;
        const coveragePasswordHash = await bcrypt.hash(`Role@${tenantCode}${r + 1}!`, SALT);

        await client.query(
          `INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, created_at)
           VALUES ($1,$2,$3,$4,$5,'active',$6,NOW())
           ON CONFLICT (email) DO UPDATE
           SET full_name = EXCLUDED.full_name,
               role = EXCLUDED.role,
               status = EXCLUDED.status,
               password_hash = EXCLUDED.password_hash`,
          [
            coverageUserId,
            tenantId,
            coverageEmail,
            `Role ${role} ${tenantCode}`,
            role,
            coveragePasswordHash
          ]
        );
      }

      for (let p = 0; p < PRODUCERS_PER_TENANT; p++) {
        const producerId = makeUuid(3, t, p + 1);
        producerIds[t].push(producerId);

        // Attach to a user that exists in this tenant.
        const linkedUser = userIds[t][p % userIds[t].length];

        const pType = pick([...producerTypes], producerGlobalCounter + p);
        const organizationName = `${pType === "association" ? "Asociación" : "Finca"} ${tdName(tenantDefs[t % tenantDefs.length].code)} #${p + 1}`;
        const contactName = `Contacto ${p + 1}`;
        const contactPhone = `3001${String(100000 + producerGlobalCounter * 17 + p).padStart(7, "0")}`.slice(0, 10);

        const municipalityName = tenantDefs[t % tenantDefs.length].name;
        const zoneType = pick(["rural", "periurban"], p);

        const catA = pick(productCats, p + 3);
        const catB = pick(productCats, p + 9);
        const productCategories = Array.from(new Set([catA, catB]));

        await client.query(
          `INSERT INTO public.producers
           (id, tenant_id, user_id, producer_type, organization_name, contact_name, contact_phone,
            municipality_name, zone_type, product_categories, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            producerId,
            tenantId,
            linkedUser,
            pType,
            organizationName,
            contactName,
            contactPhone,
            municipalityName,
            zoneType,
            productCategories,
          ]
        );

        producerGlobalCounter++;
      }
    }

    // ===== 3) Offers + Demands (coherent) =====
    // Offers are created per producer.
    // Demands are created per tenant, and we'll later connect logistics orders to them.

    const offerRefs: { producerId: string; offerId: string; category: string; productName: string }[] = [];
    const demandRefs: { tenantId: string; demandId: string; category: string; productName: string }[] = [];

    for (let t = 0; t < SEED_TENANTS; t++) {
      const tenantCode = tenantDefs[t % tenantDefs.length].code;
      const tenantId = tenantsByCode.get(tenantCode)!;
      const municipalityName = tenantDefs[t % tenantDefs.length].name;

      // Demands
      for (let d = 0; d < DEMANDS_PER_TENANT; d++) {
        const demandId = makeUuid(4, t, d + 1);

        const cat = pick(productCats, t * 100 + d * 2);
        const productName = pick(productsByCat[cat] ?? [cat], d + t);
        const qty = 120 + ((d + t) % 10) * 50;
        const neededBy = nowIsoPlusDays(7 + ((d + t) % 21));
        const beneficiaryCount = 10 + ((d * 3) % 60);

        await client.query(
          `INSERT INTO public.demands
            (id, tenant_id, responsible_user_id, demand_channel, organization_name,
             product_name, category, unit, quantity_required, needed_by, beneficiary_count,
             municipality_name, status, created_at)
           VALUES (
             $1::uuid,
             $2::uuid,
             $3::uuid,
             $4::varchar,
             $5::varchar,
             $6::varchar,
             $7::varchar,
             $8::varchar,
             $9::numeric,
             $10::timestamptz,
             $11::int4,
             $12::varchar,
             $13::varchar,
             NOW()
           )
           ON CONFLICT (id) DO NOTHING`,
          [
            demandId,
            tenantId,
            userIds[t][d % userIds[t].length],
            "institutional",
            "Municipio / Aliado",
            productName,
            cat,
            "kg",
            qty,
            neededBy,
            beneficiaryCount,
            municipalityName,
            "open",
          ]
        );

        demandRefs.push({ tenantId, demandId, category: cat, productName });
      }

      // Offers
      for (let p = 0; p < PRODUCERS_PER_TENANT; p++) {
        const producerId = producerIds[t][p];

        for (let o = 0; o < OFFERS_PER_PRODUCER; o++) {
          const offerId = makeUuid(5, t, p * OFFERS_PER_PRODUCER + o + 1);
          const cat = pick(productCats, t * 1000 + p * 17 + o);
          const productName = pick(productsByCat[cat] ?? [cat], p + o + t);

          const qty = 200 + ((o + p) % 7) * 60;
          const price = 2000 + ((o + p + t) % 8) * 850;
          const availableFrom = nowIsoPlusDays(-2 + (o % 2));
          const availableUntil = nowIsoPlusDays(4 + ((o + p) % 12));

          await client.query(
            `INSERT INTO public.offers
             (id, tenant_id, producer_id, title, product_name, category, unit,
              quantity_available, price_amount, currency,
              available_from, available_until, municipality_name, notes, status, created_at)
             VALUES ($1,$2,$3,
                     $4,$5,$6,'kg',$7,$8,'COP',
                     $9,$10,$11,$12,'published',NOW())
             ON CONFLICT (id) DO NOTHING`,
            [
              offerId,
              tenantId,
              producerId,
              `${productName} lote ${o + 1}`,
              productName,
              cat,
              qty,
              price,
              availableFrom,
              availableUntil,
              municipalityName,
              `seed_expanded ${tenantDefs[t % tenantDefs.length].code}`,
            ]
          );

          offerRefs.push({ producerId, offerId, category: cat, productName });

          // Inventory items for each offer
          for (let inv = 0; inv < INVENTORY_ITEMS_PER_OFFER; inv++) {
            const invId = makeUuid(6, t, offerRefs.length + inv + 1);
          await client.query(
            `INSERT INTO public.inventory_items
              (id, tenant_id, producer_id, offer_id, rescue_id, source_type,
               storage_location_name, product_name, category, unit,
               quantity_on_hand, quantity_reserved,
               municipality_name, notes, status, created_at)
             VALUES (
               $1::uuid,
               $2::uuid,
               $3::uuid,
               $4::uuid,
               NULL,
               'offer'::varchar,
               $5::varchar,
               $6::varchar,
               $7::varchar,
               $8::varchar,
               $9::numeric,
               0::numeric,
               $10::varchar,
               $11::varchar,
               'available'::varchar,
               NOW()
             )
             ON CONFLICT (id) DO NOTHING`,
            [
              invId,
              tenantId,
              producerId,
              offerId,
              `Bodega ${tenantDefs[t % tenantDefs.length].name}`,
              productName,
              cat,
              "kg",
              qty,
              municipalityName,
              `inv seed ${offerId}`,
            ]
          );
          }
        }
      }
    }

    // ===== 4) Logistics Orders (connect to demands) =====
    // For each demand, we pick an inventory item with same category where possible.

    // Pre-fetch inventory candidates for better matching
    const inventories = await client.query<{
      id: string;
      tenant_id: string;
      offer_id: string;
      producer_id: string;
      category: string;
      product_name: string;
      quantity_on_hand: string;
    }>(
      `SELECT id, tenant_id, offer_id, producer_id, category, product_name, quantity_on_hand
       FROM public.inventory_items
       WHERE status = 'available'`
    );

    const invByTenantAndCategory = new Map<string, typeof inventories.rows>();
    for (const row of inventories.rows) {
      const key = `${row.tenant_id}::${row.category}`;
      const arr = invByTenantAndCategory.get(key) ?? [];
      arr.push(row);
      invByTenantAndCategory.set(key, arr);
    }

    const logisticsOrderIds: string[] = [];

    for (let i = 0; i < demandRefs.length; i++) {
      const { tenantId, demandId, category } = demandRefs[i];
      const invKey = `${tenantId}::${category}`;
      const candidates = invByTenantAndCategory.get(invKey);

      if (!candidates || candidates.length === 0) continue;

      const inv = candidates[i % candidates.length];

      const logisticsOrderId = makeUuid(7, i, 1);
      logisticsOrderIds.push(logisticsOrderId);

      const pickupOffsetDays = 1 + (i % 5);
      const deliveryOffsetDays = pickupOffsetDays + 1 + (i % 3);
      const pickupAt = nowIsoPlusDays(pickupOffsetDays);
      const deliveryAt = nowIsoPlusDays(deliveryOffsetDays);

      const qtyAssigned = Math.max(10, Math.round(Number(inv.quantity_on_hand) * 0.2));

      await client.query(
        `INSERT INTO public.logistics_orders
         (id, tenant_id, inventory_item_id, demand_id, route_mode,
          origin_location_name, destination_organization_name, destination_address,
          scheduled_pickup_at, scheduled_delivery_at, quantity_assigned,
          municipality_name, notes, status, created_at)
         VALUES ($1,$2,$3,$4,'road',
                 'Centro de acopio',
                 'Destino institucional',
                 'Dirección seed ${i + 1}',
                 $5,$6,$7,
                 $8,$9,'scheduled',NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          logisticsOrderId,
          tenantId,
          inv.id,
          demandId,
          pickupAt,
          deliveryAt,
          qtyAssigned,
          tenantNameById.get(tenantId) ?? "Municipio",
          `logistics seed ${i + 1}`,
        ]
      );

      // Create incidents + notifications for the logistics order
      if ((i % 2) === 0) {
        const incidentId = makeUuid(8, i, 1);
        const incType = pick(incidentTypes, i);
        const severity = pick(severities, i);

        await client.query(
          `INSERT INTO public.incidents
           (id, tenant_id, logistics_order_id, incident_type, severity, title, description,
            location_description, latitude, longitude, occurred_at,
            municipality_name, notes, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,
                   $8,$9,$10,
                   $11,$12,$13,'open',NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            incidentId,
            tenantId,
            logisticsOrderId,
            incType,
            severity,
            `Incidencia ${incType}`,
            `Descripción seed_expandida: ${incType} / ${severity}`,
            `Ubicación ${i + 1}`,
            6.2 + (i % 10) * 0.01,
            -75.6 + (i % 10) * 0.01,
            nowIsoPlusDays(-1 + (i % 3)),
            "Municipio",
            `seed inc ${i + 1}`,
          ]
        );

        for (let k = 0; k < INCIDENTAL_NOTIFICATIONS_FACTOR; k++) {
          const notificationId = makeUuid(9, i, k + 1);
          const channel = pick(notificationChannels, i + k);

          await client.query(
            `INSERT INTO public.notifications
             (id, tenant_id, incident_id, logistics_order_id,
              notification_channel, recipient_label, title, message,
              scheduled_for, status, metadata, created_at)
             VALUES ($1,$2,$3,$4,
                     $5,$6,$7,$8,
                     $9,'pending',$10,NOW())
             ON CONFLICT (id) DO NOTHING`,
            [
              notificationId,
              tenantId,
              incidentId,
              logisticsOrderId,
              channel,
              `destinatario-${i + 1}-${k + 1}`,
              `Alerta: ${incType}`,
              `Se detectó una incidencia (${severity}) para orden ${logisticsOrderId}`,
              nowIsoPlusDays(0),
              JSON.stringify({ seed: "seed_expanded", k }),
            ]
          );
        }
      }
    }

    // ===== 5) Extended modules coverage (optional tables if migrations were applied) =====
    const firstTenantCode = tenantDefs[0].code;
    const firstTenantId = tenantsByCode.get(firstTenantCode)!;
    const firstTenantName = tenantDefs[0].name;
    const baseProducerId = producerIds[0]?.[0];
    const baseDemandId = demandRefs[0]?.demandId;
    const baseOfferId = offerRefs[0]?.offerId;
    const baseLogisticsId = logisticsOrderIds[0];

    const roleAdminEmail = `role.admin_municipal.${firstTenantCode.toLowerCase()}@agrored.co`;
    const roleProducerEmail = `role.producer.${firstTenantCode.toLowerCase()}@agrored.co`;
    const roleKitchenEmail = `role.community_kitchen.${firstTenantCode.toLowerCase()}@agrored.co`;

    const roleAdmin = await client.query<{ id: string }>(
      `SELECT id FROM public.users WHERE email = $1 LIMIT 1`,
      [roleAdminEmail]
    );
    const roleProducer = await client.query<{ id: string }>(
      `SELECT id FROM public.users WHERE email = $1 LIMIT 1`,
      [roleProducerEmail]
    );
    const roleKitchen = await client.query<{ id: string }>(
      `SELECT id FROM public.users WHERE email = $1 LIMIT 1`,
      [roleKitchenEmail]
    );

    // automation_runs
    await client.query(
      `INSERT INTO public.automation_runs
       (id, tenant_id, incident_id, logistics_order_id, trigger_source, model_version, classification, status, actions, metrics_snapshot, notes, metadata, created_at)
       VALUES ($1,$2,$3,$4,'incident_monitor','heuristic-v2','high','generated',$5,$6,$7,$8,NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        makeUuid(0x30, 0, 1),
        firstTenantId,
        makeUuid(8, 0, 1),
        baseLogisticsId ?? null,
        JSON.stringify([{ type: "notify", target: "ops" }, { type: "reroute" }]),
        JSON.stringify({ openIncidents: 2, activeLogistics: 1 }),
        "seed coverage automation",
        JSON.stringify({ seed: "seed_expanded" })
      ]
    );

    // recursos + tracking + delivery events (if logistics tracking migration exists)
    const hasRecursos = await tableExists(client, "public.recursos");
    if (hasRecursos) {
      const recursoId = makeUuid(0x31, 0, 1);
      await client.query(
        `INSERT INTO public.recursos
         (id, tenant_id, user_id, nombre, tipo, placa, telefono, estado, latitude, longitude, metadata, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'vehiculo',$5,$6,'en_ruta',$7,$8,$9,NOW(),NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          recursoId,
          firstTenantId,
          roleAdmin.rows[0]?.id ?? null,
          "Camion Seed 01",
          "AGR-001",
          "3001112233",
          4.648625,
          -74.247894,
          JSON.stringify({ seed: true, zone: "urbana" })
        ]
      );

      const hasLogisticsResourceColumns =
        (await columnExists(client, "logistics_orders", "recurso_id")) &&
        (await columnExists(client, "logistics_orders", "pickup_at")) &&
        (await columnExists(client, "logistics_orders", "delivered_at"));

      if (hasLogisticsResourceColumns && baseLogisticsId) {
        await client.query(
          `UPDATE public.logistics_orders
           SET recurso_id = $1,
               pickup_at = COALESCE(pickup_at, NOW() - INTERVAL '2 hours'),
               delivered_at = COALESCE(delivered_at, NOW() - INTERVAL '30 minutes')
           WHERE id = $2`,
          [recursoId, baseLogisticsId]
        );
      }

      if (await tableExists(client, "public.tracking_actual")) {
        await client.query(
          `INSERT INTO public.tracking_actual
           (recurso_id, latitude, longitude, velocidad, bearing, evento, orden_id, actualizado_at)
           VALUES ($1,$2,$3,$4,$5,'en_transito',$6,NOW())
           ON CONFLICT (recurso_id) DO UPDATE
           SET latitude = EXCLUDED.latitude,
               longitude = EXCLUDED.longitude,
               velocidad = EXCLUDED.velocidad,
               bearing = EXCLUDED.bearing,
               evento = EXCLUDED.evento,
               orden_id = EXCLUDED.orden_id,
               actualizado_at = NOW()`,
          [recursoId, 4.650001, -74.248001, 38.5, 180, baseLogisticsId ?? null]
        );
      }

      if (await tableExists(client, "public.tracking_historial")) {
        await client.query(
          `INSERT INTO public.tracking_historial
           (recurso_id, orden_id, latitude, longitude, velocidad, precision_gps, bearing, evento, metadata, registrado_at)
           VALUES
             ($1,$2,4.649500,-74.248500,12.5,4.0,95,'inicio_ruta',$3,NOW() - INTERVAL '90 minutes'),
             ($1,$2,4.649900,-74.248200,24.2,3.0,120,'en_transito',$3,NOW() - INTERVAL '60 minutes'),
             ($1,$2,4.650100,-74.248000,10.1,3.5,170,'llegada_destino',$3,NOW() - INTERVAL '15 minutes')`,
          [recursoId, baseLogisticsId ?? null, JSON.stringify({ seed: true })]
        );
      }

      if (await tableExists(client, "public.delivery_events")) {
        await client.query(
          `INSERT INTO public.delivery_events
           (orden_id, recurso_id, evento, latitude, longitude, notas, evidencia_url, metadata, registrado_at)
           VALUES
             ($1,$2,'asignado',4.649400,-74.248700,'Asignacion seed',NULL,$3,NOW() - INTERVAL '95 minutes'),
             ($1,$2,'inicio_ruta',4.649500,-74.248500,'Salida a ruta',NULL,$3,NOW() - INTERVAL '90 minutes'),
             ($1,$2,'entregado',4.650100,-74.248000,'Entrega finalizada',NULL,$3,NOW() - INTERVAL '10 minutes')`,
          [baseLogisticsId ?? makeUuid(7, 0, 1), recursoId, JSON.stringify({ seed: true })]
        );
      }
    }

    // producer stats
    if (await tableExists(client, "public.estadisticas_productor")) {
      await client.query(
        `INSERT INTO public.estadisticas_productor
         (id, producer_id, tenant_id, cultivo, temporada, hectareas, toneladas, ingresos, costos, fecha_corte, created_at)
         VALUES
           ($1,$2,$3,'Papa criolla','2025-A',4.5,11.2,9000000,4200000,'2025-06-30',NOW()),
           ($4,$2,$3,'Zanahoria','2025-A',2.1,6.4,5100000,2300000,'2025-06-30',NOW())
         ON CONFLICT (producer_id, cultivo, temporada) DO NOTHING`,
        [
          makeUuid(0x32, 0, 1),
          baseProducerId ?? makeUuid(3, 0, 1),
          firstTenantId,
          makeUuid(0x32, 0, 2)
        ]
      );
    }

    // auctions + bids + audit
    if (await tableExists(client, "public.auctions")) {
      const auctionId = makeUuid(0x33, 0, 1);
      await client.query(
        `INSERT INTO public.auctions
         (id, tenant_id, producer_id, product_name, category, unit, quantity_kg, photo_url, harvest_date,
          shelf_life_hours, auction_type, base_price, reserve_price, currency, duration_minutes,
          starts_at, ends_at, current_price, visibility_phase, visibility_radius_km, latitude, longitude,
          municipality_name, extension_count, max_extensions, dutch_step_percent, dutch_step_minutes,
          status, created_at, updated_at)
         VALUES
         ($1,$2,$3,'Papa criolla','tuberculo','kg',280,NULL,NOW() - INTERVAL '24 hours',72,'ascending',1200,900,'COP',180,
          NOW() - INTERVAL '120 minutes',NOW() + INTERVAL '60 minutes',1300,'phase_2',80,4.6488,-74.2479,
          $4,0,5,NULL,NULL,'active',NOW(),NOW())
         ON CONFLICT (id) DO NOTHING`,
        [auctionId, firstTenantId, baseProducerId ?? makeUuid(3, 0, 1), firstTenantName]
      );

      if (await tableExists(client, "public.auction_bids")) {
        await client.query(
          `INSERT INTO public.auction_bids
           (id, auction_id, bidder_id, bidder_type, amount, max_proxy_amount, is_proxy, social_score, distance_km, latitude, longitude, status, created_at)
           VALUES
             ($1,$2,$3,'community_kitchen',1300,NULL,FALSE,72,5.4,4.6501,-74.2490,'active',NOW() - INTERVAL '45 minutes'),
             ($4,$2,$5,'operator',1380,1500,TRUE,81,7.2,4.6520,-74.2500,'active',NOW() - INTERVAL '20 minutes')
           ON CONFLICT (id) DO NOTHING`,
          [
            makeUuid(0x34, 0, 1),
            auctionId,
            roleKitchen.rows[0]?.id ?? roleAdmin.rows[0]?.id ?? makeUuid(2, 0, 1),
            makeUuid(0x34, 0, 2),
            roleAdmin.rows[0]?.id ?? roleProducer.rows[0]?.id ?? makeUuid(2, 0, 2)
          ]
        );
      }

      if (await tableExists(client, "public.auction_audit_log")) {
        await client.query(
          `INSERT INTO public.auction_audit_log
           (id, auction_id, event_type, actor_id, payload, created_at)
           VALUES
             ($1,$2,'auction_published',$3,$4,NOW() - INTERVAL '110 minutes'),
             ($5,$2,'bid_placed',$6,$7,NOW() - INTERVAL '20 minutes')
           ON CONFLICT (id) DO NOTHING`,
          [
            makeUuid(0x35, 0, 1),
            auctionId,
            roleProducer.rows[0]?.id ?? roleAdmin.rows[0]?.id ?? null,
            JSON.stringify({ basePrice: 1200 }),
            makeUuid(0x35, 0, 2),
            roleKitchen.rows[0]?.id ?? roleAdmin.rows[0]?.id ?? null,
            JSON.stringify({ amount: 1300 })
          ]
        );
      }
    }

    // incident extensions + social/institutional/logistics-intelligent module tables
    const baseIncidentId = makeUuid(8, 0, 1);
    if (await columnExists(client, "incidents", "reported_by")) {
      await client.query(
        `UPDATE public.incidents
         SET reported_by = COALESCE(reported_by, 'Operador territorial'),
             reporter_role = COALESCE(reporter_role, 'territorial_analyst'),
             affected_population = COALESCE(affected_population, 120),
             affected_community = COALESCE(affected_community, 'Comunidad Norte'),
             assigned_to = COALESCE(assigned_to, 'Equipo Respuesta 1'),
             priority_score = COALESCE(priority_score, 84.5),
             recurrence_count = COALESCE(recurrence_count, 1)
         WHERE id = $1`,
        [baseIncidentId]
      );
    }

    if (await tableExists(client, "public.incident_actions")) {
      await client.query(
        `INSERT INTO public.incident_actions
         (id, incident_id, action_type, performed_by, description, metadata, created_at)
         VALUES
           ($1,$2,'assign','admin_municipal','Asignacion inicial de incidente',$3,NOW() - INTERVAL '50 minutes'),
           ($4,$2,'intervene','logistics_operator','Intervencion en punto de entrega',$3,NOW() - INTERVAL '20 minutes')
         ON CONFLICT (id) DO NOTHING`,
        [makeUuid(0x36, 0, 1), baseIncidentId, JSON.stringify({ seed: true }), makeUuid(0x36, 0, 2)]
      );
    }

    if (await tableExists(client, "public.incident_alerts")) {
      await client.query(
        `INSERT INTO public.incident_alerts
         (id, tenant_id, alert_type, severity, title, description, zone_name, incident_count, is_acknowledged, metadata, created_at)
         VALUES ($1,$2,'critical_risk','high','Alerta crítica de riesgo','Incremento de incidencias críticas en zona prioritaria','Zona Centro',4,FALSE,$3,NOW())
         ON CONFLICT (id) DO NOTHING`,
        [makeUuid(0x37, 0, 1), firstTenantId, JSON.stringify({ seed: true })]
      );
    }

    if (await tableExists(client, "public.food_programs")) {
      const programId = makeUuid(0x38, 0, 1);
      await client.query(
        `INSERT INTO public.food_programs
         (id, tenant_id, name, program_type, description, target_population, current_coverage, budget_allocated, budget_executed,
          responsible_name, responsible_email, municipality_name, status, starts_at, ends_at, metadata, created_at, updated_at)
         VALUES
         ($1,$2,'Programa Nutricion Escolar','programa_escolar','Cobertura alimentaria para instituciones educativas',500,320,150000000,92000000,
          'Coordinacion Social', 'programas@agrored.co',$3,'active',CURRENT_DATE - INTERVAL '60 days',CURRENT_DATE + INTERVAL '120 days',$4,NOW(),NOW())
         ON CONFLICT (id) DO NOTHING`,
        [programId, firstTenantId, firstTenantName, JSON.stringify({ seed: true })]
      );

      if (await tableExists(client, "public.beneficiaries")) {
        await client.query(
          `INSERT INTO public.beneficiaries
           (id, tenant_id, program_id, full_name, document_id, document_type, age, gender, socioeconomic_level,
            risk_classification, nutritional_status, municipality_name, zone_name, address,
            latitude, longitude, contact_phone, is_active, metadata, created_at, updated_at)
           VALUES
             ($1,$2,$3,'Ana Beneficiaria','10203040','CC',34,'F',2,'alto','normal',$4,'Zona Centro','Direccion 1',4.6502,-74.2482,'3002003001',TRUE,$5,NOW(),NOW()),
             ($6,$2,$3,'Luis Beneficiario','50607080','CC',41,'M',1,'critico','desnutricion_aguda',$4,'Zona Norte','Direccion 2',4.6511,-74.2492,'3002003002',TRUE,$5,NOW(),NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            makeUuid(0x39, 0, 1),
            firstTenantId,
            programId,
            firstTenantName,
            JSON.stringify({ seed: true }),
            makeUuid(0x39, 0, 2)
          ]
        );
      }

      if (await tableExists(client, "public.program_deliveries")) {
        await client.query(
          `INSERT INTO public.program_deliveries
           (id, program_id, beneficiary_id, tenant_id, product_name, category, quantity, unit, delivered_by,
            delivery_date, municipality_name, evidence_url, notes, status, metadata, created_at)
           VALUES
             ($1,$2,$3,$4,'Canasta Basica','cereal',25,'kg','Operador 1',CURRENT_DATE - 1,$5,NULL,'Entrega semanal','completed',$6,NOW())
           ON CONFLICT (id) DO NOTHING`,
          [makeUuid(0x3a, 0, 1), programId, makeUuid(0x39, 0, 1), firstTenantId, firstTenantName, JSON.stringify({ seed: true })]
        );
      }
    }

    if (await tableExists(client, "public.institutional_alerts")) {
      await client.query(
        `INSERT INTO public.institutional_alerts
         (id, tenant_id, alert_type, severity, title, description, indicator_name, indicator_value,
          threshold_value, zone_name, is_acknowledged, auto_generated, metadata, created_at)
         VALUES
         ($1,$2,'desabastecimiento','high','Riesgo de desabastecimiento','Oferta por debajo de la demanda proyectada',
          'supply_ratio',42,50,'Zona Centro',FALSE,TRUE,$3,NOW())
         ON CONFLICT (id) DO NOTHING`,
        [makeUuid(0x3b, 0, 1), firstTenantId, JSON.stringify({ seed: true })]
      );
    }

    if (await tableExists(client, "public.coordination_tasks")) {
      await client.query(
        `INSERT INTO public.coordination_tasks
         (id, tenant_id, actor_type, actor_name, task_description, assigned_to, status, priority, due_date, notes, metadata, created_at, updated_at)
         VALUES
         ($1,$2,'operador_logistico','Operador Aliado','Coordinar ruta de recoleccion para oferta perecedera','Equipo Logistica','in_progress','high',CURRENT_DATE + 1,'Task seed',$3,NOW(),NOW())
         ON CONFLICT (id) DO NOTHING`,
        [makeUuid(0x3c, 0, 1), firstTenantId, JSON.stringify({ seed: true })]
      );
    }

    if (await tableExists(client, "public.route_plans")) {
      const routePlanId = makeUuid(0x3d, 0, 1);
      await client.query(
        `INSERT INTO public.route_plans
         (id, tenant_id, plan_name, plan_type, recurso_id, total_stops, total_distance_km, estimated_duration_min,
          total_load_kg, max_capacity_kg, window_start, window_end, status, optimization_score, notes, metadata, created_at, updated_at)
         VALUES
         ($1,$2,'Ruta Seed Norte','mixta',$3,2,18.4,95,1200,2500,NOW() - INTERVAL '2 hours',NOW() + INTERVAL '4 hours',
          'optimized',87.5,'Plan generado por seed',$4,NOW(),NOW())
         ON CONFLICT (id) DO NOTHING`,
        [makeUuid(0x3d, 0, 1), firstTenantId, makeUuid(0x31, 0, 1), JSON.stringify({ seed: true })]
      );

      if (await tableExists(client, "public.route_stops")) {
        await client.query(
          `INSERT INTO public.route_stops
           (id, route_plan_id, stop_order, stop_type, location_name, address, latitude, longitude,
            logistics_order_id, estimated_arrival, estimated_departure, load_kg, status, notes, metadata, created_at)
           VALUES
             ($1,$2,1,'pickup','Centro de acopio','Bodega central',4.6498,-74.2486,$3,NOW() - INTERVAL '50 minutes',NOW() - INTERVAL '40 minutes',800,'completed','Recolectado',$4,NOW() - INTERVAL '40 minutes'),
             ($5,$2,2,'delivery','Destino institucional','Comedor principal',4.6507,-74.2481,$3,NOW() - INTERVAL '15 minutes',NOW() - INTERVAL '5 minutes',400,'arrived','En destino',$4,NOW() - INTERVAL '10 minutes')
           ON CONFLICT (id) DO NOTHING`,
          [
            makeUuid(0x3e, 0, 1),
            routePlanId,
            baseLogisticsId ?? null,
            JSON.stringify({ seed: true }),
            makeUuid(0x3e, 0, 2)
          ]
        );
      }
    }

    if (await tableExists(client, "public.geofence_zones")) {
      const geofenceId = makeUuid(0x3f, 0, 1);
      await client.query(
        `INSERT INTO public.geofence_zones
         (id, tenant_id, zone_name, zone_type, center_lat, center_lng, radius_m, is_active, metadata, created_at, updated_at)
         VALUES
         ($1,$2,'Zona Sensible Centro','critical',4.650000,-74.248000,450,TRUE,$3,NOW(),NOW())
         ON CONFLICT (id) DO NOTHING`,
        [geofenceId, firstTenantId, JSON.stringify({ seed: true })]
      );

      if (await tableExists(client, "public.geofence_events")) {
        await client.query(
          `INSERT INTO public.geofence_events
           (zone_id, recurso_id, event_type, latitude, longitude, metadata, created_at)
           VALUES
           ($1,$2,'enter',4.6501,-74.2481,$3,NOW() - INTERVAL '12 minutes')`,
          [geofenceId, makeUuid(0x31, 0, 1), JSON.stringify({ seed: true })]
        );
      }
    }

    if (await tableExists(client, "public.allocation_scenarios")) {
      await client.query(
        `INSERT INTO public.allocation_scenarios
         (id, tenant_id, scenario_name, description, budget_total, parameters, results, status, created_by, created_at, updated_at)
         VALUES
         ($1,$2,'Escenario Seed Baseline','Simulacion base de asignacion',250000000,$3,$4,'completed','admin_municipal',NOW(),NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          makeUuid(0x40, 0, 1),
          firstTenantId,
          JSON.stringify({ objective: "maximize_coverage", constraints: { maxRoutes: 12 } }),
          JSON.stringify({ coveragePct: 78.4, unmetDemandKg: 320 })
        ]
      );
    }

    if (await tableExists(client, "public.alert_thresholds")) {
      await client.query(
        `INSERT INTO public.alert_thresholds (id, tenant_id, rule_key, value, description, updated_by, updated_at)
         VALUES
           ($1,$2,'incident.zone_min_count',3,'Minimo de incidencias por zona para alertar','seed-script',NOW()),
           ($3,$2,'institutional.irat_high',60,'Umbral alto de IRAT','seed-script',NOW())
         ON CONFLICT (tenant_id, rule_key) DO UPDATE
         SET value = EXCLUDED.value,
             description = EXCLUDED.description,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()`,
        [makeUuid(0x41, 0, 1), firstTenantId, makeUuid(0x41, 0, 2)]
      );
    }

    if (await tableExists(client, "public.vrp_solutions")) {
      const vrpSolutionId = makeUuid(0x42, 0, 1);
      await client.query(
        `INSERT INTO public.vrp_solutions
         (id, tenant_id, scenario_name, depot_lat, depot_lng, strategy, status, total_vehicles_used,
          total_distance_km, total_duration_min, total_load_kg, unserved_stops, routing_engine, metadata, created_by, created_at)
         VALUES
         ($1,$2,'VRP Seed MultiVehiculo',4.6489,-74.2478,'clarke_wright','completed',2,34.7,160,1400,0,'haversine',$3,'seed-script',NOW())
         ON CONFLICT (id) DO NOTHING`,
        [vrpSolutionId, firstTenantId, JSON.stringify({ seed: true })]
      );

      if (await tableExists(client, "public.vrp_vehicle_routes")) {
        await client.query(
          `INSERT INTO public.vrp_vehicle_routes
           (id, vrp_solution_id, vehicle_index, recurso_id, vehicle_label, capacity_kg, assigned_load_kg,
            distance_km, duration_min, stop_count, geometry, stop_order, created_at)
           VALUES
             ($1,$2,1,$3,'Vehiculo A',1500,800,18.2,80,3,NULL,$4,NOW()),
             ($5,$2,2,NULL,'Vehiculo B',1500,600,16.5,75,2,NULL,$4,NOW())
           ON CONFLICT (id) DO NOTHING`,
          [
            makeUuid(0x43, 0, 1),
            vrpSolutionId,
            makeUuid(0x31, 0, 1),
            JSON.stringify(["depot", "pickup-1", "delivery-1"]),
            makeUuid(0x43, 0, 2)
          ]
        );
      }
    }

    if (await tableExists(client, "public.spoilage_records")) {
      await client.query(
        `INSERT INTO public.spoilage_records
         (id, tenant_id, program_id, logistics_order_id, product_name, category, quantity_kg, spoilage_kg,
          spoilage_reason, stage, temperature_c, detected_at, detected_by, location_name, latitude, longitude,
          notes, metadata, created_at)
         VALUES
         ($1,$2,$3,$4,'Lechuga','hortaliza',300,24,'temperature','transport',11.5,NOW() - INTERVAL '3 hours',
          'inspector.seed','Punto control norte',4.6510,-74.2490,'Registro de merma para prueba',$5,NOW())
         ON CONFLICT (id) DO NOTHING`,
        [makeUuid(0x44, 0, 1), firstTenantId, makeUuid(0x38, 0, 1), baseLogisticsId ?? null, JSON.stringify({ seed: true })]
      );
    }

    if (await tableExists(client, "public.inventory_imports")) {
      await client.query(
        `INSERT INTO public.inventory_imports
         (id, tenant_id, filename, total_rows, success_count, error_count, errors, status, created_at)
         VALUES ($1,$2,'seed_inventory_batch.csv',12,12,0,'[]','completed',NOW())
         ON CONFLICT (id) DO NOTHING`,
        [makeUuid(0x45, 0, 1), firstTenantId]
      );
    }

    // audit log coverage
    await client.query(
      `INSERT INTO public.audit_log
       (id, tenant_id, service_name, entity_name, entity_id, action_name, actor_id, payload, created_at)
       VALUES
       ($1,$2,'seed-service','users',$3,'upsert_role_coverage',$4,$5,NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        makeUuid(0x46, 0, 1),
        firstTenantId,
        roleAdmin.rows[0]?.id ?? makeUuid(2, 0, 1),
        roleAdmin.rows[0]?.id ?? null,
        JSON.stringify({ seededRoles: [...new Set([...roles, ...legacyRoles])] })
      ]
    );

    console.log("\nSeeding completed ✅\n");

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM public.tenants) AS tenants,
        (SELECT COUNT(*) FROM public.users) AS users,
        (SELECT COUNT(*) FROM public.producers) AS producers,
        (SELECT COUNT(*) FROM public.offers) AS offers,
        (SELECT COUNT(*) FROM public.demands) AS demands,
        (SELECT COUNT(*) FROM public.inventory_items) AS inventory_items,
        (SELECT COUNT(*) FROM public.logistics_orders) AS logistics_orders,
        (SELECT COUNT(*) FROM public.incidents) AS incidents,
        (SELECT COUNT(*) FROM public.notifications) AS notifications,
        (SELECT COUNT(*) FROM public.automation_runs) AS automation_runs,
        (SELECT COUNT(*) FROM public.audit_log) AS audit_log
    `);

    console.log("Counts:", counts.rows[0]);
    console.log("\nSi deseas aumentar densidad: usa env vars (SEED_TENANTS, PRODUCERS_PER_TENANT, OFFERS_PER_PRODUCER, DEMANDS_PER_TENANT, etc.).");
  } finally {
    client.release();
    await pool.end();
  }
}

function tdName(code: string): string {
  const map: Record<string, string> = {
    BOGOTA: "Bogotá",
    MEDELLIN: "Medellín",
    CALI: "Cali",
    ENVIGADO: "Envigado",
    BUCARAMANGA: "Bucaramanga",
    PASTO: "Pasto",
  };
  return map[code] ?? code;
}

seed().catch((err) => {
  console.error("Seed expanded failed:", err);
  process.exit(1);
});

