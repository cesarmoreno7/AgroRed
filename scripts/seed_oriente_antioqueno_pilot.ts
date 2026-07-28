/**
 * Seed script — QA scale-out: 8 municipios restantes del Oriente Antioqueño
 * (Marinilla, El Carmen de Viboral, Guarne, La Ceja, El Retiro, San Vicente
 * Ferrer, El Santuario, El Peñol), siguiendo el mismo patrón validado en el
 * piloto de Rionegro (scripts/seed_rionegro_pilot.ts).
 *
 * Coordenadas de centro urbano aproximadas; veredas son nombres plausibles
 * para dar realismo geográfico pero NO fueron verificadas contra cartografía
 * DANE oficial — ver nota en el informe. Todo prefijado TEST_QA_<CODIGO>.
 *
 * Usage:
 *   npx tsx scripts/seed_oriente_antioqueno_pilot.ts
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

const SALT = Number(process.env.BCRYPT_SALT_ROUNDS ?? "10");
const roles = [
  "admin_municipal", "producer", "supermarket", "logistics_operator",
  "territorial_analyst", "community_kitchen", "monitoring_agent",
];

function uuidFromKey(key: string): string {
  const hash = createHash("md5").update(key).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
function nowIsoPlusDays(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString();
}
function jitter(base: number, seedIdx: number, spread = 0.03): number {
  const frac = ((seedIdx * 9301 + 49297) % 233280) / 233280;
  return base + (frac - 0.5) * 2 * spread;
}

const productsByCat: Record<string, string[]> = {
  tuberculo: ["Papa criolla", "Yuca", "Papa Suprema"],
  hortaliza: ["Lechuga", "Zanahoria", "Tomate chonto", "Repollo", "Cilantro"],
  fruta: ["Mora", "Fresa", "Tomate de árbol", "Aguacate Hass", "Banano"],
  lacteo: ["Queso campesino", "Leche cruda", "Kumis"],
  carnico: ["Pollo campesino", "Cerdo"],
  huevo: ["Huevo AA", "Huevo campesino"],
};
const categories = Object.keys(productsByCat);

const producerNames = [
  { name: "María Elena Zapata", finca: "Finca La Esperanza" },
  { name: "José Fernando Gómez", finca: "Finca El Recreo" },
  { name: "Ana Cecilia Vélez", finca: "Finca Buenavista" },
  { name: "Luis Alberto Correa", finca: "Finca San Isidro" },
  { name: "Marta Cecilia Arango", finca: "Finca La Primavera" },
  { name: "Andrés Felipe Giraldo", finca: "Finca El Porvenir" },
  { name: "Claudia Inés Henao", finca: "Finca Los Naranjos" },
  { name: "Fabio Enrique Marín", finca: "Finca La Cabaña" },
];

interface MunicipioDef {
  code: string;
  name: string;
  center: { lat: number; lon: number };
  veredas: string[];
  operators: { key: string; org: string; contact: string }[];
  institutions: { key: string; type: string; name: string; contact: string; beneficiaries: number; cats: string[] }[];
}

const MUNICIPIOS: MunicipioDef[] = [
  {
    code: "MARINILLA", name: "Municipio de Marinilla",
    center: { lat: 6.1725, lon: -75.3378 },
    veredas: ["Vereda La Comarca", "Vereda La Motosa", "Vereda Montañas", "Vereda San José", "Vereda La Milagrosa", "Vereda Yarumal", "Vereda Cimarronas", "Vereda Barro Blanco"],
    operators: [
      { key: "asopromar", org: "Asociación de Productores Agrícolas de Marinilla (ASOPROMAR)", contact: "Gloria Inés Ramírez" },
      { key: "coopmarinilla", org: "Cooperativa Agropecuaria de Marinilla", contact: "Diego Alonso Vásquez" },
    ],
    institutions: [
      { key: "hospital", type: "hospital", name: "ESE Hospital San Juan de Dios de Marinilla", contact: "Dr. Mauricio Londoño", beneficiaries: 160, cats: ["hortaliza", "lacteo"] },
      { key: "comedor", type: "community_canteen", name: "Comedor Comunitario San José Marinilla", contact: "Beatriz Salazar", beneficiaries: 180, cats: ["tuberculo", "carnico"] },
      { key: "icbf", type: "educational", name: "ICBF CDI Semillitas de Marinilla", contact: "Paula Andrea Ruiz", beneficiaries: 85, cats: ["lacteo", "fruta"] },
      { key: "super", type: "other", name: "Supermercado El Ahorro Marinilla", contact: "Jorge Iván Palacio", beneficiaries: 250, cats: ["hortaliza", "tuberculo"] },
    ],
  },
  {
    code: "ELCARMEN", name: "Municipio de El Carmen de Viboral",
    center: { lat: 6.0836, lon: -75.3336 },
    veredas: ["Vereda La Madera", "Vereda Aldana", "Vereda Alto Grande", "Vereda La Chapa", "Vereda El Salto", "Vereda Cristales", "Vereda Samaria", "Vereda La Milagrosa"],
    operators: [
      { key: "asocarmen", org: "Asociación de Productores del Carmen de Viboral", contact: "Sandra Milena Ospina" },
      { key: "coopviboral", org: "Cooperativa Agrícola El Viboral", contact: "Hernán Darío Zuluaga" },
    ],
    institutions: [
      { key: "hospital", type: "hospital", name: "ESE Hospital San Vicente de Paúl El Carmen", contact: "Dra. Liliana Marín", beneficiaries: 150, cats: ["hortaliza", "fruta"] },
      { key: "comedor", type: "community_canteen", name: "Comedor Comunitario La Chapa", contact: "Rosa Elvira Duque", beneficiaries: 160, cats: ["tuberculo", "hortaliza"] },
      { key: "icbf", type: "educational", name: "ICBF CDI Carmelitas El Carmen", contact: "Natalia Restrepo", beneficiaries: 90, cats: ["lacteo", "huevo"] },
      { key: "super", type: "other", name: "Supermercado La Cosecha El Carmen", contact: "Óscar Iván Betancur", beneficiaries: 220, cats: ["hortaliza", "carnico"] },
    ],
  },
  {
    code: "GUARNE", name: "Municipio de Guarne",
    center: { lat: 6.2820, lon: -75.4419 },
    veredas: ["Vereda La Mosca", "Vereda El Salado", "Vereda Yolombal", "Vereda Guapante", "Vereda La Honda", "Vereda Chaparral", "Vereda La Hondita", "Vereda Piedras Blancas"],
    operators: [
      { key: "asoguarne", org: "Asociación de Productores de Guarne", contact: "Carlos Mario Bedoya" },
      { key: "coopguarne", org: "Cooperativa Agropecuaria de Guarne", contact: "Adriana Lucía Correa" },
    ],
    institutions: [
      { key: "hospital", type: "hospital", name: "ESE Hospital San Rafael de Guarne", contact: "Dr. Camilo Restrepo", beneficiaries: 140, cats: ["hortaliza", "lacteo"] },
      { key: "comedor", type: "community_canteen", name: "Comedor Comunitario El Salado Guarne", contact: "Marleny Tobón", beneficiaries: 170, cats: ["tuberculo", "carnico"] },
      { key: "icbf", type: "educational", name: "ICBF CDI Los Girasoles Guarne", contact: "Lorena Gómez", beneficiaries: 80, cats: ["huevo", "fruta"] },
      { key: "super", type: "other", name: "Supermercado San Isidro Guarne", contact: "Wilson Andrés Uribe", beneficiaries: 200, cats: ["hortaliza", "tuberculo"] },
    ],
  },
  {
    code: "LACEJA", name: "Municipio de La Ceja",
    center: { lat: 6.0311, lon: -75.4306 },
    veredas: ["Vereda La Playa", "Vereda El Tambo", "Vereda Guamito", "Vereda Fátima", "Vereda Barcelona", "Vereda San José", "Vereda La Milagrosa", "Vereda Chuscalito"],
    operators: [
      { key: "asolaceja", org: "Asociación de Floricultores y Productores de La Ceja", contact: "Yolanda Patricia Franco" },
      { key: "cooplaceja", org: "Cooperativa Agropecuaria La Ceja", contact: "Ricardo Antonio Montoya" },
    ],
    institutions: [
      { key: "hospital", type: "hospital", name: "ESE Hospital La Inmaculada de La Ceja", contact: "Dra. Sandra Milena Cano", beneficiaries: 170, cats: ["hortaliza", "fruta"] },
      { key: "comedor", type: "community_canteen", name: "Comedor Comunitario Barcelona La Ceja", contact: "Amparo Ríos", beneficiaries: 190, cats: ["tuberculo", "hortaliza"] },
      { key: "icbf", type: "educational", name: "ICBF CDI Pequeños Soñadores La Ceja", contact: "Vanessa Higuita", beneficiaries: 95, cats: ["lacteo", "huevo"] },
      { key: "super", type: "other", name: "Supermercado La Economía La Ceja", contact: "Jaime Alberto Quintero", beneficiaries: 260, cats: ["hortaliza", "carnico"] },
    ],
  },
  {
    code: "ELRETIRO", name: "Municipio de El Retiro",
    center: { lat: 6.0578, lon: -75.5058 },
    veredas: ["Vereda Pantanillo", "Vereda La Represa", "Vereda El Chispero", "Vereda Carrizales", "Vereda Don Diego", "Vereda La Amalia", "Vereda Higuerón", "Vereda Turín"],
    operators: [
      { key: "asoretiro", org: "Asociación de Productores Agroecológicos de El Retiro", contact: "Beatriz Elena Toro" },
      { key: "coopretiro", org: "Cooperativa Agropecuaria El Retiro", contact: "Germán Darío Vélez" },
    ],
    institutions: [
      { key: "hospital", type: "hospital", name: "ESE Hospital Gilberto Mejía Mejía El Retiro", contact: "Dr. Fabián Cardona", beneficiaries: 120, cats: ["hortaliza", "lacteo"] },
      { key: "comedor", type: "community_canteen", name: "Comedor Comunitario Pantanillo El Retiro", contact: "Consuelo Arias", beneficiaries: 140, cats: ["tuberculo", "fruta"] },
      { key: "icbf", type: "educational", name: "ICBF CDI Manitas Creativas El Retiro", contact: "Estefanía Loaiza", beneficiaries: 70, cats: ["huevo", "lacteo"] },
      { key: "super", type: "other", name: "Supermercado El Retiro Fresco", contact: "Nelson Fabián Zea", beneficiaries: 190, cats: ["hortaliza", "tuberculo"] },
    ],
  },
  {
    code: "SANVICENTE", name: "Municipio de San Vicente Ferrer",
    center: { lat: 6.2836, lon: -75.3319 },
    veredas: ["Vereda El Salado", "Vereda La Bretaña", "Vereda El Molino", "Vereda Concordia", "Vereda La Frisola", "Vereda Guamito", "Vereda El Charco", "Vereda Santa Bárbara"],
    operators: [
      { key: "asosanvicente", org: "Asociación de Productores de San Vicente Ferrer", contact: "Nubia Esperanza Álvarez" },
      { key: "coopsanvicente", org: "Cooperativa Agropecuaria San Vicente", contact: "Édison Mauricio Restrepo" },
    ],
    institutions: [
      { key: "hospital", type: "hospital", name: "ESE Hospital Nuestra Señora del Rosario San Vicente", contact: "Dra. Carolina Muñoz", beneficiaries: 110, cats: ["hortaliza", "fruta"] },
      { key: "comedor", type: "community_canteen", name: "Comedor Comunitario El Molino San Vicente", contact: "Fanny Yolanda Ortiz", beneficiaries: 130, cats: ["tuberculo", "carnico"] },
      { key: "icbf", type: "educational", name: "ICBF CDI Arcoíris San Vicente", contact: "Diana Marcela Peláez", beneficiaries: 65, cats: ["lacteo", "huevo"] },
      { key: "super", type: "other", name: "Supermercado San Vicente Central", contact: "Rubén Darío Aristizábal", beneficiaries: 170, cats: ["hortaliza", "tuberculo"] },
    ],
  },
  {
    code: "SANTUARIO", name: "Municipio de El Santuario",
    center: { lat: 6.1394, lon: -75.2617 },
    veredas: ["Vereda La Peña", "Vereda El Vergel", "Vereda Alto de la Virgen", "Vereda Los Salados", "Vereda El Roblal", "Vereda La Milagrosa", "Vereda Guamito", "Vereda La Linda"],
    operators: [
      { key: "asosantuario", org: "Asociación de Productores de El Santuario", contact: "Luz Dary Betancur" },
      { key: "coopsantuario", org: "Cooperativa Agropecuaria El Santuario", contact: "Álvaro de Jesús Cardona" },
    ],
    institutions: [
      { key: "hospital", type: "hospital", name: "ESE Hospital San Juan de Dios de El Santuario", contact: "Dr. Iván Darío Osorio", beneficiaries: 130, cats: ["hortaliza", "lacteo"] },
      { key: "comedor", type: "community_canteen", name: "Comedor Comunitario El Vergel Santuario", contact: "María Nelly Giraldo", beneficiaries: 150, cats: ["tuberculo", "hortaliza"] },
      { key: "icbf", type: "educational", name: "ICBF CDI Alegría Infantil El Santuario", contact: "Sara Milena Vanegas", beneficiaries: 75, cats: ["huevo", "fruta"] },
      { key: "super", type: "other", name: "Supermercado El Santuario Central", contact: "Fredy Alexánder Ramírez", beneficiaries: 200, cats: ["hortaliza", "carnico"] },
    ],
  },
  {
    code: "PENOL", name: "Municipio de El Peñol",
    center: { lat: 6.2186, lon: -75.2419 },
    veredas: ["Vereda Bonilla", "Vereda El Salto", "Vereda La Cristalina", "Vereda Los Naranjos", "Vereda Palestina", "Vereda La Sonadora", "Vereda Guamito", "Vereda El Uvital"],
    operators: [
      { key: "asopenol", org: "Asociación de Productores Piscícolas y Agrícolas de El Peñol", contact: "Martha Lucía Zuluaga" },
      { key: "cooppenol", org: "Cooperativa Agropecuaria El Peñol", contact: "Jhon Jairo Escobar" },
    ],
    institutions: [
      { key: "hospital", type: "hospital", name: "ESE Hospital San Rafael de El Peñol", contact: "Dra. Adriana Isaza", beneficiaries: 100, cats: ["hortaliza", "carnico"] },
      { key: "comedor", type: "community_canteen", name: "Comedor Comunitario Bonilla El Peñol", contact: "Gladys Estela Higuita", beneficiaries: 120, cats: ["tuberculo", "fruta"] },
      { key: "icbf", type: "educational", name: "ICBF CDI Peces de Colores El Peñol", contact: "Katherine Zapata", beneficiaries: 60, cats: ["lacteo", "huevo"] },
      { key: "super", type: "other", name: "Supermercado Embalse El Peñol", contact: "Norbey de Jesús Marín", beneficiaries: 180, cats: ["hortaliza", "tuberculo"] },
    ],
  },
];

async function tableExists(client: pg.PoolClient, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS exists`, [tableName]);
  return Boolean(result.rows[0]?.exists);
}

async function seedMunicipio(client: pg.PoolClient, m: MunicipioDef, hasInventory: boolean, hasInstitutions: boolean) {
  const TAG = `TEST_QA_${m.code}`;
  const counts = { producers: 0, offers: 0, institutions: 0, demands: 0, logisticsOrders: 0, incidents: 0, users: 0 };

  const tenantIdGuess = uuidFromKey(`tenant:${m.code}`);
  await client.query(
    `INSERT INTO public.tenants (id, code, name, type, status, metadata)
     VALUES ($1,$2,$3,'municipio','active',$4)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, status = 'active', updated_at = NOW()`,
    [tenantIdGuess, m.code, m.name, JSON.stringify({ scope: "qa-pilot-scaleout", tag: TAG })]
  );
  const tenantRow = await client.query<{ id: string }>(`SELECT id FROM public.tenants WHERE code = $1`, [m.code]);
  const tenantId = tenantRow.rows[0].id;

  const userIdByRole = new Map<string, string>();
  for (let r = 0; r < roles.length; r++) {
    const role = roles[r];
    const userId = uuidFromKey(`user:${m.code}:${role}`);
    const email = `role.${role}.${m.code.toLowerCase()}@agrored.co`;
    const passwordHash = await bcrypt.hash(`Role@${m.code}${r + 1}!`, SALT);
    await client.query(
      `INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, created_at)
       VALUES ($1,$2,$3,$4,$5,'active',$6,NOW())
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, status = 'active', password_hash = EXCLUDED.password_hash`,
      [userId, tenantId, email, `${TAG} Role ${role}`, role, passwordHash]
    );
    userIdByRole.set(role, userId);
    counts.users++;
  }
  const producer2UserId = uuidFromKey(`user:${m.code}:producer:2`);
  await client.query(
    `INSERT INTO public.users (id, tenant_id, email, full_name, role, status, password_hash, created_at)
     VALUES ($1,$2,$3,$4,'producer','active',$5,NOW())
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active'`,
    [producer2UserId, tenantId, `role.producer2.${m.code.toLowerCase()}@agrored.co`, `${TAG} Role producer 2`, await bcrypt.hash(`Role@${m.code}2B!`, SALT)]
  );
  counts.users++;

  const producerRefs: { id: string; orgName: string }[] = [];
  for (let i = 0; i < m.operators.length; i++) {
    const op = m.operators[i];
    const producerId = uuidFromKey(`producer:${m.code}:operator:${op.key}`);
    const linkedUser = i === 0 ? userIdByRole.get("producer")! : producer2UserId;
    await client.query(
      `INSERT INTO public.producers (id, tenant_id, user_id, producer_type, organization_name, contact_name, contact_phone, municipality_name, zone_type, product_categories, status, created_at)
       VALUES ($1,$2,$3,'association',$4,$5,$6,$7,'rural',$8,'active',NOW())
       ON CONFLICT (id) DO UPDATE SET organization_name = EXCLUDED.organization_name, status = 'active'`,
      [producerId, tenantId, linkedUser, `${TAG} ${op.org}`, op.contact, `301${String(1000000 + i).padStart(7, "0")}`.slice(0, 10), m.name, categories.slice(0, 3)]
    );
    producerRefs.push({ id: producerId, orgName: op.org });
    counts.producers++;
  }
  for (let i = 0; i < producerNames.length; i++) {
    const p = producerNames[i];
    const producerId = uuidFromKey(`producer:${m.code}:individual:${i}`);
    const orgName = `${TAG} ${p.finca} — ${m.veredas[i % m.veredas.length]}`;
    await client.query(
      `INSERT INTO public.producers (id, tenant_id, user_id, producer_type, organization_name, contact_name, contact_phone, municipality_name, zone_type, product_categories, status, created_at)
       VALUES ($1,$2,$3,'individual',$4,$5,$6,$7,'rural',$8,'active',NOW())
       ON CONFLICT (id) DO UPDATE SET organization_name = EXCLUDED.organization_name, status = 'active'`,
      [producerId, tenantId, producer2UserId, orgName, p.name, `301${String(2000000 + i * 37).padStart(7, "0")}`.slice(0, 10), m.name, [categories[i % categories.length], categories[(i + 2) % categories.length]]]
    );
    producerRefs.push({ id: producerId, orgName });
    counts.producers++;
  }

  const offerRefs: { id: string }[] = [];
  for (let pi = 0; pi < producerRefs.length; pi++) {
    const prod = producerRefs[pi];
    for (let o = 0; o < 4; o++) {
      const cat = categories[(pi + o) % categories.length];
      const productName = productsByCat[cat][(pi + o) % productsByCat[cat].length];
      const offerId = uuidFromKey(`offer:${m.code}:${pi}:${o}`);
      const qty = 150 + ((pi + o) % 8) * 40;
      const price = 1800 + ((pi + o) % 10) * 700;
      await client.query(
        `INSERT INTO public.offers (id, tenant_id, producer_id, title, product_name, category, unit, quantity_available, price_amount, currency, available_from, available_until, municipality_name, notes, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,'kg',$7,$8,'COP',$9,$10,$11,$12,'published',NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'published'`,
        [offerId, tenantId, prod.id, `${TAG} ${productName} — ${prod.orgName}`, productName, cat, qty, price, nowIsoPlusDays(-1), nowIsoPlusDays(10), m.name, `${TAG} lat:${jitter(m.center.lat, pi).toFixed(6)} lon:${jitter(m.center.lon, pi + 50).toFixed(6)}`]
      );
      offerRefs.push({ id: offerId });
      counts.offers++;
      if (hasInventory) {
        const invId = uuidFromKey(`inventory:${m.code}:${pi}:${o}`);
        await client.query(
          `INSERT INTO public.inventory_items (id, tenant_id, producer_id, offer_id, rescue_id, source_type, storage_location_name, product_name, category, unit, quantity_on_hand, quantity_reserved, municipality_name, notes, status, created_at)
           VALUES ($1,$2,$3,$4,NULL,'offer',$5,$6,$7,'kg',$8,0,$9,$10,'available',NOW())
           ON CONFLICT (id) DO NOTHING`,
          [invId, tenantId, prod.id, offerId, `Acopio ${m.veredas[pi % m.veredas.length]}`, productName, cat, qty, m.name, `${TAG} inventario para oferta`]
        );
      }
    }
  }

  const institutionRefs: { id: string; name: string }[] = [];
  for (const inst of m.institutions) {
    const institutionId = uuidFromKey(`institution:${m.code}:${inst.key}`);
    if (hasInstitutions) {
      await client.query(
        `INSERT INTO public.institutions (id, tenant_id, institution_type, name, contact_name, contact_phone, municipality_name, beneficiary_count, product_categories, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'active'`,
        [institutionId, tenantId, inst.type, `${TAG} ${inst.name}`, inst.contact, `302${String(1000000).padStart(7, "0")}`.slice(0, 10), m.name, inst.beneficiaries, inst.cats]
      );
    }
    institutionRefs.push({ id: institutionId, name: `${TAG} ${inst.name}` });
    counts.institutions++;
    for (let d = 0; d < inst.cats.length; d++) {
      const cat = inst.cats[d];
      const productName = productsByCat[cat][d % productsByCat[cat].length];
      const demandId = uuidFromKey(`demand:${m.code}:${inst.key}:${d}`);
      await client.query(
        `INSERT INTO public.demands (id, tenant_id, responsible_user_id, demand_channel, organization_name, product_name, category, unit, quantity_required, needed_by, beneficiary_count, municipality_name, institution_id, status, created_at)
         VALUES ($1,$2,$3,'institutional',$4,$5,$6,'kg',$7,$8,$9,$10,$11,'open',NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'open'`,
        [demandId, tenantId, userIdByRole.get("community_kitchen")!, `${TAG} ${inst.name}`, productName, cat, 100 + d * 40, nowIsoPlusDays(14), inst.beneficiaries, m.name, hasInstitutions ? institutionId : null]
      );
      counts.demands++;
    }
  }

  const hasLogistics = await tableExists(client, "public.logistics_orders");
  if (hasLogistics && hasInventory && offerRefs.length > 0 && institutionRefs.length > 0) {
    for (let i = 0; i < 2 && i < offerRefs.length; i++) {
      const invId = uuidFromKey(`inventory:${m.code}:${i}:0`);
      const logisticsOrderId = uuidFromKey(`logistics:${m.code}:${i}`);
      const dest = institutionRefs[i % institutionRefs.length];
      await client.query(
        `INSERT INTO public.logistics_orders (id, tenant_id, inventory_item_id, demand_id, route_mode, origin_location_name, destination_organization_name, destination_address, scheduled_pickup_at, scheduled_delivery_at, quantity_assigned, municipality_name, notes, status, created_at)
         VALUES ($1,$2,$3,NULL,'municipal_fleet',$4,$5,$6,$7,$8,$9,$10,$11,'scheduled',NOW())
         ON CONFLICT (id) DO UPDATE SET status = 'scheduled'`,
        [logisticsOrderId, tenantId, invId, `Centro de acopio ${m.veredas[i % m.veredas.length]}`, dest.name, `${dest.name}, ${m.name}`, nowIsoPlusDays(1), nowIsoPlusDays(2), 120 + i * 30, m.name, `${TAG} orden logística base`]
      );
      counts.logisticsOrders++;
    }
  }

  const hasIncidents = await tableExists(client, "public.incidents");
  if (hasIncidents) {
    const incidentId = uuidFromKey(`incident:${m.code}:baseline`);
    await client.query(
      `INSERT INTO public.incidents (id, tenant_id, logistics_order_id, incident_type, severity, title, description, location_description, latitude, longitude, occurred_at, municipality_name, notes, status, created_at)
       VALUES ($1,$2,NULL,'access_blockage','low',$3,$4,$5,$6,$7,$8,$9,$10,'open',NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'open'`,
      [incidentId, tenantId, `${TAG} Mantenimiento vial parcial`, `${TAG} Mantenimiento programado reduce a un carril el acceso rural. Tráfico lento, sin bloqueo total.`, `Vía rural - ${m.name}, km 3`, jitter(m.center.lat, 99), jitter(m.center.lon, 100), nowIsoPlusDays(0), m.name, `${TAG} incidente base de contexto municipal (no crítico)`]
    );
    counts.incidents++;
  }

  return { code: m.code, tenantId, counts };
}

async function seed(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log(`Seeding AgroRed QA scale-out — 8 municipios Oriente Antioqueño...\n`);
    const hasInventory = await tableExists(client, "public.inventory_items");
    const hasInstitutions = await tableExists(client, "public.institutions");

    const results = [];
    for (const m of MUNICIPIOS) {
      const r = await seedMunicipio(client, m, hasInventory, hasInstitutions);
      results.push(r);
      console.log(`  ${r.code} (${r.tenantId}):`, r.counts);
    }
    console.log("\nSiembra completa.");
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("Fallo al sembrar municipios del Oriente Antioqueño:", err);
  process.exitCode = 1;
});
