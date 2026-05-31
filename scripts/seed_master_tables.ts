/**
 * seed_master_tables.ts — populates every AgroRed table with 10 rows each.
 * Idempotent: all inserts use ON CONFLICT DO NOTHING / DO UPDATE.
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx scripts/seed_master_tables.ts
 */

import pg from "pg";
import bcrypt from "bcrypt";

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? "agrored",
  user: process.env.POSTGRES_USER ?? "777",
  password: process.env.POSTGRES_PASSWORD ?? "777",
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// ── helpers ──────────────────────────────────────────────────────────────────
function u(hex: string) { return hex; } // UUID literal pass-through

// ── Fixed IDs ─────────────────────────────────────────────────────────────────
// Tenants (4 exist; add 6 new)
const T: Record<string,string> = {
  BOGOTA:     "10000000-0000-0000-0000-000000000001",
  RIONEGRO:   "10000000-0000-0000-0000-000000000002",
  SANTAROSA:  "10000000-0000-0000-0000-000000000003",
  SANROQUE:   "10000000-0000-0000-0000-000000000004",
  MEDELLIN:   "10000000-0000-0000-0000-000000000005",
  CALI:       "10000000-0000-0000-0000-000000000006",
  BQUILLA:    "10000000-0000-0000-0000-000000000007",
  CARTAGENA:  "10000000-0000-0000-0000-000000000008",
  BUCARAMANGA:"10000000-0000-0000-0000-000000000009",
  PEREIRA:    "10000000-0000-0000-0000-000000000010",
};

// Users (base ones already exist; add 5 more)
const U: Record<string,string> = {
  ADMIN:     "50000000-0000-0000-0000-000000000001",
  PROD:      "50000000-0000-0000-0000-000000000002",
  OPER:      "50000000-0000-0000-0000-000000000003",
  ANALIST:   "50000000-0000-0000-0000-000000000004",
  COCINA:    "50000000-0000-0000-0000-000000000005",
  U6:        "50000000-0000-0000-0000-000000000006",
  U7:        "50000000-0000-0000-0000-000000000007",
  U8:        "50000000-0000-0000-0000-000000000008",
  U9:        "50000000-0000-0000-0000-000000000009",
  U10:       "50000000-0000-0000-0000-000000000010",
};

// Producers
const P: Record<string,string> = {
  P1: "20000000-0000-0000-0000-000000000001",
  P2: "21000000-0000-0000-0000-000000000001",
  P3: "21000000-0000-0000-0000-000000000002",
  P4: "22000000-0000-0000-0000-000000000001",
  P5: "22000000-0000-0000-0000-000000000002",
  P6: "23000000-0000-0000-0000-000000000001",
  P7: "23000000-0000-0000-0000-000000000002",
  P8: "20000000-0000-0000-0000-000000000008",
  P9: "20000000-0000-0000-0000-000000000009",
  P10:"20000000-0000-0000-0000-000000000010",
};

