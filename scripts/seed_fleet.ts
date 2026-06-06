import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  database: process.env.POSTGRES_DB || "agrored",
  user: process.env.POSTGRES_USER || "777",
  password: process.env.POSTGRES_PASSWORD || "777",
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("🚛 Insertando vehículos de prueba...");
  try {
    const tenantRes = await pool.query(`SELECT id FROM public.tenants LIMIT 1`);
    const tenantId = tenantRes.rows[0]?.id;

    if (!tenantId) {
      console.log("⚠️ No se encontró ningún Tenant en la BD.");
      return;
    }

    const recursos = [
      { id: "11111111-1111-1111-1111-111111111111", nombre: "Camión Furgón 1", tipo: "vehiculo", placa: "ABC-123", telefono: "3001234567", estado: "en_ruta" },
      { id: "22222222-2222-2222-2222-222222222222", nombre: "Dron Logístico D1", tipo: "otro", placa: "DRON-01", telefono: null, estado: "en_ruta" },
    ];

    for (const r of recursos) {
      await pool.query(
        `INSERT INTO public.recursos (id, tenant_id, nombre, tipo, placa, telefono, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [r.id, tenantId, r.nombre, r.tipo, r.placa, r.telefono, r.estado]
      );
    }

    console.log("📡 Insertando posiciones de prueba...");
    const tracking = [
      { recurso_id: recursos[0].id, latitude: 4.6097, longitude: -74.0817, velocidad: 45, orden_id: null },
      { recurso_id: recursos[1].id, latitude: 4.6500, longitude: -74.0500, velocidad: 60, orden_id: null },
    ];

    for (const t of tracking) {
      await pool.query(
        `INSERT INTO public.tracking_actual (recurso_id, latitude, longitude, velocidad, orden_id, actualizado_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (recurso_id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, velocidad = EXCLUDED.velocidad, actualizado_at = NOW()`,
        [t.recurso_id, t.latitude, t.longitude, t.velocidad, t.orden_id]
      );
    }

    console.log("✅ Datos de flota insertados exitosamente.");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await pool.end();
  }
}

run();
