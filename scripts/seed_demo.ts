/**
 * Seed script — Ambiente de DEMOSTRACION aislado (kit comercial / guion de alcaldias
 * y operadores del PAE).
 *
 * Resuelve tres puntos del informe de accesos:
 *   1. Trazabilidad Ley 2046 "condicional": crea entregas_productos + entregas_detalle
 *      del anio en curso para el tenant de demo, de modo que el panel
 *      /alerts -> "Cumplimiento Ley 2046 de 2020" muestre un porcentaje >= 30 %
 *      (mezcla de productores is_small_producer TRUE/FALSE => ~55-65 %, no un 100 % plano).
 *   2. Aislamiento: todo vive en un tenant dedicado (code = DEMO por defecto),
 *      separado del piloto de Rionegro y de los tenants de seed genericos.
 *      Todos los registros llevan el prefijo DEMO_.
 *   3. Credenciales individuales por actor del guion, rol de solo consulta
 *      (territorial_analyst = "Analista Territorial") y vigencia de 30 dias
 *      (users.expires_at, migracion 035_demo_access_expiry.sql).
 *
 * Idempotente: UUIDs deterministicos + ON CONFLICT. Reejecutar rota las claves
 * temporales y reinicia la ventana de 30 dias.
 *
 * Uso:
 *   npx tsx scripts/seed_demo.ts
 *
 * Env (opcionales; mismos defaults que el resto de seeds):
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, DATABASE_URL
 *   DEMO_TENANT_CODE   (default: DEMO)
 *   DEMO_ACCESS_DAYS   (default: 30)
 *
 * NO commitear la salida: las claves temporales se imprimen solo en STDOUT.
 */

import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";

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

const TENANT_CODE = (process.env.DEMO_TENANT_CODE ?? "DEMO").toUpperCase();
const TENANT_NAME = "AGRORED - Ambiente de Demostracion";
const ACCESS_DAYS = Number(process.env.DEMO_ACCESS_DAYS ?? "30");
const SALT = Number(process.env.BCRYPT_SALT_ROUNDS ?? "10");
const TAG = "DEMO_";
const YEAR = new Date().getUTCFullYear();

/** UUID (v4-shaped) determinista a partir de una clave natural estable. */
function uuidFromKey(key: string): string {
  const h = createHash("md5").update(`${TENANT_CODE}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Clave temporal fuerte, distinta por usuario, sin caracteres ambiguos para dictado. */
function tempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const raw = randomBytes(12);
  let out = "";
  for (const b of raw) out += alphabet[b % alphabet.length];
  return `Demo-${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}!`;
}

async function tableExists(client: pg.PoolClient, name: string): Promise<boolean> {
  const r = await client.query<{ exists: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS exists`, [name]);
  return Boolean(r.rows[0]?.exists);
}