// Offers
const O: Record<string,string> = {};
for (let i=1; i<=10; i++) O[`O${i}`] = `30000000-0000-0000-0000-00000000000${i}`.replace("000000000","0".repeat(11-i.toString().length));
// cleaner:
const OFF = Array.from({length:10},(_,i)=>`30000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Food Origins
const ORIG = Array.from({length:10},(_,i)=>`a0000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Institutions
const INST = Array.from({length:10},(_,i)=>`b0000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Demands
const DEM = Array.from({length:10},(_,i)=>`40000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Rescues
const RES = Array.from({length:10},(_,i)=>`c0000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Inventory items
const INV = Array.from({length:10},(_,i)=>`d0000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Recursos (vehicles/operators)
const REC = Array.from({length:10},(_,i)=>`e0000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Logistics orders
const LOG = Array.from({length:10},(_,i)=>`f0000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Incidents
const INC = Array.from({length:10},(_,i)=>`11000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Notifications
const NOT_ = Array.from({length:10},(_,i)=>`12000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Auctions
const AUC = Array.from({length:10},(_,i)=>`13000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Bids
const BID = Array.from({length:10},(_,i)=>`14000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Food programs
const FP = Array.from({length:10},(_,i)=>`15000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Beneficiaries
const BEN = Array.from({length:10},(_,i)=>`16000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Program deliveries
const PD = Array.from({length:10},(_,i)=>`17000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Route plans
const RP = Array.from({length:10},(_,i)=>`18000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Geofence zones
const GZ = Array.from({length:10},(_,i)=>`19000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Allocation scenarios
const AS_ = Array.from({length:10},(_,i)=>`1a000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// VRP solutions
const VRP = Array.from({length:10},(_,i)=>`1b000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// VRP routes
const VRPR = Array.from({length:10},(_,i)=>`1c000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Spoilage records
const SP = Array.from({length:10},(_,i)=>`1d000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Automation runs
const AR = Array.from({length:10},(_,i)=>`1e000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Estadisticas productor
const EP = Array.from({length:10},(_,i)=>`1f000000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Inventory imports
const II = Array.from({length:10},(_,i)=>`20100000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Alert thresholds
const AT_ = Array.from({length:10},(_,i)=>`20200000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Coordination tasks
const CT = Array.from({length:10},(_,i)=>`20300000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Incident alerts
const IA = Array.from({length:10},(_,i)=>`20400000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Institutional alerts
const INAL = Array.from({length:10},(_,i)=>`20500000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Incident actions
const INAC = Array.from({length:10},(_,i)=>`20600000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Institution status history
const ISH = Array.from({length:10},(_,i)=>`20700000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Auction audit log
const AAL = Array.from({length:10},(_,i)=>`20800000-0000-0000-0000-${String(i+1).padStart(12,"0")}`);

// Tenants data
const tenantRows = [
  { id: T.MEDELLIN,    name: "Medellín",          code: "MEDELLIN",    lat: 6.2518,   lng: -75.5636 },
  { id: T.CALI,        name: "Cali",               code: "CALI",        lat: 3.4516,   lng: -76.5320 },
  { id: T.BQUILLA,     name: "Barranquilla",       code: "BARRANQUILLA",lat: 10.9685,  lng: -74.7813 },
  { id: T.CARTAGENA,   name: "Cartagena",          code: "CARTAGENA",   lat: 10.3910,  lng: -75.4794 },
  { id: T.BUCARAMANGA, name: "Bucaramanga",        code: "BUCARAMANGA", lat: 7.1254,   lng: -73.1198 },
  { id: T.PEREIRA,     name: "Pereira",            code: "PEREIRA",     lat: 4.8087,   lng: -75.6906 },
];

const tenantIds = Object.values(T);
const muni = (i:number) => ["Bogotá D.C.","Rionegro","Santa Rosa de Osos","San Roque","Medellín","Cali","Barranquilla","Cartagena","Bucaramanga","Pereira"][i%10];
const lat  = (i:number) => [4.6097,6.1549,6.6492,6.4783,6.2518,3.4516,10.9685,10.3910,7.1254,4.8087][i%10];
const lng  = (i:number) => [-74.0817,-75.3747,-75.4608,-74.9944,-75.5636,-76.5320,-74.7813,-75.4794,-73.1198,-75.6906][i%10];

async function run() {
  const client = await pool.connect();
  try {
    console.log("=== AgroRed master-tables seed ===\n");

    // ── 1. TENANTS ──────────────────────────────────────────────────────────
    for (const t of tenantRows) {
      await client.query(`
        INSERT INTO public.tenants (id, name, code, type, status, metadata)
        VALUES ($1,$2,$3,'municipio','active',$4)
        ON CONFLICT (id) DO NOTHING
      `, [t.id, t.name, t.code, JSON.stringify({ lat: t.lat, lng: t.lng })]);
    }
    console.log("✓ tenants (10)");

    // ── 2. USERS (add 5 extra beyond the seeded 5) ──────────────────────────
    const newUsers = [
      { id: U.U6,  tenantId: T.MEDELLIN,    email: "admin@medellin.agrored.co",    fullName: "Admin Medellín",       role: "admin_municipal" },
      { id: U.U7,  tenantId: T.CALI,        email: "producer@cali.agrored.co",     fullName: "Productor Cali",       role: "producer" },
      { id: U.U8,  tenantId: T.BQUILLA,     email: "operador@bquilla.agrored.co",  fullName: "Operador Barranquilla",role: "logistics_operator" },
      { id: U.U9,  tenantId: T.CARTAGENA,   email: "analista@cartagena.agrored.co",fullName: "Analista Cartagena",   role: "territorial_analyst" },
      { id: U.U10, tenantId: T.BUCARAMANGA, email: "cocina@bucaramanga.agrored.co",fullName: "Cocina Bucaramanga",   role: "community_kitchen" },
    ];
    const hash = await bcrypt.hash("Admin@1234!", 10);
    for (const u of newUsers) {
      await client.query(`
        INSERT INTO public.users (id, tenant_id, email, full_name, role, password_hash)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (email) DO NOTHING
      `, [u.id, u.tenantId, u.email, u.fullName, u.role, hash]);
    }
    console.log("✓ users (10 total)");

    // ── 3. FOOD ORIGINS ────────────────────────────────────────────────────
    const origNames = ["Bodega Central Norte","Centro Acopio Sur","Plaza Paloquemao","Mercado Kennedy",
      "Bodega Oriente","Centro Acopio Antioquia","Terminal Logístico Cali","Acopio Costa Atlántica",
      "Centro Distribución Santander","Bodega Eje Cafetero"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.food_origins (id, tenant_id, name, municipality_name, address, latitude, longitude)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (id) DO NOTHING
      `, [ORIG[i], tenantIds[i], origNames[i], muni(i), `Calle ${10+i} # ${5+i}-${20+i}`, lat(i), lng(i)]);
    }
    console.log("✓ food_origins (10)");

    // ── 4. PRODUCERS ──────────────────────────────────────────────────────
    const prodNames = ["Finca San Carlos","Finca La Primavera","Asociación AgroOriente","Finca El Paraíso",
      "Cooperativa Lechera Norte","Finca Agua Clara","Agrogroup Nordeste","Finca Las Palmas",
      "Cooperativa del Valle","Finca La Esperanza"];
    const prodIds = [P.P1,P.P2,P.P3,P.P4,P.P5,P.P6,P.P7,P.P8,P.P9,P.P10];
    const prodUsers = [U.PROD,U.U6,null,U.U7,null,U.U8,null,U.U9,null,U.U10];
    const cats = [["tuberculo","hortaliza"],["fruta","tuberculo"],["hortaliza","leguminosa"],
      ["tuberculo","leguminosa"],["lacteo","tuberculo"],["fruta","cacao"],["platano","yuca"],
      ["hortaliza","fruta"],["tuberculo","cereal"],["fruta","hortaliza"]];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.producers
          (id, tenant_id, user_id, producer_type, organization_name, contact_name, contact_phone,
           municipality_name, zone_type, product_categories, status, latitude, longitude)
        VALUES ($1,$2,$3,'individual',$4,$5,$6,$7,'rural',$8,'active',$9,$10)
        ON CONFLICT (id) DO NOTHING
      `, [prodIds[i], tenantIds[i], prodUsers[i], prodNames[i],
          `Contacto ${i+1}`, `310${5000000+i}`, muni(i), cats[i], lat(i)+0.01*i, lng(i)+0.01*i]);
    }
    console.log("✓ producers (10)");

    // ── 5. ESTADISTICAS_PRODUCTOR ──────────────────────────────────────────
    const cultivos = ["Papa criolla","Lechuga","Zanahoria","Tomate chonto","Plátano","Cacao","Yuca","Mango","Aguacate","Maíz"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.estadisticas_productor
          (id, producer_id, tenant_id, cultivo, temporada, hectareas, toneladas, ingresos, costos, fecha_corte)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (producer_id, cultivo, temporada) DO NOTHING
      `, [EP[i], prodIds[i], tenantIds[i], cultivos[i], "2024-A",
          (3+i*0.5).toFixed(1), (8+i).toFixed(1), (8000000+i*500000), (3000000+i*200000), `2024-06-${10+i}`]);
    }
    console.log("✓ estadisticas_productor (10)");

    // ── 6. OFFERS ─────────────────────────────────────────────────────────
    const prodNames2 = ["Papa criolla","Lechuga batavia","Zanahoria","Tomate chonto","Plátano hartón",
      "Cacao fino","Yuca blanca","Mango tommy","Aguacate hass","Maíz amarillo"];
    const catNames = ["tuberculo","hortaliza","hortaliza","hortaliza","fruta","cacao","tuberculo","fruta","fruta","cereal"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.offers
          (id, tenant_id, producer_id, title, product_name, category, unit,
           quantity_available, price_amount, currency, available_from, municipality_name, status, latitude, longitude)
        VALUES ($1,$2,$3,$4,$5,$6,'kg',$7,$8,'COP',NOW(),$9,'published',$10,$11)
        ON CONFLICT (id) DO NOTHING
      `, [OFF[i], tenantIds[i], prodIds[i], `${prodNames2[i]} lote ${String.fromCharCode(65+i)}`,
          prodNames2[i], catNames[i], (200+i*50), (700+i*100), muni(i), lat(i), lng(i)]);
    }
    console.log("✓ offers (10)");

    // ── 7. INSTITUTIONS ───────────────────────────────────────────────────
    const instTypes = ["educational","hospital","prison","community_canteen","airport",
      "military","elderly_home","shelter","educational","hospital"] as const;
    const instNames = ["IED Simón Bolívar","Hospital Santa Clara","Centro Penitenciario Norte",
      "Comedor Popular Sur","Aeropuerto El Dorado","Batallón de Infantería","Hogar del Adulto Mayor",
      "Albergue San José","Colegio Técnico Industrial","Clínica del Niño"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.institutions
          (id, tenant_id, institution_type, name, contact_name, contact_phone, municipality_name,
           beneficiary_count, product_categories, status, latitude, longitude, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11,$12)
        ON CONFLICT (id) DO NOTHING
      `, [INST[i], tenantIds[i], instTypes[i], instNames[i],
          `Director ${i+1}`, `320${6000000+i}`, muni(i),
          100+i*50, ["tuberculo","hortaliza","fruta"],
          lat(i)-0.005*i, lng(i)+0.005*i, U.ADMIN]);
    }
    console.log("✓ institutions (10)");

    // ── 8. DEMANDS ────────────────────────────────────────────────────────
    const demOrgs = ["Comedor Popular Sur","Escuela Rural Norte","Hospital Comunitario","PAE Zona Urbana",
      "Comedor Solidario Este","Casa de Paso","Jardín Infantil ICBF","Centro Día AM","Albergue Norte","Comedor Migrante"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.demands
          (id, tenant_id, responsible_user_id, institution_id, demand_channel, organization_name,
           product_name, category, unit, quantity_required, needed_by, beneficiary_count,
           municipality_name, status, latitude, longitude)
        VALUES ($1,$2,$3,$4,'community_kitchen',$5,$6,$7,'kg',$8,NOW()+INTERVAL '10 days',$9,$10,'open',$11,$12)
        ON CONFLICT (id) DO NOTHING
      `, [DEM[i], tenantIds[i], U.COCINA, INST[i], demOrgs[i],
          prodNames2[i], catNames[i], (100+i*30), (80+i*10), muni(i),
          lat(i)+0.02*i, lng(i)-0.02*i]);
    }
    console.log("✓ demands (10)");

    // ── 9. RESCUES ────────────────────────────────────────────────────────
    const rescChannels = ["comedor_popular","banco_alimentos","entidad_publica","ong","empresa_privada",
      "comedor_popular","banco_alimentos","entidad_publica","ong","empresa_privada"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.rescues
          (id, tenant_id, producer_id, offer_id, origin_id, rescue_channel, destination_organization_name,
           product_name, category, unit, quantity_rescued, scheduled_at, beneficiary_count,
           municipality_name, status, latitude, longitude)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'kg',$10,NOW()+INTERVAL '3 days',$11,$12,'scheduled',$13,$14)
        ON CONFLICT (id) DO NOTHING
      `, [RES[i], tenantIds[i], prodIds[i], OFF[i], ORIG[i], rescChannels[i],
          demOrgs[i], prodNames2[i], catNames[i], (50+i*20), (40+i*5), muni(i),
          lat(i), lng(i)]);
    }
    console.log("✓ rescues (10)");

    // ── 10. INVENTORY ITEMS ───────────────────────────────────────────────
    const srcTypes = ["offer","rescue","direct_purchase","donation","transfer",
      "offer","rescue","direct_purchase","donation","transfer"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.inventory_items
          (id, tenant_id, producer_id, offer_id, rescue_id, source_type, storage_location_name,
           product_name, category, unit, quantity_on_hand, municipality_name, status, latitude, longitude,
           expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'kg',$10,$11,'available',$12,$13,NOW()+INTERVAL '15 days')
        ON CONFLICT (id) DO NOTHING
      `, [INV[i], tenantIds[i], prodIds[i], OFF[i], RES[i], srcTypes[i],
          `Bodega ${origNames[i]}`, prodNames2[i], catNames[i], (80+i*15),
          muni(i), lat(i), lng(i)]);
    }
    console.log("✓ inventory_items (10)");

    // ── 11. RECURSOS (vehicles/operators) ────────────────────────────────
    const tipoRec = ["vehiculo","moto","bicicleta","vehiculo","domiciliario",
      "vehiculo","moto","bicicleta","vehiculo","otro"] as const;
    const placas  = ["ABC123","MN456",null,"DEF789",null,"GHI012","PQR345",null,"STU678",null];
    const recUsers= [U.OPER,U.U8,U.OPER,U.U8,U.OPER,U.U8,U.OPER,U.U8,U.OPER,U.U8];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.recursos
          (id, tenant_id, user_id, nombre, tipo, placa, telefono, estado,
           capacidad_kg, es_refrigerado, latitude, longitude)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'disponible',$8,$9,$10,$11)
        ON CONFLICT (id) DO NOTHING
      `, [REC[i], tenantIds[i], recUsers[i], `Recurso ${i+1} ${muni(i)}`,
          tipoRec[i], placas[i], `315${7000000+i}`,
          (500+i*100), i%3===0, lat(i), lng(i)]);
    }
    console.log("✓ recursos (10)");

    // ── 12. LOGISTICS ORDERS ─────────────────────────────────────────────
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.logistics_orders
          (id, tenant_id, inventory_item_id, demand_id, recurso_id, route_mode,
           origin_location_name, destination_organization_name, destination_address,
           scheduled_pickup_at, scheduled_delivery_at, quantity_assigned, municipality_name,
           status, origin_latitude, origin_longitude, destination_latitude, destination_longitude)
        VALUES ($1,$2,$3,$4,$5,'road',$6,$7,$8,
                NOW()+INTERVAL '1 day',NOW()+INTERVAL '2 days',$9,$10,'scheduled',
                $11,$12,$13,$14)
        ON CONFLICT (id) DO NOTHING
      `, [LOG[i], tenantIds[i], INV[i], DEM[i], REC[i],
          origNames[i], demOrgs[i], `Calle ${20+i} # ${3+i}-${10+i}`,
          (60+i*10), muni(i),
          lat(i), lng(i), lat(i)+0.03, lng(i)+0.03]);
    }
    console.log("✓ logistics_orders (10)");

    // ── 13. INCIDENTS ─────────────────────────────────────────────────────
    const incTypes = ["delay","damage","accident","theft","weather","vehicle_breakdown",
      "route_blocked","quality_issue","communication_failure","unauthorized_access"];
    const sevs = ["low","medium","high","critical","medium","low","high","medium","low","critical"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.incidents
          (id, tenant_id, logistics_order_id, incident_type, severity, title, description,
           location_description, latitude, longitude, occurred_at, municipality_name, status,
           reported_by, affected_population, priority_score)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),$11,'open',$12,$13,$14)
        ON CONFLICT (id) DO NOTHING
      `, [INC[i], tenantIds[i], LOG[i], incTypes[i], sevs[i],
          `Incidente ${incTypes[i]} en ${muni(i)}`,
          `Descripción detallada del incidente ${i+1} en la ruta de distribución`,
          `Zona ${muni(i)} sector ${i+1}`, lat(i), lng(i), muni(i),
          `Operador ${i+1}`, (5+i*3), (20+i*5).toFixed(2)]);
    }
    console.log("✓ incidents (10)");

    // ── 14. NOTIFICATIONS ─────────────────────────────────────────────────
    const channels = ["email","sms","push","email","sms","push","email","sms","push","email"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.notifications
          (id, tenant_id, incident_id, logistics_order_id, offer_id,
           notification_channel, recipient_label, title, message, scheduled_for, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()+INTERVAL '1 hour','pending')
        ON CONFLICT (id) DO NOTHING
      `, [NOT_[i], tenantIds[i], INC[i], LOG[i], OFF[i],
          channels[i], `Destinatario ${i+1}`,
          `Alerta: ${incTypes[i]} en ${muni(i)}`,
          `Se reportó un incidente de tipo ${incTypes[i]}. Por favor tomar acciones.`]);
    }
    console.log("✓ notifications (10)");

    // ── 15. AUTOMATION RUNS ───────────────────────────────────────────────
    const classif = ["critical","high","medium","low","critical","high","medium","low","critical","medium"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.automation_runs
          (id, tenant_id, incident_id, logistics_order_id, trigger_source, model_version,
           classification, status, actions, metrics_snapshot)
        VALUES ($1,$2,$3,$4,'incident_detected','heuristic-v2',$5,'generated',$6,$7)
        ON CONFLICT (id) DO NOTHING
      `, [AR[i], tenantIds[i], INC[i], LOG[i], classif[i],
          JSON.stringify([{ type: "notify", target: "operator" }, { type: "reschedule" }]),
          JSON.stringify({ incidents_open: i+1, avg_delay_min: 30+i*5 })]);
    }
    console.log("✓ automation_runs (10)");

    // ── 16. TRACKING HISTORIAL ────────────────────────────────────────────
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.tracking_historial
          (recurso_id, orden_id, latitude, longitude, velocidad, evento)
        VALUES ($1,$2,$3,$4,$5,'posicion')
      `, [REC[i], LOG[i], lat(i)+0.001*i, lng(i)+0.001*i, (40+i*5).toFixed(1)]);
    }
    console.log("✓ tracking_historial (10)");

    // ── 17. TRACKING ACTUAL ───────────────────────────────────────────────
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.tracking_actual (recurso_id, latitude, longitude, velocidad, evento, orden_id)
        VALUES ($1,$2,$3,$4,'en_transito',$5)
        ON CONFLICT (recurso_id) DO UPDATE
          SET latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, actualizado_at=NOW()
      `, [REC[i], lat(i)+0.002*i, lng(i)+0.002*i, (45+i*3).toFixed(1), LOG[i]]);
    }
    console.log("✓ tracking_actual (10)");

    // ── 18. DELIVERY EVENTS ────────────────────────────────────────────────
    const devEvts = ["asignado","aceptado","inicio_ruta","llegada_origen","recogida",
      "en_transito","llegada_destino","entregado","pausa","reanudacion"] as const;
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.delivery_events
          (orden_id, recurso_id, evento, latitude, longitude, notas)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [LOG[i], REC[i], devEvts[i], lat(i), lng(i), `Evento ${devEvts[i]} registrado`]);
    }
    console.log("✓ delivery_events (10)");

    // ── 19. AUCTIONS ──────────────────────────────────────────────────────
    const aucTypes = ["ascending","dutch","ascending","dutch","ascending",
      "dutch","ascending","dutch","ascending","dutch"] as const;
    for (let i=0; i<10; i++) {
      const base = 2000 + i * 500;
      await client.query(`
        INSERT INTO public.auctions
          (id, tenant_id, producer_id, product_name, category, unit, quantity_kg,
           harvest_date, shelf_life_hours, auction_type, base_price, reserve_price,
           duration_minutes, starts_at, ends_at, current_price, latitude, longitude,
           municipality_name, status,
           dutch_step_percent, dutch_step_minutes)
        VALUES ($1,$2,$3,$4,$5,'kg',$6,NOW()-INTERVAL '2 days',72,$7,$8,$9,
                240,NOW(),NOW()+INTERVAL '4 hours',$8,$10,$11,$12,'active',$13,$14)
        ON CONFLICT (id) DO NOTHING
      `, [AUC[i], tenantIds[i], prodIds[i], prodNames2[i], catNames[i], (100+i*20),
          aucTypes[i], base, Math.round(base*0.8),
          lat(i), lng(i), muni(i),
          aucTypes[i]==="dutch" ? 5 : null,
          aucTypes[i]==="dutch" ? 15 : null]);
    }
    console.log("✓ auctions (10)");

    // ── 20. AUCTION BIDS ──────────────────────────────────────────────────
    for (let i=0; i<10; i++) {
      const amount = 1800 + i * 450;
      await client.query(`
        INSERT INTO public.auction_bids
          (id, auction_id, bidder_id, bidder_type, amount, social_score, distance_km, status)
        VALUES ($1,$2,$3,'community_kitchen',$4,$5,$6,'active')
        ON CONFLICT (id) DO NOTHING
      `, [BID[i], AUC[i], U.COCINA, amount, (60+i*3).toFixed(1), (5+i*2).toFixed(1)]);
    }
    console.log("✓ auction_bids (10)");

    // ── 21. AUCTION AUDIT LOG ─────────────────────────────────────────────
    const aucEvts = ["auction_created","bid_placed","bid_outbid","auction_extended","bid_placed",
      "auction_closed","winner_selected","payment_confirmed","auction_created","bid_placed"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.auction_audit_log (id, auction_id, event_type, actor_id, payload)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO NOTHING
      `, [AAL[i], AUC[i], aucEvts[i], U.ADMIN,
          JSON.stringify({ amount: 2000+i*400, timestamp: new Date().toISOString() })]);
    }
    console.log("✓ auction_audit_log (10)");

    // ── 22. INCIDENT ACTIONS ──────────────────────────────────────────────
    const actTypes = ["notified","escalated","assigned","resolved","verified",
      "updated","closed","reopened","commented","transferred"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.incident_actions (id, incident_id, action_type, performed_by, description)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO NOTHING
      `, [INAC[i], INC[i], actTypes[i], `Supervisor ${i+1}`,
          `Acción ${actTypes[i]} ejecutada sobre el incidente`]);
    }
    console.log("✓ incident_actions (10)");

    // ── 23. INCIDENT ALERTS ────────────────────────────────────────────────
    const alertTypes = ["cluster_detected","high_frequency","zone_at_risk","recurrence","new_incident_type",
      "sla_breach","escalation_needed","auto_pattern","resource_shortage","weather_risk"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.incident_alerts
          (id, tenant_id, alert_type, severity, title, description, zone_name, incident_count)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO NOTHING
      `, [IA[i], tenantIds[i], alertTypes[i], sevs[i],
          `Alerta: ${alertTypes[i]} en ${muni(i)}`,
          `Se detectó ${alertTypes[i]} con ${i+2} incidentes en la zona`,
          `Zona ${muni(i)} ${i+1}`, i+2]);
    }
    console.log("✓ incident_alerts (10)");

    // ── 24. FOOD PROGRAMS ──────────────────────────────────────────────────
    const progTypes = ["comedores_comunitarios","pae","olla_comunitaria","banco_alimentos",
      "mercado_campesino","canasta_familiar","restaurante_popular","rescate_alimentario",
      "despensa_solidaria","abastecimiento_hospital"];
    const progNames = ["PAE Bogotá Norte","Comedor Sur Ciudad","Olla Común Rionegro",
      "Banco Alimentos Antioquia","Mercado Verde Cali","Canasta Familiar Barranquilla",
      "Rest. Popular Cartagena","Rescate Bucaramanga","Despensa Pereira","Hospital Bogotá"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.food_programs
          (id, tenant_id, name, program_type, description, target_population, current_coverage,
           budget_allocated, budget_executed, municipality_name, status,
           starts_at, ends_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',
                CURRENT_DATE-INTERVAL '30 days', CURRENT_DATE+INTERVAL '335 days')
        ON CONFLICT (id) DO NOTHING
      `, [FP[i], tenantIds[i], progNames[i], progTypes[i],
          `Programa de alimentación ${progNames[i]}`, (500+i*100), (400+i*80),
          (50000000+i*5000000), (35000000+i*3000000), muni(i)]);
    }
    console.log("✓ food_programs (10)");

    // ── 25. BENEFICIARIES ──────────────────────────────────────────────────
    const genders = ["masculino","femenino","masculino","femenino","no_binario",
      "masculino","femenino","masculino","femenino","masculino"];
    const riskCls = ["alto","medio","alto","bajo","critico","medio","alto","bajo","medio","critico"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.beneficiaries
          (id, tenant_id, program_id, full_name, document_id, document_type, age, gender,
           socioeconomic_level, risk_classification, municipality_name,
           contact_phone, latitude, longitude)
        VALUES ($1,$2,$3,$4,$5,'cedula',$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO NOTHING
      `, [BEN[i], tenantIds[i], FP[i], `Beneficiario ${i+1} ${muni(i)}`,
          `1000${i+1}`, (18+i*4), genders[i], (i%4)+1, riskCls[i], muni(i),
          `301${8000000+i}`, lat(i), lng(i)]);
    }
    console.log("✓ beneficiaries (10)");

    // ── 26. PROGRAM DELIVERIES ────────────────────────────────────────────
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.program_deliveries
          (id, program_id, beneficiary_id, tenant_id, product_name, category,
           quantity, unit, delivered_by, delivery_date, municipality_name, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'kg',$8,CURRENT_DATE-($9 * INTERVAL '1 day'),$10,'completed')
        ON CONFLICT (id) DO NOTHING
      `, [PD[i], FP[i], BEN[i], tenantIds[i], prodNames2[i], catNames[i],
          (10+i*5), `Repartidor ${i+1}`, i, muni(i)]);
    }
    console.log("✓ program_deliveries (10)");

    // ── 27. INSTITUTIONAL ALERTS ──────────────────────────────────────────
    const indNames = ["cobertura_pct","presupuesto_ejecutado","beneficiarios_activos",
      "entregas_semana","desperdicio_kg","tiempo_entrega_hrs","quejas_semana","nuevos_beneficiarios",
      "stock_disponible_dias","eficiencia_ruta_pct"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.institutional_alerts
          (id, tenant_id, alert_type, severity, title, description,
           indicator_name, indicator_value, threshold_value, zone_name)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (id) DO NOTHING
      `, [INAL[i], tenantIds[i], alertTypes[i], sevs[i],
          `Alerta institucional: ${indNames[i]}`,
          `El indicador ${indNames[i]} superó el umbral definido`,
          indNames[i], (50+i*5).toFixed(2), (60+i*3).toFixed(2), `Zona ${muni(i)}`]);
    }
    console.log("✓ institutional_alerts (10)");

    // ── 28. COORDINATION TASKS ────────────────────────────────────────────
    const taskDescs = ["Verificar ruta de distribución","Contactar proveedor","Actualizar inventario",
      "Revisar calidad producto","Coordinar logística","Notificar beneficiarios",
      "Gestionar incidente","Planificar semana","Reportar métricas","Capacitar operadores"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.coordination_tasks
          (id, tenant_id, actor_type, actor_name, task_description, assigned_to,
           status, priority, due_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE+($9 * INTERVAL '1 day'))
        ON CONFLICT (id) DO NOTHING
      `, [CT[i], tenantIds[i], "logistics_operator", `Operador ${muni(i)}`,
          taskDescs[i], `Supervisor ${i+1}`, i<5?"pending":"in_progress",
          i%3===0?"high":i%3===1?"medium":"low", i+3]);
    }
    console.log("✓ coordination_tasks (10)");

    // ── 29. ROUTE PLANS ────────────────────────────────────────────────────
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.route_plans
          (id, tenant_id, plan_name, plan_type, recurso_id, total_stops,
           total_distance_km, estimated_duration_min, total_load_kg, max_capacity_kg,
           window_start, window_end, status)
        VALUES ($1,$2,$3,'recoleccion',$4,$5,$6,$7,$8,$9,
                NOW()+INTERVAL '6 hours',NOW()+INTERVAL '14 hours','active')
        ON CONFLICT (id) DO NOTHING
      `, [RP[i], tenantIds[i], `Ruta ${muni(i)} día ${i+1}`, REC[i],
          (3+i), (15+i*2).toFixed(1), (60+i*8), (200+i*30), 500]);
    }
    console.log("✓ route_plans (10)");

    // ── 30. ROUTE STOPS ────────────────────────────────────────────────────
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.route_stops
          (id, route_plan_id, stop_order, stop_type, location_name, address,
           latitude, longitude, logistics_order_id, load_kg, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
        ON CONFLICT (id) DO NOTHING
      `, [`30900000-0000-0000-0000-${String(i+1).padStart(12,"0")}`,
          RP[i], i+1, i%2===0?"pickup":"delivery",
          origNames[i], `Cra ${10+i} # ${5+i}-${15+i}`,
          lat(i), lng(i), LOG[i], (50+i*20)]);
    }
    console.log("✓ route_stops (10)");

    // ── 31. GEOFENCE ZONES ────────────────────────────────────────────────
    const zoneTypes = ["delivery","pickup","restricted","monitoring","operational",
      "delivery","pickup","restricted","monitoring","operational"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.geofence_zones
          (id, tenant_id, zone_name, zone_type, center_lat, center_lng, radius_m, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,true)
        ON CONFLICT (id) DO NOTHING
      `, [GZ[i], tenantIds[i], `Zona ${zoneTypes[i]} ${muni(i)}`,
          zoneTypes[i], lat(i), lng(i), (500+i*200)]);
    }
    console.log("✓ geofence_zones (10)");

    // ── 32. GEOFENCE EVENTS ────────────────────────────────────────────────
    const geoEvts = ["enter","exit","enter","dwell","exit","enter","exit","dwell","enter","exit"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.geofence_events (zone_id, recurso_id, event_type, latitude, longitude)
        VALUES ($1,$2,$3,$4,$5)
      `, [GZ[i], REC[i], geoEvts[i], lat(i)+0.001, lng(i)+0.001]);
    }
    console.log("✓ geofence_events (10)");

    // ── 33. ALLOCATION SCENARIOS ───────────────────────────────────────────
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.allocation_scenarios
          (id, tenant_id, scenario_name, description, budget_total, parameters, status, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,'draft',$7)
        ON CONFLICT (id) DO NOTHING
      `, [AS_[i], tenantIds[i], `Escenario ${i+1} ${muni(i)}`,
          `Distribución óptima de recursos alimentarios para ${muni(i)}`,
          (20000000+i*2000000),
          JSON.stringify({ priority: sevs[i], zones: [muni(i)], products: [prodNames2[i]] }),
          U.ADMIN]);
    }
    console.log("✓ allocation_scenarios (10)");

    // ── 34. ALERT THRESHOLDS ──────────────────────────────────────────────
    const ruleKeys = ["max_delay_minutes","min_coverage_pct","max_spoilage_pct","min_stock_days",
      "max_incident_open_hours","max_route_km","min_beneficiaries_served_pct",
      "max_complaints_week","min_program_budget_pct","max_response_time_minutes"];
    const ruleVals = [60,80,5,7,24,150,75,10,60,30];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.alert_thresholds (id, tenant_id, rule_key, value, description, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (tenant_id, rule_key) DO UPDATE SET value=EXCLUDED.value
      `, [AT_[i], tenantIds[i], ruleKeys[i], ruleVals[i],
          `Umbral para ${ruleKeys[i]}`, U.ADMIN]);
    }
    console.log("✓ alert_thresholds (10)");

    // ── 35. VRP SOLUTIONS ──────────────────────────────────────────────────
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.vrp_solutions
          (id, tenant_id, scenario_name, depot_lat, depot_lng, strategy, status,
           total_vehicles_used, total_distance_km, total_duration_min, total_load_kg,
           routing_engine, created_by)
        VALUES ($1,$2,$3,$4,$5,'clarke_wright','completed',$6,$7,$8,$9,'haversine',$10)
        ON CONFLICT (id) DO NOTHING
      `, [VRP[i], tenantIds[i], `VRP ${muni(i)} semana ${i+1}`,
          lat(i), lng(i), (2+i%3), (20+i*3).toFixed(1), (90+i*10), (300+i*40), U.ADMIN]);
    }
    console.log("✓ vrp_solutions (10)");

    // ── 36. VRP VEHICLE ROUTES ────────────────────────────────────────────
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.vrp_vehicle_routes
          (id, vrp_solution_id, vehicle_index, recurso_id, vehicle_label,
           capacity_kg, assigned_load_kg, distance_km, duration_min, stop_count, stop_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO NOTHING
      `, [VRPR[i], VRP[i], i, REC[i], `Vehículo ${i+1} - ${muni(i)}`,
          500, (250+i*20), (8+i*1.5).toFixed(1), (35+i*5), (2+i%4),
          JSON.stringify([{ stop: 1, lat: lat(i), lng: lng(i) }])]);
    }
    console.log("✓ vrp_vehicle_routes (10)");

    // ── 37. SPOILAGE RECORDS ──────────────────────────────────────────────
    const spReasons = ["temperature","time_exceeded","damage","contamination","other",
      "temperature","time_exceeded","damage","contamination","other"];
    const spStages = ["storage","transport","distribution","reception","storage",
      "transport","distribution","reception","storage","transport"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.spoilage_records
          (id, tenant_id, program_id, logistics_order_id, product_name, category,
           quantity_kg, spoilage_kg, spoilage_reason, stage, temperature_c,
           detected_by, location_name, latitude, longitude)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (id) DO NOTHING
      `, [SP[i], tenantIds[i], FP[i], LOG[i], prodNames2[i], catNames[i],
          (100+i*10), (5+i*2), spReasons[i], spStages[i], (4+i*2).toFixed(1),
          `Inspector ${i+1}`, origNames[i], lat(i), lng(i)]);
    }
    console.log("✓ spoilage_records (10)");

    // ── 38. INVENTORY IMPORTS ─────────────────────────────────────────────
    const importStatuses = ["completed","completed","failed","completed","processing",
      "completed","completed","failed","completed","completed"] as const;
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.inventory_imports
          (id, tenant_id, filename, total_rows, success_count, error_count, errors, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO NOTHING
      `, [II[i], tenantIds[i], `inventario_${muni(i).toLowerCase().replace(/\s/g,"_")}_${i+1}.csv`,
          (50+i*10), importStatuses[i]==="failed"?0:(45+i*8),
          importStatuses[i]==="failed"?(50+i*10):(5+i*2),
          importStatuses[i]==="failed"
            ? JSON.stringify([{ row: 1, error: "formato inválido" }])
            : JSON.stringify([]),
          importStatuses[i]]);
    }
    console.log("✓ inventory_imports (10)");

    // ── 39. INSTITUTION STATUS HISTORY ────────────────────────────────────
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.institution_status_history
          (id, institution_id, old_status, new_status, changed_by, reason)
        VALUES ($1,$2,'pending_verification','active',$3,$4)
        ON CONFLICT (id) DO NOTHING
      `, [ISH[i], INST[i], U.ADMIN, `Verificación completada por auditoría ${i+1}`]);
    }
    console.log("✓ institution_status_history (10)");

    // ── 40. AUDIT LOG (sin FK bloqueante) ─────────────────────────────────
    const services = ["user-service","producer-service","offer-service","rescue-service",
      "demand-service","inventory-service","logistics-service","incident-service",
      "auction-service","institution-service"];
    for (let i=0; i<10; i++) {
      await client.query(`
        INSERT INTO public.audit_log
          (tenant_id, service_name, entity_name, entity_id, action_name, actor_id, payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [tenantIds[i], services[i], services[i].replace("-service",""),
          prodIds[i], "CREATE", U.ADMIN, JSON.stringify({ ip: `192.168.${i}.1` })]);
    }
    console.log("✓ audit_log (10)");

    console.log("\n✅  Todas las tablas maestras pobladas con 10 registros cada una.\n");

  } catch (err) {
    console.error("❌ Error:", err instanceof Error ? err.message : err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(() => process.exit(1));
