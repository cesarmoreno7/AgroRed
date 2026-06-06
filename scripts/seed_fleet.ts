import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined,
  host:     process.env.POSTGRES_HOST || "localhost",
  port:     parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DB   || "agrored",
  user:     process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD,
});

const RECURSOS = [
  { id: "a1000001-0000-0000-0000-000000000001", nombre: "Camión Furgón Bogotá",        tipo: "vehiculo",    placa: "BTA-001", telefono: "3001110001", estado: "en_ruta",    lat:  4.6097, lng: -74.0817, vel: 48, bearing:  90 },
  { id: "a1000002-0000-0000-0000-000000000002", nombre: "Moto Express Medellín",        tipo: "moto",        placa: "MED-002", telefono: "3002220002", estado: "en_ruta",    lat:  6.2442, lng: -75.5812, vel: 35, bearing: 180 },
  { id: "a1000003-0000-0000-0000-000000000003", nombre: "Van Refrigerada Cali",         tipo: "vehiculo",    placa: "CAL-003", telefono: "3003330003", estado: "en_ruta",    lat:  3.4516, lng: -76.5320, vel: 42, bearing: 270 },
  { id: "a1000004-0000-0000-0000-000000000004", nombre: "Domiciliario Barranquilla",    tipo: "domiciliario",placa: "BAQ-004", telefono: "3004440004", estado: "en_ruta",    lat: 10.9639, lng: -74.7964, vel:  8, bearing:  45 },
  { id: "a1000005-0000-0000-0000-000000000005", nombre: "Camioneta 4x4 Bucaramanga",    tipo: "vehiculo",    placa: "BUC-005", telefono: "3005550005", estado: "en_ruta",    lat:  7.1293, lng: -73.1198, vel: 55, bearing: 315 },
  { id: "a1000006-0000-0000-0000-000000000006", nombre: "Bicicleta Eléctrica Cartagena",tipo: "bicicleta",   placa: "CTG-006", telefono: "3006660006", estado: "en_ruta",    lat: 10.3910, lng: -75.4794, vel: 18, bearing:   0 },
  { id: "a1000007-0000-0000-0000-000000000007", nombre: "Camión Pesado Manizales",      tipo: "vehiculo",    placa: "MAN-007", telefono: "3007770007", estado: "disponible", lat:  5.0703, lng: -75.5138, vel:  0, bearing:   0 },
  { id: "a1000008-0000-0000-0000-000000000008", nombre: "Moto Delivery Pereira",        tipo: "moto",        placa: "PER-008", telefono: "3008880008", estado: "en_ruta",    lat:  4.8087, lng: -75.6906, vel: 30, bearing: 135 },
  { id: "a1000009-0000-0000-0000-000000000009", nombre: "Furgón Frigorífico Cúcuta",    tipo: "vehiculo",    placa: "CUC-009", telefono: "3009990009", estado: "en_ruta",    lat:  7.8939, lng: -72.5078, vel: 60, bearing: 225 },
  { id: "a1000010-0000-0000-0000-000000000010", nombre: "Bicicleta Armenia",            tipo: "bicicleta",   placa: "ARM-010", telefono: "3001010010", estado: "en_ruta",    lat:  4.5339, lng: -75.6811, vel: 22, bearing:  90 },
];

async function run() {
  console.log("🚛 Iniciando seed de 10 recursos de flota...\n");
  try {
    const tenantRes = await pool.query(`SELECT id, name FROM public.tenants ORDER BY created_at LIMIT 1`);
    const tenant = tenantRes.rows[0];
    if (!tenant) { console.log("⚠️  No hay tenants en la BD."); return; }
    console.log(`📌 Tenant: ${tenant.name} (${tenant.id})\n`);

    for (const r of RECURSOS) {
      await pool.query(
        `INSERT INTO public.recursos (id, tenant_id, nombre, tipo, placa, telefono, estado, latitude, longitude)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO UPDATE SET
           nombre     = EXCLUDED.nombre,
           tipo       = EXCLUDED.tipo,
           placa      = EXCLUDED.placa,
           telefono   = EXCLUDED.telefono,
           estado     = EXCLUDED.estado,
           latitude   = EXCLUDED.latitude,
           longitude  = EXCLUDED.longitude,
           deleted_at = NULL,
           updated_at = NOW()`,
        [r.id, tenant.id, r.nombre, r.tipo, r.placa, r.telefono, r.estado, r.lat, r.lng]
      );

      await pool.query(
        `INSERT INTO public.tracking_actual (recurso_id, latitude, longitude, velocidad, bearing, evento, actualizado_at)
         VALUES ($1,$2,$3,$4,$5,'posicion',NOW())
         ON CONFLICT (recurso_id) DO UPDATE SET
           latitude      = EXCLUDED.latitude,
           longitude     = EXCLUDED.longitude,
           velocidad     = EXCLUDED.velocidad,
           bearing       = EXCLUDED.bearing,
           actualizado_at = NOW()`,
        [r.id, r.lat, r.lng, r.vel, r.bearing]
      );

      console.log(`  ✅ ${r.nombre} — ${r.estado} @ (${r.lat}, ${r.lng})`);
    }

    console.log("\n🎉 10 recursos y posiciones insertados correctamente.");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await pool.end();
  }
}

run();