async function columnExists(client: pg.PoolClient, table: string, column: string): Promise<boolean> {
  const r = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS exists`,
    [table, column]
  );
  return Boolean(r.rows[0]?.exists);
}

// ── Catalogo de referencia del ambiente demo ────────────────────────────────
const PRODUCTS = [
  { key: "papa", name: `${TAG}Papa criolla`, category: "tuberculo" },
  { key: "tomate", name: `${TAG}Tomate chonto`, category: "hortaliza" },
  { key: "frijol", name: `${TAG}Frijol cargamanto`, category: "leguminosa" },
  { key: "zanahoria", name: `${TAG}Zanahoria`, category: "hortaliza" },
  { key: "leche", name: `${TAG}Leche cruda`, category: "lacteo" },
];

// 8 productores; los 3 ultimos NO son pequenos productores (para Ley 2046).
const PRODUCERS = [
  { key: "p1", org: `${TAG}Finca La Esperanza`, muni: "Marinilla", lat: 6.1739, lng: -75.3376, small: true },
  { key: "p2", org: `${TAG}Asociacion Agro El Carmen`, muni: "El Carmen de Viboral", lat: 6.0826, lng: -75.3339, small: true },
  { key: "p3", org: `${TAG}Finca Villa Luz`, muni: "La Ceja", lat: 6.0289, lng: -75.4318, small: true },
  { key: "p4", org: `${TAG}Huerta El Progreso`, muni: "Guarne", lat: 6.2799, lng: -75.4419, small: true },
  { key: "p5", org: `${TAG}Finca Buenavista`, muni: "El Santuario", lat: 6.1382, lng: -75.2657, small: true },
  { key: "p6", org: `${TAG}Comercializadora Oriente S.A.S.`, muni: "Rionegro", lat: 6.1550, lng: -75.3738, small: false },
  { key: "p7", org: `${TAG}Distribuidora Valle de San Nicolas`, muni: "Rionegro", lat: 6.1600, lng: -75.3800, small: false },
  { key: "p8", org: `${TAG}Agroindustrias del Altiplano Ltda.`, muni: "La Union", lat: 5.9739, lng: -75.3607, small: false },
];

const INSTITUTIONS = [
  { key: "i1", type: "educational", name: `${TAG}I.E. Rural San Jose`, muni: "Marinilla", beneficiaries: 420 },
  { key: "i2", type: "community_canteen", name: `${TAG}Comedor Comunitario El Porvenir`, muni: "La Ceja", beneficiaries: 180 },
  { key: "i3", type: "hospital", name: `${TAG}Hospital San Juan de Dios`, muni: "Rionegro", beneficiaries: 260 },
];

// ── Actores del guion -> usuarios individuales de solo consulta ─────────────
const DEMO_USERS = [
  { slug: "desarrollo-economico", fullName: `${TAG}Secretaria de Desarrollo Economico`, note: "Guion seccion 2" },
  { slug: "planeacion", fullName: `${TAG}Secretaria de Planeacion`, note: "Guion seccion 3.2" },
  { slug: "desarrollo-social", fullName: `${TAG}Secretaria de Desarrollo Social / PAE municipal`, note: "Guion seccion 1 (fila 4)" },
  { slug: "operador-pae-calidad", fullName: `${TAG}Operador PAE - Coordinacion de Calidad / Interventoria`, note: "Guion seccion 9.3" },
];

async function seed(): Promise<void> {
  const client = await pool.connect();
  const created = { producers: 0, offers: 0, institutions: 0, demands: 0, entregas: 0, detalle: 0, users: 0 };

  try {
    console.log(`\nSeeding ambiente de DEMOSTRACION (tenant ${TENANT_CODE})...\n`);

    // 1) Tenant dedicado ----------------------------------------------------
    const tenantId = uuidFromKey("tenant");
    await client.query(
      `INSERT INTO public.tenants (id, code, name, type, status, metadata)
       VALUES ($1, $2, $3, 'municipio', 'active', $4)
       ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name, status = 'active', metadata = EXCLUDED.metadata, updated_at = NOW()`,
      [tenantId, TENANT_CODE, TENANT_NAME, JSON.stringify({ scope: "demo", tag: TAG, region: "Oriente Antioqueno" })]
    );
    const tRow = await client.query<{ id: string }>(`SELECT id FROM public.tenants WHERE code = $1`, [TENANT_CODE]);
    const TENANT_ID = tRow.rows[0].id;
    console.log(`  tenant ${TENANT_CODE} -> ${TENANT_ID}`);

    // 2) Catalogo de productos -------------------------------------------------
    const productIdByKey = new Map<string, string>();
    const hasCatalog = await tableExists(client, "public.product_catalog");
    for (const p of PRODUCTS) {
      const id = uuidFromKey(`product:${p.key}`);
      if (hasCatalog) {
        await client.query(
          `INSERT INTO public.product_catalog (id, tenant_id, name, category, unit, is_active)
           VALUES ($1, $2, $3, $4, 'kg', TRUE)
           ON CONFLICT (name, tenant_id) DO UPDATE SET is_active = TRUE`,
          [id, TENANT_ID, p.name, p.category]
        );
      }
      productIdByKey.set(p.key, id);
    }

    // 3) Productores ---------------------------------------------------------
    const hasSmallCol = await columnExists(client, "producers", "is_small_producer");
    const producerIdByKey = new Map<string, string>();
    for (let i = 0; i < PRODUCERS.length; i++) {
      const p = PRODUCERS[i];
      const id = uuidFromKey(`producer:${p.key}`);
      const cats = [PRODUCTS[i % PRODUCTS.length].category, PRODUCTS[(i + 2) % PRODUCTS.length].category];
      await client.query(
        `INSERT INTO public.producers
           (id, tenant_id, user_id, producer_type, organization_name, contact_name, contact_phone,
            municipality_name, zone_type, product_categories, status, latitude, longitude, created_at)
         VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,'rural',$8,'active',$9,$10, NOW())
         ON CONFLICT (id) DO UPDATE
           SET organization_name = EXCLUDED.organization_name,
               municipality_name = EXCLUDED.municipality_name,
               latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, status = 'active'`,
        [
          id, TENANT_ID,
          p.small ? "individual" : "association",
          p.org, `${TAG}Contacto ${i + 1}`, `30000000${i + 1}`.slice(0, 10),
          p.muni, Array.from(new Set(cats)), p.lat, p.lng,
        ]
      );
      if (hasSmallCol) {
        await client.query(`UPDATE public.producers SET is_small_producer = $2 WHERE id = $1`, [id, p.small]);
      }
      producerIdByKey.set(p.key, id);
      created.producers++;
    }

    // 4) Ofertas (para el modulo Mercado) ----------------------------------
    for (let i = 0; i < PRODUCERS.length; i++) {
      const p = PRODUCERS[i];
      const producerId = producerIdByKey.get(p.key)!;
      for (let o = 0; o < 2; o++) {
        const prod = PRODUCTS[(i + o) % PRODUCTS.length];
        const id = uuidFromKey(`offer:${p.key}:${o}`);
        await client.query(
          `INSERT INTO public.offers
             (id, tenant_id, producer_id, title, product_name, category, unit,
              quantity_available, price_amount, currency, available_from, available_until,
              municipality_name, notes, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,'kg',$7,$8,'COP', NOW() - INTERVAL '5 days', NOW() + INTERVAL '20 days',
                   $9,$10,'published', NOW())
           ON CONFLICT (id) DO UPDATE SET status = 'published', quantity_available = EXCLUDED.quantity_available`,
          [
            id, TENANT_ID, producerId,
            `${prod.name} - lote ${o + 1}`, prod.name, prod.category,
            300 + o * 120, 1800 + ((i + o) % 5) * 350,
            p.muni, `${TAG}oferta demo`,
          ]
        );
        created.offers++;
      }
    }

    // 5) Instituciones ----------------------------------------------------
    const institutionIdByKey = new Map<string, string>();
    for (const inst of INSTITUTIONS) {
      const id = uuidFromKey(`institution:${inst.key}`);
      await client.query(
        `INSERT INTO public.institutions
           (id, tenant_id, institution_type, name, contact_name, contact_phone,
            municipality_name, beneficiary_count, product_categories, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active', NOW())
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name, status = 'active', beneficiary_count = EXCLUDED.beneficiary_count`,
        [
          id, TENANT_ID, inst.type, inst.name, `${TAG}Coordinacion`, "3040000000",
          inst.muni, inst.beneficiaries, ["tuberculo", "hortaliza", "leguminosa"],
        ]
      );
      institutionIdByKey.set(inst.key, id);
      created.institutions++;
    }

    // 6) Demandas (Mercado: oferta vs demanda) ---------------------------
    for (let d = 0; d < 4; d++) {
      const inst = INSTITUTIONS[d % INSTITUTIONS.length];
      const prod = PRODUCTS[d % PRODUCTS.length];
      const id = uuidFromKey(`demand:${d}`);
      await client.query(
        `INSERT INTO public.demands
           (id, tenant_id, demand_channel, organization_name, product_name, category, unit,
            quantity_required, needed_by, beneficiary_count, municipality_name, status, created_at)
         VALUES ($1,$2,'institutional',$3,$4,$5,'kg',$6, NOW() + INTERVAL '12 days', $7,$8,'open', NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'open', quantity_required = EXCLUDED.quantity_required`,
        [id, TENANT_ID, inst.name, prod.name, prod.category, 200 + d * 60, inst.beneficiaries, inst.muni]
      );
      created.demands++;
    }

    // 7) Incidencia + ruta de rescate (modulo Alertas e incidencias) -----
    const incidentId = uuidFromKey("incident:1");
    await client.query(
      `INSERT INTO public.incidents
         (id, tenant_id, incident_type, severity, title, description, location_description,
          latitude, longitude, occurred_at, municipality_name, notes, status, created_at)
       VALUES ($1,$2,'route_blockage','high',$3,$4,$5,6.1739,-75.3376, NOW() - INTERVAL '2 days',
               'Marinilla',$6,'open', NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'open', severity = 'high'`,
      [
        incidentId, TENANT_ID,
        `${TAG}Via terciaria bloqueada - retraso en entrega`,
        `${TAG}Derrumbe en la via a la vereda; se activa ruta alterna para no perder la entrega institucional.`,
        "Km 4 via Marinilla - vereda La Esperanza",
        `${TAG}incidencia demo con ruta de rescate asociada`,
      ]
    );
    if (await tableExists(client, "public.rescues")) {
      await client.query(
        `INSERT INTO public.rescues
           (id, tenant_id, producer_id, rescue_channel, destination_organization_name,
            product_name, category, unit, quantity_rescued, scheduled_at, beneficiary_count,
            municipality_name, notes, status, created_at)
         VALUES ($1,$2,$3,'redistribucion',$4,$5,'tuberculo','kg',180, NOW() + INTERVAL '1 day', 420,
                 'Marinilla',$6,'scheduled', NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'scheduled'`,
        [
          uuidFromKey("rescue:1"), TENANT_ID, producerIdByKey.get("p1"),
          INSTITUTIONS[0].name, `${PRODUCTS[0].name}`,
          `${TAG}rescate por incidencia ${incidentId}`,
        ]
      );
    }

    // 8) Entregas del anio en curso -> Trazabilidad Ley 2046 --------------
    //    6 entregas por institucion, ciclando por los 8 productores (5 pequenos
    //    + 3 no pequenos) => valor local ~= 60 % del total, estado 'recibido',
    //    fecha dentro de [YEAR-01-01, hoy].
    const hasEntregas =
      (await tableExists(client, "public.entregas_productos")) &&
      (await tableExists(client, "public.entregas_detalle"));

    if (!hasEntregas) {
      console.warn("  ! Tablas entregas_productos/entregas_detalle ausentes: se omite Ley 2046. Corre 'npm run migrate'.");
    } else {
      let n = 0;
      for (let ii = 0; ii < INSTITUTIONS.length; ii++) {
        const institutionId = institutionIdByKey.get(INSTITUTIONS[ii].key)!;
        for (let k = 0; k < 6; k++) {
          n++;
          const pIdx = (ii * 6 + k) % PRODUCERS.length;
          const producerId = producerIdByKey.get(PRODUCERS[pIdx].key)!;
          const prod = PRODUCTS[(ii + k) % PRODUCTS.length];
          const month = 2 + ((ii * 6 + k) % 6); // febrero..julio
          const day = 5 + (k * 3) % 20;
          const fecha = `${YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const numero = `DEMO-${YEAR}-${String(n).padStart(4, "0")}`;
          const entregaId = uuidFromKey(`entrega:${numero}`);

          await client.query(
            `INSERT INTO public.entregas_productos
               (id, numero_entrega, productor_id, institucion_id, fecha_entrega, lugar_entrega,
                recibido_por, estado, created_at)
             VALUES ($1,$2,$3,$4,$5::date,$6,$7,'recibido', NOW())
             ON CONFLICT (numero_entrega) DO UPDATE
               SET estado = 'recibido', fecha_entrega = EXCLUDED.fecha_entrega`,
            [entregaId, numero, producerId, institutionId, fecha, `${INSTITUTIONS[ii].muni} - bodega`, `${TAG}Almacen`]
          );
          created.entregas++;

          const qty = 120 + ((n * 37) % 260);            // 120..380 kg
          const price = 1600 + ((n * 53) % 1400);          // 1600..3000 COP/kg
          await client.query(
            `INSERT INTO public.entregas_detalle
               (id, entrega_id, producto_id, cantidad_entregada, unidad_medida, precio_unitario)
             VALUES ($1,$2,$3,$4,'kg',$5)
             ON CONFLICT (id) DO UPDATE
               SET cantidad_entregada = EXCLUDED.cantidad_entregada, precio_unitario = EXCLUDED.precio_unitario`,
            [uuidFromKey(`detalle:${numero}`), entregaId, productIdByKey.get(prod.key), qty, price]
          );
          created.detalle++;
        }
      }
    }

    // 9) Usuarios individuales de solo consulta, vigencia 30 dias ---------
    const hasExpiresCol = await columnExists(client, "users", "expires_at");
    if (!hasExpiresCol) {
      console.warn("  ! Columna users.expires_at ausente: se crean los usuarios SIN vencimiento. Corre 'npm run migrate' (035_demo_access_expiry.sql).");
    }
    const issued: { email: string; password: string; fullName: string; note: string }[] = [];
    for (const u of DEMO_USERS) {
      const email = `demo.${u.slug}@agrored.co`;
      const password = tempPassword();
      const hash = await bcrypt.hash(password, SALT);
      const id = uuidFromKey(`user:${u.slug}`);

      if (hasExpiresCol) {
        await client.query(
          `INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, expires_at, created_at)
           VALUES ($1,$2,$3,$4,'territorial_analyst','active',$5, NOW() + ($6 || ' days')::interval, NOW())
           ON CONFLICT (email) DO UPDATE
             SET password_hash = EXCLUDED.password_hash,
                 role = 'territorial_analyst',
                 status = 'active',
                 tenant_id = EXCLUDED.tenant_id,
                 full_name = EXCLUDED.full_name,
                 expires_at = NOW() + ($6 || ' days')::interval,
                 deleted_at = NULL,
                 updated_at = NOW()`,
          [id, TENANT_ID, email, u.fullName, hash, String(ACCESS_DAYS)]
        );
      } else {
        await client.query(
          `INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, created_at)
           VALUES ($1,$2,$3,$4,'territorial_analyst','active',$5, NOW())
           ON CONFLICT (email) DO UPDATE
             SET password_hash = EXCLUDED.password_hash, role = 'territorial_analyst',
                 status = 'active', tenant_id = EXCLUDED.tenant_id, full_name = EXCLUDED.full_name,
                 deleted_at = NULL, updated_at = NOW()`,
          [id, TENANT_ID, email, u.fullName, hash]
        );
      }
      issued.push({ email, password, fullName: u.fullName, note: u.note });
      created.users++;
    }

    // ── Verificacion Ley 2046 (mismo calculo que el panel) ──────────────
    let ley2046Line = "  Ley 2046: (sin tablas de entregas)";
    if (hasEntregas && hasSmallCol) {
      const r = await client.query<{ total: string; local: string }>(
        `SELECT
           COALESCE(SUM(d.cantidad_entregada * d.precio_unitario), 0) AS total,
           COALESCE(SUM(d.cantidad_entregada * d.precio_unitario) FILTER (WHERE p.is_small_producer), 0) AS local
         FROM public.institutions i
         JOIN public.entregas_productos e
           ON e.institucion_id = i.id AND e.estado IN ('recibido','parcial')
          AND e.fecha_entrega BETWEEN $2 AND $3 AND e.deleted_at IS NULL
         JOIN public.entregas_detalle d ON d.entrega_id = e.id
         JOIN public.producers p ON p.id = e.productor_id
         WHERE i.tenant_id = $1 AND i.deleted_at IS NULL`,
        [TENANT_ID, `${YEAR}-01-01`, new Date().toISOString().slice(0, 10)]
      );
      const total = Number(r.rows[0]?.total ?? 0);
      const local = Number(r.rows[0]?.local ?? 0);
      const pct = total > 0 ? Math.round((local / total) * 1000) / 10 : 0;
      ley2046Line = `  Ley 2046: compra local = ${pct}%  (umbral 30%)  ${pct >= 30 ? "CUMPLE" : "NO CUMPLE"}`;
    } else if (hasEntregas) {
      ley2046Line = "  Ley 2046: entregas cargadas; % se calcula en el panel (falta columna is_small_producer -> corre migraciones)";
    }

    // ── Salida ─────────────────────────────────────────────────────────
    console.log("\nRegistros creados/actualizados:", created);
    console.log(ley2046Line);
    console.log("\n================  ACCESOS DE DEMOSTRACION  ================");
    console.log(`URL:     https://web-dashboard-production-c9b4.up.railway.app`);
    console.log(`Tenant:  ${TENANT_CODE} (${TENANT_NAME})`);
    console.log(`Perfil:  Analista Territorial (territorial_analyst) - solo consulta`);
    console.log(`Vigencia: ${hasExpiresCol ? `${ACCESS_DAYS} dias calendario (expira automaticamente)` : "SIN vencimiento automatico (falta migracion 035)"}`);
    console.log("----------------------------------------------------------");
    for (const u of issued) {
      console.log(`  ${u.email}`);
      console.log(`    clave:  ${u.password}`);
      console.log(`    actor:  ${u.fullName.replace(TAG, "")}  [${u.note}]`);
    }
    console.log("==========================================================");
    console.log("NO guardes esta salida en el repo. Entrega la tabla directamente a quien envia los correos.\n");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("seed_demo failed:", err);
  process.exit(1);
});
